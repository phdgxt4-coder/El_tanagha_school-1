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
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async context=>{
    const database=context.firestore();
    for(const [path,data] of records)await setDoc(doc(database,path),data);
  });
}

test('العميل لا ينشئ ملفات أو طلبات أو سجلات إدارة', {skip:!emulatorAvailable}, async()=>{
  const userDb=environment.authenticatedContext('teacher-uid',{email_verified:true}).firestore();
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
  const userDb=environment.authenticatedContext('user-a',{email_verified:true}).firestore();
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
  const adminDb=environment.authenticatedContext('admin-uid',{email_verified:true}).firestore();
  await assertSucceeds(getDoc(doc(adminDb,'teacherApplications/request-uid')));
  await assertFails(setDoc(doc(adminDb,'teacherApplications/request-uid'),{status:'approved'}));
});

test('المدرس لا ينقل محتوى إلى صف آخر ولا ينشر مادة أو رابطًا خارج نطاقه', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['profiles/teacher-a',{uid:'teacher-a',role:'teacher',status:'active',grades:['1'],subjectId:'math',subjectIds:['math'],assignedClassIds:['c1']}],
    ['classes/c1',{grade:'1',name:'الأول الثانوي - أ'}],
    ['classes/c2',{grade:'2',name:'الثاني الثانوي - أ'}],
    ['teacherAssignments/teacher-a_math_c1',{teacherUid:'teacher-a',subjectId:'math',classId:'c1',grade:'1'}],
    ['content/lesson-a',{teacherUid:'teacher-a',grade:'1',classId:'c1',subjectId:'math',type:'lesson',title:'درس',url:'https://school.example/lesson',published:true,createdAt:new Date()}]
  ]);
  const teacherDb=environment.authenticatedContext('teacher-a',{email_verified:true}).firestore();
  const lesson=doc(teacherDb,'content/lesson-a');
  await assertSucceeds(updateDoc(lesson,{title:'عنوان محدث'}));
  await assertFails(updateDoc(lesson,{grade:'2'}));
  await assertFails(updateDoc(lesson,{classId:'c2'}));
  await assertFails(updateDoc(lesson,{teacherUid:'teacher-b'}));
  const forged={teacherUid:'teacher-a',grade:'1',classId:'c1',subjectId:'ar',type:'lesson',title:'مزيف',url:'https://school.example/x',published:true,createdAt:serverTimestamp()};
  await assertFails(setDoc(doc(teacherDb,'content/other-subject'),forged));
  await assertSucceeds(setDoc(doc(teacherDb,'content/valid'),{...forged,subjectId:'math'}));
  await assertFails(setDoc(doc(teacherDb,'content/insecure-url'),{...forged,subjectId:'math',url:'javascript:alert(1)'}));
  await assertFails(setDoc(doc(teacherDb,'content/other-grade'),{...forged,subjectId:'math',grade:'2',classId:'c2'}));
});

