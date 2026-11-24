import assert from 'node:assert/strict';
import fs from 'node:fs';
import test, {after, before} from 'node:test';
import {assertFails,assertSucceeds,initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection,doc,getDoc,getDocs,query,setDoc,where} from 'firebase/firestore';

const emulatorAvailable=Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let environment;

before(async()=>{
  if(!emulatorAvailable)return;
  environment=await initializeTestEnvironment({
    projectId:'demo-nibras-rules',
    firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}
  });
});

after(async()=>{await environment?.cleanup();});

test('العميل لا ينشئ ملفات أو طلبات أو سجلات إدارة', {skip:!emulatorAvailable}, async()=>{
  const userDb=environment.authenticatedContext('teacher-uid').firestore();
  await assertFails(setDoc(doc(userDb,'profiles/teacher-uid'),{role:'admin'}));
  await assertFails(setDoc(doc(userDb,'teacherApplications/teacher-uid'),{status:'pending'}));
  await assertFails(setDoc(doc(userDb,'admins/teacher-uid'),{active:true}));
});

test('المستخدم يقرأ سجله فقط ولا يقرأ طلب مستخدم آخر', {skip:!emulatorAvailable}, async()=>{
  await environment.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();
    await setDoc(doc(db,'profiles/user-a'),{uid:'user-a',role:'student'});
    await setDoc(doc(db,'profiles/user-b'),{uid:'user-b',role:'student'});
    await setDoc(doc(db,'teacherApplications/user-a'),{uid:'user-a',status:'pending'});
    await setDoc(doc(db,'teacherApplications/user-b'),{uid:'user-b',status:'pending'});
  });
  const userDb=environment.authenticatedContext('user-a').firestore();
  await assertSucceeds(getDoc(doc(userDb,'profiles/user-a')));
  await assertFails(getDoc(doc(userDb,'profiles/user-b')));
  await assertSucceeds(getDoc(doc(userDb,'teacherApplications/user-a')));
  await assertFails(getDoc(doc(userDb,'teacherApplications/user-b')));
});

test('العامة تقرأ المنشور فقط، ولا يمكنها إضافة مدرس إلى الدليل', {skip:!emulatorAvailable}, async()=>{
  await environment.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();
    await setDoc(doc(db,'publicTeachers/approved'),{displayName:'مدرس معتمد',subjectName:'الرياضيات',published:true});
    await setDoc(doc(db,'publicTeachers/hidden'),{displayName:'مدرس غير منشور',subjectName:'الفيزياء',published:false});
  });
  const publicDb=environment.unauthenticatedContext().firestore();
  const visible=query(collection(publicDb,'publicTeachers'),where('published','==',true));
  const result=await assertSucceeds(getDocs(visible));
  assert.equal(result.size,1);
  await assertFails(getDoc(doc(publicDb,'publicTeachers/hidden')));
  await assertFails(setDoc(doc(publicDb,'publicTeachers/attacker'),{published:true}));
});

test('الإدارة النشطة تقرأ طلبات المدرسين لكن كتابة السجل تظل للخادم فقط', {skip:!emulatorAvailable}, async()=>{
  await environment.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();
    await setDoc(doc(db,'admins/admin-uid'),{active:true});
    await setDoc(doc(db,'teacherApplications/request-uid'),{uid:'request-uid',status:'pending'});
  });
  const adminDb=environment.authenticatedContext('admin-uid').firestore();
  await assertSucceeds(getDoc(doc(adminDb,'teacherApplications/request-uid')));
  await assertFails(setDoc(doc(adminDb,'teacherApplications/request-uid'),{status:'approved'}));
});
