import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch
} from 'firebase/firestore';
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
