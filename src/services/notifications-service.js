import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch
} from 'firebase/firestore';
import { isSpark } from '../config/backend-mode.js';
import { getFirebaseApp } from '../config/firebase-app.js';

export const LIST_SIZE = 20;
export const PREF_KEYS = [['content', 'محتوى جديد'], ['grade', 'الدرجات'], ['attendance', 'الغياب'], ['chat', 'الرسائل']];

/** آخر الإشعارات لحظيًا. يرجع دالة لإلغاء الاشتراك. */
export function watchNotifications(database, uid, onChange) {
  const recent = query(collection(database, 'userNotifications'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(LIST_SIZE));
  return onSnapshot(recent, snapshot => {
    const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    onChange(items, items.filter(item => item.read !== true).length);
  }, () => onChange([], 0));
}

export const markRead = (database, id) => updateDoc(doc(database, 'userNotifications', id), { read: true });

export async function markAllRead(database, items) {
  const unread = items.filter(item => item.read !== true);
  if (!unread.length) return;
  const batch = writeBatch(database);
  unread.forEach(item => batch.update(doc(database, 'userNotifications', item.id), { read: true }));
  await batch.commit();
}

export async function loadPrefs(database, uid) {
  const snapshot = await getDoc(doc(database, 'notificationPrefs', uid));
  const saved = snapshot.exists() ? snapshot.data() : {};
  return Object.fromEntries(PREF_KEYS.map(([key]) => [key, saved[key] !== false]));
}

export const savePrefs = (database, uid, prefs) =>
  setDoc(doc(database, 'notificationPrefs', uid), Object.fromEntries(PREF_KEYS.map(([key]) => [key, prefs[key] !== false])));

/** هل يدعم هذا المتصفح الإشعارات اللحظية؟ على iPhone يتطلب إضافة الموقع للشاشة الرئيسية. */
export function pushSupport() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return { ok: false, reason: ios ? 'ios-install' : 'unsupported' };
  }
  return { ok: true, reason: '' };
}

async function tokenId(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].slice(0, 16).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** يطلب الإذن (يجب أن يُستدعى من نقرة) ثم يحفظ رمز الجهاز. */
export async function enablePush(database, uid) {
  const vapidKey = import.meta.env?.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return { ok: false, reason: 'no-vapid' };
  const support = pushSupport();
  if (!support.ok) return support;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };
  const { getMessaging, getToken } = await import('firebase/messaging');
  const base = import.meta.env.BASE_URL || '/';
  const registration = await navigator.serviceWorker.register(`${base}push-sw.js`, { scope: base });
  const token = await getToken(getMessaging(getFirebaseApp()), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return { ok: false, reason: 'no-token' };
  await setDoc(doc(database, 'pushDevices', await tokenId(token)), { uid, token, createdAt: serverTimestamp() });
  return { ok: true, reason: '' };
}

export async function disablePush(database, uid) {
  const snapshot = await getDocs(query(collection(database, 'pushDevices'), where('uid', '==', uid), limit(20)));
  await Promise.all(snapshot.docs.map(item => deleteDoc(item.ref)));
}

/* ---------- وضع Spark: إشعارات مشتقة من بيانات موجودة (بدون وظائف خادم) ---------- */
export const sparkMode = isSpark;

export async function loadLastSeen(database, uid) {
  const ref = doc(database, 'notificationState', uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return snapshot.data().lastSeen.toDate();
  const now = new Date();
  await setDoc(ref, { lastSeen: Timestamp.fromDate(now) });
  return now;
}

export const saveLastSeen = (database, uid) => setDoc(doc(database, 'notificationState', uid), { lastSeen: serverTimestamp() });

const DERIVED = {
  content: item => ({ type: 'content', title: 'محتوى جديد', body: String(item.title ?? '').slice(0, 80) }),
  grade: item => ({ type: 'grade', title: 'درجة جديدة', body: `${String(item.subjectName ?? '').slice(0, 40)}: ${String(item.title ?? '').slice(0, 60)} (${item.score}/${item.max})` }),
  message: item => ({ type: 'message', title: 'رسالة جديدة', body: `${String(item.lastText ?? '').slice(0, 80)}` }),
  attendance: item => ({ type: 'attendance', title: 'تسجيل غياب', body: `تم تسجيل غياب بتاريخ ${String(item.date ?? '').slice(0, 10)}.` })
};

/** يبني استعلامات "الأحدث من آخر فتح" حسب الدور. كل استعلام محدود بـ 5 مستندات. */
export function derivedQueries(database, profile, lastSeen, childUids = []) {
  const since = Timestamp.fromDate(lastSeen);
  const make = (path, kind, ...filters) => ({ kind, q: query(collection(database, path), ...filters, where('createdAt', '>', since), orderBy('createdAt', 'desc'), limit(5)) });
  const chat = field => ({ kind: 'message', skipOwn: profile.uid, q: query(collection(database, 'conversations'), where(field, '==', profile.uid), where('lastAt', '>', since), orderBy('lastAt', 'desc'), limit(5)) });
  if (profile.role === 'student') {
    const list = [chat('studentUid'), make('grades', 'grade', where('studentUid', '==', profile.uid)), make('attendance', 'attendance', where('studentUid', '==', profile.uid), where('present', '==', false))];
    if (profile.classId) list.push(make('content', 'content', where('classId', '==', profile.classId), where('published', '==', true)));
    return list;
  }
  if (profile.role === 'parent') {
    return childUids.slice(0, 5).flatMap(uid => [make('grades', 'grade', where('studentUid', '==', uid)), make('attendance', 'attendance', where('studentUid', '==', uid), where('present', '==', false))]);
  }
  if (profile.role === 'teacher') return [chat('teacherUid')];
  return [];
}

export function watchDerived(database, profile, lastSeen, childUids, onChange) {
  const queries = derivedQueries(database, profile, lastSeen, childUids);
  const buckets = queries.map(() => []);
  const publish = () => {
    const items = buckets.flat().sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)).slice(0, LIST_SIZE);
    onChange(items, items.length);
  };
  const stops = queries.map(({ kind, q, skipOwn }, index) => onSnapshot(q, snapshot => {
    buckets[index] = snapshot.docs.filter(item => !skipOwn || item.data().lastBy !== skipOwn).map(item => ({ id: `${kind}-${item.id}`, ...DERIVED[kind](item.data()), createdAt: item.data().createdAt ?? item.data().lastAt, read: false }));
    publish();
  }, () => { buckets[index] = []; publish(); }));
  publish();
  return () => stops.forEach(stop => stop());
}
