import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { buildNotice, uniqueRecipients, wantsNotice } from './notice-text.js';

if (getApps().length === 0) initializeApp();
const db = getFirestore();
const REGION = 'us-central1';
const CHUNK = 400;

async function linkedParents(studentUid) {
  const snapshot = await db.collection('parentLinks')
    .where('studentUid', '==', studentUid).where('active', '==', true).limit(10).get();
  return snapshot.docs.map(item => item.data().parentUid);
}

async function classStudents(classId) {
  const uids = [];
  let cursor = null;
  for (;;) {
    let query = db.collection('profiles').where('role', '==', 'student').where('classId', '==', classId)
      .where('status', '==', 'active').orderBy('__name__').limit(CHUNK);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    snapshot.docs.forEach(item => uids.push(item.id));
    if (snapshot.size < CHUNK) return uids;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
}

async function deliver(uids, notice) {
  if (!uids.length) return;
  const prefs = await Promise.all(uids.map(uid => db.collection('notificationPrefs').doc(uid).get()));
  const allowed = uids.filter((uid, index) => wantsNotice(prefs[index].exists ? prefs[index].data() : null, notice.type));
  for (let start = 0; start < allowed.length; start += CHUNK) {
    const batch = db.batch();
    for (const uid of allowed.slice(start, start + CHUNK)) {
      batch.set(db.collection('userNotifications').doc(), { uid, ...notice, read: false, createdAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
  }
  await push(allowed, notice);
}

async function push(uids, notice) {
  const tokens = [];
  for (let start = 0; start < uids.length; start += 30) {
    const snapshot = await db.collection('pushDevices').where('uid', 'in', uids.slice(start, start + 30)).get();
    snapshot.docs.forEach(item => tokens.push({ id: item.id, token: item.data().token }));
  }
  for (let start = 0; start < tokens.length; start += 500) {
    const part = tokens.slice(start, start + 500);
    try {
      const result = await getMessaging().sendEachForMulticast({
        tokens: part.map(item => item.token),
        data: { title: notice.title, body: notice.body, link: notice.link, type: notice.type }
      });
      const dead = [];
      result.responses.forEach((response, index) => {
        const code = response.error?.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') dead.push(part[index].id);
      });
      await Promise.all(dead.map(id => db.collection('pushDevices').doc(id).delete()));
    } catch (error) {
      console.error('push failed', error?.code ?? 'unknown');
    }
  }
}

const options = { region: REGION };

export const notifyOnContent = onDocumentCreated({ ...options, document: 'content/{id}' }, async event => {
  const data = event.data?.data();
  if (!data || data.published !== true || !data.classId) return;
  const students = await classStudents(data.classId);
  await deliver(uniqueRecipients(students, data.teacherUid), buildNotice('content', data));
});

export const notifyOnGrade = onDocumentCreated({ ...options, document: 'grades/{id}' }, async event => {
  const data = event.data?.data();
  if (!data?.studentUid) return;
  const parents = await linkedParents(data.studentUid);
  await deliver(uniqueRecipients([data.studentUid, ...parents], data.teacherUid), buildNotice('grade', data));
});

export const notifyOnAttendance = onDocumentCreated({ ...options, document: 'attendance/{id}' }, async event => {
  const data = event.data?.data();
  if (!data?.studentUid || data.present !== false) return;
  const parents = await linkedParents(data.studentUid);
  await deliver(uniqueRecipients([data.studentUid, ...parents], data.teacherUid), buildNotice('attendance', data));
});
