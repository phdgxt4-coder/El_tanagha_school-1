import assert from 'node:assert/strict';
import fs from 'node:fs';
import test, {after, before} from 'node:test';
import {assertFails,assertSucceeds,initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection,doc,getDoc,getDocs,query,serverTimestamp,setDoc,updateDoc,where} from 'firebase/firestore';

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

async function seed(records){
  await environment.withSecurityRulesDisabled(async context=>{
    const database=context.firestore();
    for(const [path,data] of records)await setDoc(doc(database,path),data);
  });
}

test('العميل لا ينشئ ملفات أو طلبات أو سجلات إدارة', {skip:!emulatorAvailable}, async()=>{
  const userDb=environment.authenticatedContext('teacher-uid').firestore();
  await assertFails(setDoc(doc(userDb,'profiles/teacher-uid'),{role:'admin'}));
  await assertFails(setDoc(doc(userDb,'teacherApplications/teacher-uid'),{status:'pending'}));
  await assertFails(setDoc(doc(userDb,'admins/teacher-uid'),{active:true}));
});

test('المستخدم يقرأ سجله فقط ولا يقرأ طلب مستخدم آخر', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['profiles/user-a',{uid:'user-a',role:'student',status:'active'}],
    ['profiles/user-b',{uid:'user-b',role:'student',status:'active'}],
    ['teacherApplications/user-a',{uid:'user-a',status:'pending'}],
    ['teacherApplications/user-b',{uid:'user-b',status:'pending'}]
  ]);
  const userDb=environment.authenticatedContext('user-a').firestore();
  await assertSucceeds(getDoc(doc(userDb,'profiles/user-a')));
  await assertFails(getDoc(doc(userDb,'profiles/user-b')));
  await assertSucceeds(getDoc(doc(userDb,'teacherApplications/user-a')));
  await assertFails(getDoc(doc(userDb,'teacherApplications/user-b')));
});

test('العامة تقرأ المنشور فقط، ولا يمكنها إضافة مدرس إلى الدليل', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['publicTeachers/approved',{displayName:'مدرس معتمد',subjectName:'الرياضيات',published:true}],
    ['publicTeachers/hidden',{displayName:'مدرس غير منشور',subjectName:'الفيزياء',published:false}]
  ]);
  const publicDb=environment.unauthenticatedContext().firestore();
  const visible=query(collection(publicDb,'publicTeachers'),where('published','==',true));
  const result=await assertSucceeds(getDocs(visible));
  assert.equal(result.size,1);
  await assertFails(getDoc(doc(publicDb,'publicTeachers/hidden')));
  await assertFails(setDoc(doc(publicDb,'publicTeachers/attacker'),{published:true}));
});

test('الإدارة النشطة تقرأ طلبات المدرسين لكن كتابة السجل تظل للخادم فقط', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['admins/admin-uid',{active:true}],
    ['teacherApplications/request-uid',{uid:'request-uid',status:'pending'}]
  ]);
  const adminDb=environment.authenticatedContext('admin-uid').firestore();
  await assertSucceeds(getDoc(doc(adminDb,'teacherApplications/request-uid')));
  await assertFails(setDoc(doc(adminDb,'teacherApplications/request-uid'),{status:'approved'}));
});

test('المدرس لا ينقل محتوى إلى صف آخر ولا ينشر مادة أو رابطًا خارج نطاقه', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['profiles/teacher-a',{uid:'teacher-a',role:'teacher',status:'active',grades:['1'],subjectId:'math'}],
    ['content/lesson-a',{teacherUid:'teacher-a',grade:'1',subjectId:'math',type:'lesson',title:'درس',url:'https://school.example/lesson',published:true,createdAt:new Date()}]
  ]);
  const teacherDb=environment.authenticatedContext('teacher-a').firestore();
  const lesson=doc(teacherDb,'content/lesson-a');
  await assertSucceeds(updateDoc(lesson,{title:'عنوان محدث'}));
  await assertFails(updateDoc(lesson,{grade:'2'}));
  await assertFails(updateDoc(lesson,{teacherUid:'teacher-b'}));
  const forged={teacherUid:'teacher-a',grade:'1',subjectId:'ar',type:'lesson',title:'مزيف',url:'https://school.example/x',published:true,createdAt:serverTimestamp()};
  await assertFails(setDoc(doc(teacherDb,'content/other-subject'),forged));
  await assertFails(setDoc(doc(teacherDb,'content/insecure-url'),{...forged,subjectId:'math',url:'javascript:alert(1)'}));
  await assertFails(setDoc(doc(teacherDb,'content/other-grade'),{...forged,subjectId:'math',grade:'2'}));
});