test('المدرس لا يكتب درجات أو حضورًا لصف طالب مختلف أو ينتزع ملكية سجل قائم', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['profiles/teacher-a',{uid:'teacher-a',role:'teacher',status:'active',grades:['1'],subjectId:'math',subjectIds:['math'],assignedClassIds:['c1']}],
    ['teacherAssignments/teacher-a_math_c1',{teacherUid:'teacher-a',subjectId:'math',classId:'c1',grade:'1'}],
    ['profiles/student-one',{uid:'student-one',role:'student',status:'active',grade:'1',classId:'c1'}],
    ['profiles/student-sibling',{uid:'student-sibling',role:'student',status:'active',grade:'1',classId:'c1b'}],
    ['profiles/student-two',{uid:'student-two',role:'student',status:'active',grade:'2',classId:'c2'}],
    ['grades/grade-one',{teacherUid:'teacher-a',studentUid:'student-one',grade:'1',classId:'c1',subjectId:'math',score:80}],
    ['grades/grade-two',{teacherUid:'teacher-b',studentUid:'student-one',grade:'1',classId:'c1',subjectId:'math',score:70}],
    ['attendance/attendance-one',{teacherUid:'teacher-a',studentUid:'student-one',grade:'1',classId:'c1',present:true}]
  ]);
  const teacherDb=environment.authenticatedContext('teacher-a',{email_verified:true}).firestore();
  await assertSucceeds(updateDoc(doc(teacherDb,'grades/grade-one'),{score:85}));
  await assertFails(updateDoc(doc(teacherDb,'grades/grade-one'),{grade:'2'}));
  await assertFails(updateDoc(doc(teacherDb,'grades/grade-two'),{teacherUid:'teacher-a',score:99}));
  await assertFails(setDoc(doc(teacherDb,'grades/forged'),{teacherUid:'teacher-a',studentUid:'student-two',grade:'1',classId:'c1',subjectId:'math',score:99}));
  await assertFails(setDoc(doc(teacherDb,'attendance/forged'),{teacherUid:'teacher-a',studentUid:'student-two',grade:'1',classId:'c1',present:true}));
  await assertSucceeds(updateDoc(doc(teacherDb,'attendance/attendance-one'),{present:false}));
  // طالب في نفس الصف لكن في فصل آخر غير مسند للمدرس
  await assertFails(setDoc(doc(teacherDb,'grades/other-class'),{teacherUid:'teacher-a',studentUid:'student-sibling',grade:'1',classId:'c1b',subjectId:'math',score:50}));
  await assertFails(setDoc(doc(teacherDb,'grades/other-subject'),{teacherUid:'teacher-a',studentUid:'student-one',grade:'1',classId:'c1',subjectId:'phy',score:50}));
  await assertSucceeds(setDoc(doc(teacherDb,'grades/ok'),{teacherUid:'teacher-a',studentUid:'student-one',grade:'1',classId:'c1',subjectId:'math',score:60}));
});

test('الطالب لا يقرأ مستند امتحان قد يحتوي مفتاح الإجابة، ولا يستطيع تسليم الإجابة مرتين', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['profiles/student-one',{uid:'student-one',role:'student',status:'active',grade:'1'}],
    ['profiles/teacher-a',{uid:'teacher-a',role:'teacher',status:'active',grades:['1'],subjectId:'math'}],
    ['exams/exam-one',{teacherUid:'teacher-a',grade:'1',subjectId:'math',answerKey:['A','C']}]
  ]);
  const studentDb=environment.authenticatedContext('student-one',{email_verified:true}).firestore();
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
  const teacherDb=environment.authenticatedContext('teacher-a',{email_verified:true}).firestore();
  await assertFails(setDoc(doc(teacherDb,'notifications/broadcast'),{teacherUid:'teacher-a',audience:'all',title:'عام'}));
  await assertFails(setDoc(doc(teacherDb,'notifications/grade-two'),{teacherUid:'teacher-a',audience:'grade',grade:'2',title:'صف آخر'}));
  await assertFails(setDoc(doc(teacherDb,'notifications/private-user'),{teacherUid:'teacher-a',audience:'grade',grade:'1',uid:'victim-uid',title:'إشعار خاص',body:'نص'}));
  await assertFails(setDoc(doc(teacherDb,'notifications/private-student'),{teacherUid:'teacher-a',audience:'grade',grade:'1',studentUid:'student-in-other-grade',title:'إشعار خاص',body:'نص'}));
  await assertFails(updateDoc(doc(teacherDb,'notifications/notice-b'),{teacherUid:'teacher-a',title:'تلاعب'}));
  await assertSucceeds(setDoc(doc(teacherDb,'notifications/grade-one'),{teacherUid:'teacher-a',audience:'grade',grade:'1',title:'تنبيه',body:'نص'}));
  await assertSucceeds(setDoc(doc(teacherDb,'notifications/student-target'),{teacherUid:'teacher-a',audience:'grade',grade:'1',studentUid:'student-target',title:'تنبيه خاص',body:'نص'}));
  await assertSucceeds(getDoc(doc(environment.authenticatedContext('student-target',{email_verified:true}).firestore(),'notifications/student-target')));
  await assertFails(getDoc(doc(environment.authenticatedContext('student-peer',{email_verified:true}).firestore(),'notifications/student-target')));
  await assertSucceeds(getDoc(doc(environment.authenticatedContext('parent-linked',{email_verified:true}).firestore(),'notifications/student-target')));
  await assertFails(getDoc(doc(environment.authenticatedContext('parent-unrelated',{email_verified:true}).firestore(),'notifications/student-target')));
});

