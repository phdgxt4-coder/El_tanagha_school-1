import fs from 'node:fs';
import test, { after, before } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let environment;
before(async () => {
  if (!emulatorAvailable) return;
  environment = await initializeTestEnvironment({ projectId: 'demo-parent-chat', firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
});
after(async () => { await environment?.cleanup(); });

const user = uid => environment.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
const T0 = Timestamp.fromMillis(Date.now() - 60000);
const seedData = [
  ['classes/c1', { name: '1/1', grade: '1', section: '1', year: '2026-2027' }],
  ['subjects/math', { name: 'الرياضيات' }],
  ['profiles/s1', { uid: 's1', role: 'student', status: 'active', classId: 'c1', grade: '1', displayName: 'أحمد' }],
  ['profiles/p1', { uid: 'p1', role: 'parent', status: 'active', displayName: 'ولي' }],
  ['profiles/p2', { uid: 'p2', role: 'parent', status: 'active', displayName: 'ولي2' }],
  ['profiles/t1', { uid: 't1', role: 'teacher', status: 'active', displayName: 'مدرس' }],
  ['profiles/t3', { uid: 't3', role: 'teacher', status: 'active', displayName: 'مدرس3' }],
  ['parentLinks/p1_s1', { parentUid: 'p1', studentUid: 's1', active: true }],
  ['teacherAssignments/t1_math_c1', { teacherUid: 't1', subjectId: 'math', classId: 'c1', subjectName: 'ر', className: '1/1', grade: '1', year: '2026-2027', teacherName: 'مدرس' }],
  ['parentClassAccess/p1_c1', { parentUid: 'p1', classId: 'c1', studentUid: 's1' }]
];
async function seed() {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async context => { for (const [path, data] of seedData) await setDoc(doc(context.firestore(), path), data); });
}
function send(db, teacherUid, text, first, extra = {}) {
  const cid = `${db._uid}_${teacherUid}`;
  const batch = writeBatch(db);
  const ref = doc(db, 'parentConversations', cid);
  const last = { lastAt: serverTimestamp(), lastText: text, lastBy: db._uid };
  if (first) batch.set(ref, { parentUid: db._uid, teacherUid, parentName: 'ولي', teacherName: 'مدرس', studentName: 'أحمد', classId: 'c1', subjectId: 'math', ...last, ...extra });
  else batch.update(ref, last);
  batch.set(doc(db, 'parentConversations', cid, 'messages', String(Math.random()).slice(2)), { senderUid: db._uid, text, createdAt: serverTimestamp() });
  return batch.commit();
}
const as = uid => { const db = user(uid); db._uid = uid; return db; };

test('ولي الأمر يبدأ محادثة مع مدرس فصل ابنه فقط', { skip: !emulatorAvailable }, async () => {
  await seed();
  await assertFails(send(as('p1'), 't3', 'مرحبا', true));
  await assertFails(send(as('p2'), 't1', 'مرحبا', true));
  await assertFails(send(as('p1'), 't1', 'مرحبا', true, { classId: 'c2' }));
  await assertSucceeds(send(as('p1'), 't1', 'مرحبا', true));
  await assertSucceeds(getDoc(doc(user('t1'), 'parentConversations', 'p1_t1')));
  await assertFails(getDoc(doc(user('p2'), 'parentConversations', 'p1_t1')));
  await assertFails(getDoc(doc(user('s1'), 'parentConversations', 'p1_t1')));
});

test('المدرس يرد، ولا انتحال، وإيصال القراءة لكل طرف على حقله', { skip: !emulatorAvailable }, async () => {
  await seed();
  await environment.withSecurityRulesDisabled(async c => setDoc(doc(c.firestore(), 'parentConversations/p1_t1'), { parentUid: 'p1', teacherUid: 't1', parentName: 'ولي', teacherName: 'مدرس', studentName: 'أحمد', classId: 'c1', subjectId: 'math', lastAt: T0, lastText: 'x', lastBy: 'p1' }));
  const t = as('t1'), p = as('p1');
  await assertFails(setDoc(doc(t, 'parentConversations', 'p1_t1', 'messages', 'z'), { senderUid: 'p1', text: 'انتحال', createdAt: serverTimestamp() }));
  const reply = db => { const b = writeBatch(db); b.update(doc(db, 'parentConversations', 'p1_t1'), { lastAt: serverTimestamp(), lastText: 'ok', lastBy: db._uid }); b.set(doc(db, 'parentConversations', 'p1_t1', 'messages', String(Math.random()).slice(2)), { senderUid: db._uid, text: 'ok', createdAt: serverTimestamp() }); return b.commit(); };
  await assertSucceeds(reply(t));
  await assertSucceeds(updateDoc(doc(t, 'parentConversations', 'p1_t1'), { teacherReadAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(t, 'parentConversations', 'p1_t1'), { parentReadAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(p, 'parentConversations', 'p1_t1'), { parentReadAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as('p2'), 'parentConversations', 'p1_t1'), { parentReadAt: serverTimestamp() }));
});

test('بعد فك ربط الابن لا يستطيع ولي الأمر الإرسال', { skip: !emulatorAvailable }, async () => {
  await seed();
  await environment.withSecurityRulesDisabled(async c => {
    await setDoc(doc(c.firestore(), 'parentConversations/p1_t1'), { parentUid: 'p1', teacherUid: 't1', parentName: 'ولي', teacherName: 'مدرس', studentName: 'أحمد', classId: 'c1', subjectId: 'math', lastAt: T0, lastText: 'x', lastBy: 'p1' });
    await updateDoc(doc(c.firestore(), 'parentLinks/p1_s1'), { active: false });
  });
  await assertFails(send(as('p1'), 't1', 'بعد الفك', false));
});

test('ولي الأمر يقرأ إسنادات فصل ابنه فقط', { skip: !emulatorAvailable }, async () => {
  await seed();
  const { collection, getDocs, query, where } = await import('firebase/firestore');
  await assertSucceeds(getDocs(query(collection(user('p1'), 'teacherAssignments'), where('classId', '==', 'c1'))));
  await assertFails(getDocs(query(collection(user('p2'), 'teacherAssignments'), where('classId', '==', 'c1'))));
});