test('المدرس لا يكتب درجات أو حضورًا لصف طالب مختلف أو ينتزع ملكية سجل قائم', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['profiles/teacher-a',{uid:'teacher-a',role:'teacher',status:'active',grades:['1'],subjectId:'math'}],
    ['profiles/student-one',{uid:'student-one',role:'student',status:'active',grade:'1'}],
    ['profiles/student-two',{uid:'student-two',role:'student',status:'active',grade:'2'}],
    ['grades/grade-one',{teacherUid:'teacher-a',studentUid:'student-one',grade:'1',score:80}],
    ['grades/grade-two',{teacherUid:'teacher-b',studentUid:'student-one',grade:'1',score:70}],
    ['attendance/attendance-one',{teacherUid:'teacher-a',studentUid:'student-one',grade:'1',present:true}]
  ]);
  const teacherDb=environment.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(updateDoc(doc(teacherDb,'grades/grade-one'),{score:85}));
  await assertFails(updateDoc(doc(teacherDb,'grades/grade-one'),{grade:'2'}));
  await assertFails(updateDoc(doc(teacherDb,'grades/grade-two'),{teacherUid:'teacher-a',score:99}));
  await assertFails(setDoc(doc(teacherDb,'grades/forged'),{teacherUid:'teacher-a',studentUid:'student-two',grade:'1',score:99}));
  await assertFails(setDoc(doc(teacherDb,'attendance/forged'),{teacherUid:'teacher-a',studentUid:'student-two',grade:'1',present:true}));
  await assertSucceeds(updateDoc(doc(teacherDb,'attendance/attendance-one'),{present:false}));
});

test('الطالب لا يقرأ مستند امتحان قد يحتوي مفتاح الإجابة، ولا يستطيع تسليم الإجابة مرتين', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['profiles/student-one',{uid:'student-one',role:'student',status:'active',grade:'1'}],
    ['profiles/teacher-a',{uid:'teacher-a',role:'teacher',status:'active',grades:['1'],subjectId:'math'}],
    ['exams/exam-one',{teacherUid:'teacher-a',grade:'1',subjectId:'math',answerKey:['A','C']}]
  ]);
  const studentDb=environment.authenticatedContext('student-one').firestore();
  await assertFails(getDoc(doc(studentDb,'exams/exam-one')));
  const submission=doc(studentDb,'submissions/student-one_exam-one');
  await assertSucceeds(setDoc(submission,{studentUid:'student-one',examId:'exam-one',answers:['A','B'],submittedAt:serverTimestamp()}));
  await assertFails(setDoc(submission,{studentUid:'student-one',examId:'exam-one',answers:['C','D'],submittedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(studentDb,'submissions/fake-score'),{studentUid:'student-one',examId:'exam-one',answers:[],score:100,submittedAt:serverTimestamp()}));
});

test('المعلّم لا يرسل إشعارًا عامًا ولا يعدّل إشعار مدرس آخر', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['profiles/teacher-a',{uid:'teacher-a',role:'teacher',status:'active',grades:['1'],subjectId:'math'}],
    ['profiles/teacher-b',{uid:'teacher-b',role:'teacher',status:'active',grades:['2'],subjectId:'ar'}],
    ['profiles/student-target',{uid:'student-target',role:'student',status:'active',grade:'1'}],
    ['profiles/student-peer',{uid:'student-peer',role:'student',status:'active',grade:'1'}],
    ['profiles/parent-linked',{uid:'parent-linked',role:'parent',status:'active'}],
    ['profiles/parent-unrelated',{uid:'parent-unrelated',role:'parent',status:'active'}],
    ['parentLinks/parent-linked_student-target',{parentUid:'parent-linked',studentUid:'student-target',active:true}],
    ['notifications/notice-b',{teacherUid:'teacher-b',audience:'grade',grade:'2',title:'تنبيه',body:'نص'}]
  ]);
  const teacherDb=environment.authenticatedContext('teacher-a').firestore();
  await assertFails(setDoc(doc(teacherDb,'notifications/broadcast'),{teacherUid:'teacher-a',audience:'all',title:'عام'}));
  await assertFails(setDoc(doc(teacherDb,'notifications/grade-two'),{teacherUid:'teacher-a',audience:'grade',grade:'2',title:'صف آخر'}));
  await assertFails(setDoc(doc(teacherDb,'notifications/private-user'),{teacherUid:'teacher-a',audience:'grade',grade:'1',uid:'victim-uid',title:'إشعار خاص',body:'نص'}));
  await assertFails(setDoc(doc(teacherDb,'notifications/private-student'),{teacherUid:'teacher-a',audience:'grade',grade:'1',studentUid:'student-in-other-grade',title:'إشعار خاص',body:'نص'}));
  await assertFails(updateDoc(doc(teacherDb,'notifications/notice-b'),{teacherUid:'teacher-a',title:'تلاعب'}));
  await assertSucceeds(setDoc(doc(teacherDb,'notifications/grade-one'),{teacherUid:'teacher-a',audience:'grade',grade:'1',title:'تنبيه',body:'نص'}));
  await assertSucceeds(setDoc(doc(teacherDb,'notifications/student-target'),{teacherUid:'teacher-a',audience:'grade',grade:'1',studentUid:'student-target',title:'تنبيه خاص',body:'نص'}));
  await assertSucceeds(getDoc(doc(environment.authenticatedContext('student-target').firestore(),'notifications/student-target')));
  await assertFails(getDoc(doc(environment.authenticatedContext('student-peer').firestore(),'notifications/student-target')));
  await assertSucceeds(getDoc(doc(environment.authenticatedContext('parent-linked').firestore(),'notifications/student-target')));
  await assertFails(getDoc(doc(environment.authenticatedContext('parent-unrelated').firestore(),'notifications/student-target')));
});