test('الإدارة وحدها تُسند المدرسين؛ المدرس لا يقرأ إسناد غيره ولا يكتب إسنادًا لنفسه', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['admins/admin-uid',{active:true}],
    ['profiles/teacher-a',{uid:'teacher-a',role:'teacher',status:'active'}],
    ['profiles/student-one',{uid:'student-one',role:'student',status:'active',grade:'1',classId:'c1'}],
    ['profiles/student-two',{uid:'student-two',role:'student',status:'active',grade:'1',classId:'c2'}],
    ['teacherAssignments/teacher-a_math_c1',{teacherUid:'teacher-a',subjectId:'math',classId:'c1'}],
    ['teacherAssignments/teacher-b_ar_c2',{teacherUid:'teacher-b',subjectId:'ar',classId:'c2'}]
  ]);
  const teacherDb=environment.authenticatedContext('teacher-a',{email_verified:true}).firestore();
  await assertSucceeds(getDoc(doc(teacherDb,'teacherAssignments/teacher-a_math_c1')));
  await assertFails(getDoc(doc(teacherDb,'teacherAssignments/teacher-b_ar_c2')));
  await assertFails(setDoc(doc(teacherDb,'teacherAssignments/teacher-a_phy_c1'),{teacherUid:'teacher-a',subjectId:'phy',classId:'c1'}));
  const adminDb=environment.authenticatedContext('admin-uid',{email_verified:true}).firestore();
  await assertSucceeds(getDoc(doc(adminDb,'teacherAssignments/teacher-b_ar_c2')));
  await assertFails(setDoc(doc(adminDb,'teacherAssignments/x'),{teacherUid:'a'}));
  const studentDb=environment.authenticatedContext('student-one',{email_verified:true}).firestore();
  await assertSucceeds(getDoc(doc(studentDb,'teacherAssignments/teacher-a_math_c1')));
  await assertFails(getDoc(doc(studentDb,'teacherAssignments/teacher-b_ar_c2')));
});

test('الفصول والمواد تُقرأ علنًا لنموذج التسجيل لكن لا يكتبها العميل، وكودات الربط والمحاولات والقائمة مغلقة', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['classes/c1',{grade:'1',name:'الأول الثانوي - أ'}],
    ['subjects/math',{name:'الرياضيات'}],
    ['parentCodes/TNG-AAAAAAAA',{studentUid:'student-one',active:true}],
    ['rosterStudents/01000000000',{fullName:'محمد أحمد علي حسن',classId:'c1'}],
    ['linkAttempts/parent-a',{failures:2}],
    ['admins/admin-uid',{active:true}]
  ]);
  const publicDb=environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(collection(publicDb,'classes')));
  await assertSucceeds(getDocs(collection(publicDb,'subjects')));
  await assertFails(setDoc(doc(publicDb,'classes/evil'),{grade:'1'}));
  const adminDb=environment.authenticatedContext('admin-uid',{email_verified:true}).firestore();
  await assertFails(setDoc(doc(adminDb,'classes/evil'),{grade:'1'}));
  for(const path of ['parentCodes/TNG-AAAAAAAA','linkAttempts/parent-a']){
    await assertFails(getDoc(doc(adminDb,path)));
    await assertFails(getDoc(doc(environment.authenticatedContext('parent-a',{email_verified:true}).firestore(),path)));
  }
});

test('ولي الأمر المرتبط يقرأ درجات ابنه فقط، وغير المرتبط وطالب آخر لا يقرآن شيئًا', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['profiles/parent-linked',{uid:'parent-linked',role:'parent',status:'active'}],
    ['profiles/parent-other',{uid:'parent-other',role:'parent',status:'active'}],
    ['profiles/student-one',{uid:'student-one',role:'student',status:'active',grade:'1',classId:'c1'}],
    ['profiles/student-two',{uid:'student-two',role:'student',status:'active',grade:'1',classId:'c1'}],
    ['parentLinks/parent-linked_student-one',{parentUid:'parent-linked',studentUid:'student-one',active:true,status:'active'}],
    ['grades/g1',{teacherUid:'t',studentUid:'student-one',grade:'1',classId:'c1',subjectId:'math',score:90}],
    ['grades/g2',{teacherUid:'t',studentUid:'student-two',grade:'1',classId:'c1',subjectId:'math',score:70}]
  ]);
  const parentDb=environment.authenticatedContext('parent-linked',{email_verified:true}).firestore();
  const own=await assertSucceeds(getDocs(query(collection(parentDb,'grades'),where('studentUid','==','student-one'))));
  assert.equal(own.size,1);
  await assertFails(getDocs(query(collection(parentDb,'grades'),where('studentUid','==','student-two'))));
  await assertFails(getDoc(doc(parentDb,'grades/g2')));
  await assertSucceeds(getDoc(doc(parentDb,'profiles/student-one')));
  await assertFails(getDoc(doc(parentDb,'profiles/student-two')));
  const otherParentDb=environment.authenticatedContext('parent-other',{email_verified:true}).firestore();
  await assertFails(getDocs(query(collection(otherParentDb,'grades'),where('studentUid','==','student-one'))));
  const peerDb=environment.authenticatedContext('student-two',{email_verified:true}).firestore();
  await assertFails(getDoc(doc(peerDb,'grades/g1')));
  await assertSucceeds(getDoc(doc(peerDb,'grades/g2')));
});

