import fs from 'node:fs';
import test, {after, before} from 'node:test';
import {assertFails,assertSucceeds,initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {Timestamp,doc,getDoc,serverTimestamp,setDoc,updateDoc,writeBatch} from 'firebase/firestore';

const emulatorAvailable=Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let environment;
before(async()=>{
  if(!emulatorAvailable)return;
  environment=await initializeTestEnvironment({projectId:'demo-spark-rules',firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
});
after(async()=>{await environment?.cleanup();});

async function seed(records){
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async context=>{
    for(const [path,data] of records)await setDoc(doc(context.firestore(),path),data);
  });
}
const user=(uid,extra={})=>environment.authenticatedContext(uid,{email:`${uid}@example.com`,email_verified:true,...extra}).firestore();
const base=[
  ['classes/c1',{name:'1/1',grade:'1',section:'1',year:'2026-2027'}],
  ['subjects/math',{name:'الرياضيات'}],
  ['admins/adm',{active:true}]
];
const studentProfile=(uid,over={})=>({uid,email:`${uid}@example.com`,displayName:'أحمد محمد علي حسن',role:'student',status:'active',phone:'01012345678',createdAt:serverTimestamp(),studentId:'STU-ABCDEFGH',grade:'1',branch:'',classId:'c1',className:'1/1',rosterVerified:false,...over});

async function register(uid,data,studentId=data.studentId){
  const database=user(uid);
  const batch=writeBatch(database);
  batch.set(doc(database,'profiles',uid),data);
  if(studentId)batch.set(doc(database,'studentIds',studentId),{uid});
  return batch.commit();
}

test('Spark: الطالب يسجل نفسه بدور طالب فقط ولا يرفع نفسه لإدارة أو مدرس', {skip:!emulatorAvailable}, async()=>{
  await seed(base);
  await assertSucceeds(register('s1',studentProfile('s1')));
  await seed(base);
  await assertFails(register('s2',studentProfile('s2',{role:'admin'})));
  await assertFails(register('s2',studentProfile('s2',{role:'teacher'})));
  await assertFails(register('s2',studentProfile('s2',{status:'pending',role:'teacher'})));
});

test('Spark: قيود الطالب (اسم رباعي، فصل موجود يطابق الصف، رقم طالب غير مكرر، بريد مطابق)', {skip:!emulatorAvailable}, async()=>{
  await seed(base);
  await assertFails(register('s1',studentProfile('s1',{displayName:'أحمد محمد'})));
  await assertFails(register('s1',studentProfile('s1',{classId:'nope'})));
  await assertFails(register('s1',studentProfile('s1',{grade:'2'})));
  await assertFails(register('s1',studentProfile('s1',{email:'other@example.com'})));
  await assertFails(register('s1',studentProfile('s1',{phone:'abc'})));
  await assertFails(register('s1',studentProfile('s1',{rosterVerified:true})));
  await assertFails(register('s1',studentProfile('s1',{extraField:1})));
  await assertSucceeds(register('s1',studentProfile('s1')));
  await assertFails(register('s2',studentProfile('s2')));
  await assertFails(register('s3',studentProfile('s3',{studentId:'STU-ZZZZZZZZ'}),null));
});

test('Spark: ولي الأمر يسجل فورًا، والمدرس يحتاج بريدًا موثقًا ويبقى معلقًا', {skip:!emulatorAvailable}, async()=>{
  await seed(base);
  const parent={uid:'p1',email:'p1@example.com',displayName:'ولي أمر',role:'parent',status:'active',phone:'01012345678',createdAt:serverTimestamp()};
  await assertSucceeds(setDoc(doc(user('p1'),'profiles/p1'),parent));
  const teacherProfile={uid:'t1',email:'t1@example.com',displayName:'مدرس',role:'teacher_applicant',status:'pending',phone:'01012345678',createdAt:serverTimestamp()};
  const application={uid:'t1',displayName:'مدرس',subjectId:'math',subjectName:'الرياضيات',phone:'01012345678',publishConsent:false,status:'pending',submittedAt:serverTimestamp(),emailVerified:true};
  const unverified=user('t1',{email_verified:false});
  const bad=writeBatch(unverified);bad.set(doc(unverified,'profiles/t1'),teacherProfile);bad.set(doc(unverified,'teacherApplications/t1'),application);
  await assertFails(bad.commit());
  const early=writeBatch(unverified);early.set(doc(unverified,'profiles/t1'),teacherProfile);early.set(doc(unverified,'teacherApplications/t1'),{...application,emailVerified:false});
  await assertSucceeds(early.commit());
  await assertFails(updateDoc(doc(unverified,'teacherApplications/t1'),{emailVerified:true}));
  await seed(base);
  const database=user('t1');
  const ok=writeBatch(database);ok.set(doc(database,'profiles/t1'),teacherProfile);ok.set(doc(database,'teacherApplications/t1'),application);
  await assertSucceeds(ok.commit());
  await assertFails(updateDoc(doc(database,'profiles/t1'),{role:'teacher',status:'active'}));
});

test('Spark: اعتماد المدرس وإدارة الهيكل للإدارة فقط', {skip:!emulatorAvailable}, async()=>{
  await seed([...base,
    ['profiles/t1',{uid:'t1',email:'t1@example.com',displayName:'مدرس',role:'teacher_applicant',status:'pending'}],
    ['profiles/s1',studentProfile('s1',{createdAt:new Date()})],
    ['teacherApplications/t1',{uid:'t1',status:'pending',emailVerified:false}]]);
  const admin=user('adm');
  await assertFails(updateDoc(doc(admin,'profiles/t1'),{role:'teacher',status:'active',grades:[],assignedClassIds:[]}));
  await assertSucceeds(updateDoc(doc(user('t1'),'teacherApplications/t1'),{emailVerified:true}));
  await assertSucceeds(updateDoc(doc(admin,'profiles/t1'),{role:'teacher',status:'active',subjectId:'math',grades:[],assignedClassIds:[]}));
  await assertSucceeds(updateDoc(doc(admin,'teacherApplications/t1'),{status:'approved',reviewedBy:'adm',reviewedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(admin,'profiles/s1'),{status:'disabled'}));
  await assertFails(updateDoc(doc(admin,'profiles/t1'),{email:'x@y.z'}));
  await assertSucceeds(setDoc(doc(admin,'classes/c2'),{name:'1/2',grade:'1',section:'2',year:'2026-2027',updatedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(doc(admin,'teacherAssignments/t1_math_c1'),{teacherUid:'t1',subjectId:'math',classId:'c1',subjectName:'الرياضيات',className:'1/1',grade:'1',year:'2026-2027',teacherName:'مدرس',assignedBy:'adm',assignedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(admin,'teacherAssignments/wrong'),{teacherUid:'t1',subjectId:'math',classId:'c1',subjectName:'x',className:'y',grade:'1',assignedAt:serverTimestamp()}));
  const student=user('s1');
  await assertFails(setDoc(doc(student,'classes/c9'),{name:'x',grade:'1'}));
  await assertFails(updateDoc(doc(student,'profiles/t1'),{status:'active'}));
  const outsider=user('t1');
  await assertFails(updateDoc(doc(outsider,'teacherApplications/t1'),{status:'approved',reviewedBy:'t1',reviewedAt:serverTimestamp()}));
});

const nextHour=()=>Timestamp.fromMillis(Date.now()+3600000);
const codeSeed=(over={})=>[...base,
  ['profiles/s1',studentProfile('s1',{createdAt:new Date()})],
  ['profiles/p1',{uid:'p1',email:'p1@example.com',displayName:'ولي',role:'parent',status:'active'}],
  ['profiles/p2',{uid:'p2',email:'p2@example.com',displayName:'ولي',role:'parent',status:'active'}],
  ['parentCodes/TNG-ABCD2345',{studentUid:'s1',studentId:'STU-ABCDEFGH',active:true,createdAt:new Date(),expiresAt:nextHour(),...over}]];
async function link(uid,code='TNG-ABCD2345',studentUid='s1'){
  const database=user(uid);
  const batch=writeBatch(database);
  batch.update(doc(database,'parentCodes',code),{active:false,usedBy:uid,usedAt:serverTimestamp()});
  batch.set(doc(database,'parentLinks',`${uid}_${studentUid}`),{parentUid:uid,studentUid,studentId:'STU-ABCDEFGH',status:'active',active:true,createdAt:serverTimestamp(),code});
  return batch.commit();
}

test('Spark: الطالب يصدر كودًا صالحًا 15 دقيقة فقط ولا يقرأ أحد الأكواد', {skip:!emulatorAvailable}, async()=>{
  await seed([...base,['profiles/s1',studentProfile('s1',{createdAt:new Date()})]]);
  const student=user('s1');
  const code={studentUid:'s1',studentId:'STU-ABCDEFGH',active:true,createdAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+900000)};
  await assertFails(setDoc(doc(student,'parentCodes/TNG-ABCD2345'),{...code,expiresAt:Timestamp.fromMillis(Date.now()+86400000)}));
  await assertFails(setDoc(doc(student,'parentCodes/TNG-ABCD2345'),{...code,expiresAt:Timestamp.fromMillis(Date.now()-60000)}));
  await assertFails(setDoc(doc(student,'parentCodes/short'),code));
  await assertSucceeds(setDoc(doc(student,'parentCodes/TNG-ABCD2345'),code));
  await assertFails(setDoc(doc(student,'parentCodes/TNG-ZZZZ2345'),{...code,studentId:'STU-OTHEROTHER'}));
  await assertFails(getDoc(doc(user('p9'),'parentCodes/TNG-ABCD2345')));
});

test('Spark: ربط ولي الأمر بكود صالح مرة واحدة فقط ويبقى مرتبطًا', {skip:!emulatorAvailable}, async()=>{
  await seed(codeSeed());
  await assertSucceeds(link('p1'));
  await assertFails(link('p2'));
  await seed(codeSeed({expiresAt:Timestamp.fromMillis(Date.now()-1000)}));
  await assertFails(link('p1'));
  await seed(codeSeed());
  await assertFails(link('p1','TNG-ABCD2345','other'));
  await assertSucceeds(link('p1'));
  const parent=user('p1');
  await assertSucceeds(getDoc(doc(parent,'parentLinks/p1_s1')));
  await assertFails(updateDoc(doc(parent,'parentLinks/p1_s1'),{studentUid:'x'}));
  await assertSucceeds(updateDoc(doc(parent,'parentLinks/p1_s1'),{active:false,status:'revoked',revokedBy:'p1'}));
});

test('Spark: حالة الإشعارات (آخر فتح) لصاحبها فقط', {skip:!emulatorAvailable}, async()=>{
  await seed(base);
  const a=user('u1'),b=user('u2');
  await assertSucceeds(setDoc(doc(a,'notificationState','u1'),{lastSeen:serverTimestamp()}));
  await assertSucceeds(getDoc(doc(a,'notificationState','u1')));
  await assertFails(getDoc(doc(b,'notificationState','u1')));
  await assertFails(setDoc(doc(b,'notificationState','u1'),{lastSeen:serverTimestamp()}));
  await assertFails(setDoc(doc(a,'notificationState','u1'),{lastSeen:serverTimestamp(),x:1}));
});