test('الطالب يرى محتوى فصله فقط', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['profiles/student-one',{uid:'student-one',role:'student',status:'active',grade:'1',classId:'c1'}],
    ['content/mine',{teacherUid:'t',grade:'1',classId:'c1',subjectId:'math',type:'lesson',title:'ت',url:'https://x.example/a',published:true}],
    ['content/other-class',{teacherUid:'t',grade:'1',classId:'c1b',subjectId:'math',type:'lesson',title:'ت',url:'https://x.example/b',published:true}]
  ]);
  const studentDb=environment.authenticatedContext('student-one',{email_verified:true}).firestore();
  const mine=await assertSucceeds(getDocs(query(collection(studentDb,'content'),where('classId','==','c1'),where('published','==',true))));
  assert.equal(mine.size,1);
  await assertFails(getDoc(doc(studentDb,'content/other-class')));
  await assertFails(getDocs(query(collection(studentDb,'content'),where('classId','==','c1b'),where('published','==',true))));
});

test('إشعارات المستخدم: يقرأ إشعاراته فقط ولا ينشئ ولا يغيّر غير حقل read', {skip:!emulatorAvailable}, async()=>{
  await seed([
    ['userNotifications/n1',{uid:'stu1',type:'grade',title:'درجة',body:'x',read:false,createdAt:new Date()}],
    ['userNotifications/n2',{uid:'stu2',type:'grade',title:'درجة',body:'y',read:false,createdAt:new Date()}]
  ]);
  const mine=environment.authenticatedContext('stu1',{email_verified:true}).firestore();
  await assertSucceeds(getDocs(query(collection(mine,'userNotifications'),where('uid','==','stu1'))));
  await assertFails(getDoc(doc(mine,'userNotifications/n2')));
  await assertFails(getDocs(query(collection(mine,'userNotifications'),where('uid','==','stu2'))));
  await assertSucceeds(updateDoc(doc(mine,'userNotifications/n1'),{read:true}));
  await assertFails(updateDoc(doc(mine,'userNotifications/n1'),{title:'تلاعب'}));
  await assertFails(setDoc(doc(mine,'userNotifications/n9'),{uid:'stu1',type:'grade',title:'مزيف',body:'',read:false}));
});

test('أجهزة الإشعارات والتفضيلات: لصاحبها فقط وبحقول محددة', {skip:!emulatorAvailable}, async()=>{
  await seed([]);
  const mine=environment.authenticatedContext('stu1',{email_verified:true}).firestore();
  await assertSucceeds(setDoc(doc(mine,'pushDevices/d1'),{uid:'stu1',token:'abc',createdAt:serverTimestamp()}));
  await assertFails(setDoc(doc(mine,'pushDevices/d2'),{uid:'stu2',token:'abc',createdAt:serverTimestamp()}));
  await assertFails(setDoc(doc(mine,'pushDevices/d3'),{uid:'stu1',token:'abc',createdAt:serverTimestamp(),extra:1}));
  await assertSucceeds(setDoc(doc(mine,'notificationPrefs/stu1'),{content:true,grade:false,attendance:true,chat:true}));
  await assertFails(setDoc(doc(mine,'notificationPrefs/stu2'),{content:true,grade:true,attendance:true,chat:true}));
  await assertFails(setDoc(doc(mine,'notificationPrefs/stu1'),{content:'x',grade:true,attendance:true,chat:true}));
});
