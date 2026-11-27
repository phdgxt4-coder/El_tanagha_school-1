import fs from 'node:fs';
import test, {after, before} from 'node:test';
import {assertFails,assertSucceeds,initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {Timestamp,deleteDoc,doc,getDoc,serverTimestamp,setDoc,updateDoc,writeBatch} from 'firebase/firestore';

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
const studentProfile=(uid,over={})=>({uid,email:`${uid}@example.com`,displayName:'أحمد محمد علي حسن',role:'student',status:'active',phone:'01012345678',createdAt:serverTimestamp(),consentAt:serverTimestamp(),studentId:'STU-ABCDEFGH',grade:'1',branch:'',classId:'c1',className:'1/1',rosterVerified:false,...over});

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
  const parent={uid:'p1',email:'p1@example.com',displayName:'ولي أمر',role:'parent',status:'active',phone:'01012345678',createdAt:serverTimestamp(),consentAt:serverTimestamp()};
  await assertSucceeds(setDoc(doc(user('p1'),'profiles/p1'),parent));
  const teacherProfile={uid:'t1',email:'t1@example.com',displayName:'مدرس',role:'teacher_applicant',status:'pending',phone:'01012345678',createdAt:serverTimestamp(),consentAt:serverTimestamp()};
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
  await assertSucceeds(updateDoc(doc(admin,'profiles/s1'),{status:'disabled'}));
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

const T0=Timestamp.fromMillis(Date.now()-60000);
const chatBase=()=>[...base,
  ['profiles/s1',studentProfile('s1')],
  ['profiles/t1',{uid:'t1',role:'teacher',status:'active',displayName:'مدرس'}],
  ['profiles/t2',{uid:'t2',role:'teacher',status:'pending',displayName:'معلق'}],
  ['profiles/s2',studentProfile('s2',{studentId:'STU-2'})]];
async function sendMsg(db,cid,teacherUid,text,first){
  const batch=writeBatch(db);
  const conv=doc(db,'conversations',cid);
  const me=db._authUid;
  if(first)batch.set(conv,{studentUid:'s1',teacherUid,studentName:'أحمد',teacherName:'مدرس',lastAt:serverTimestamp(),lastText:text.slice(0,80),lastBy:'s1'});
  else batch.update(conv,{lastAt:serverTimestamp(),lastText:text.slice(0,80),lastBy:me});
  batch.set(doc(db,'conversations',cid,'messages',String(Math.random()).slice(2)),{senderUid:me,text,createdAt:serverTimestamp()});
  return batch.commit();
}
test('Spark chat: الطالب يبدأ محادثة مع مدرس نشط فقط والغريب لا يقرأ', {skip:!emulatorAvailable}, async()=>{
  await seed(chatBase());
  const s=user('s1');s._authUid='s1';
  await assertSucceeds(sendMsg(s,'s1_t1','t1','أهلاً',true));
  const s2=user('s2');
  await assertFails(getDoc(doc(s2,'conversations','s1_t1')));
  await assertFails(getDoc(doc(s2,'conversations','s1_t1','messages','x')));
  const t=user('t1');
  await assertSucceeds(getDoc(doc(t,'conversations','s1_t1')));
  await assertFails(sendMsg(s,'s1_t2','t2','مرحبا',true));
  const s3=user('s2');s3._authUid='s2';
  await assertFails(sendMsg(s3,'s1_t1','t1','تطفل',false));
});
test('Spark chat: حد الطول والمعدل والمدرس يرد ولا ينتحل', {skip:!emulatorAvailable}, async()=>{
  await seed([...chatBase(),['conversations/s1_t1',{studentUid:'s1',teacherUid:'t1',studentName:'أ',teacherName:'م',lastAt:T0,lastText:'x',lastBy:'s1'}]]);
  const t=user('t1');t._authUid='t1';
  await assertFails(sendMsg(t,'s1_t1','t1','x'.repeat(1001),false));
  await assertFails(sendMsg(t,'s1_t1','t1','',false));
  await assertSucceeds(sendMsg(t,'s1_t1','t1','أهلا بيك',false));
  await assertFails(sendMsg(t,'s1_t1','t1','تاني فورًا',false));
  await assertFails(setDoc(doc(t,'conversations','s1_t1','messages','z'),{senderUid:'s1',text:'انتحال',createdAt:serverTimestamp()}));
});

test('الوسائط: فيديو يوتيوب وملف درايف فقط، وصور الفصل لطلابه فقط وبحد الحجم', {skip:!emulatorAvailable}, async()=>{
  await seed([...base,
    ['profiles/t1',{uid:'t1',role:'teacher',status:'active',displayName:'م',grades:['1'],subjectId:'math',subjectIds:['math'],assignedClassIds:['c1']}],
    ['profiles/s1',studentProfile('s1')],
    ['profiles/s9',studentProfile('s9',{studentId:'STU-9',classId:'c9'})],
    ['teacherAssignments/t1_math_c1',{teacherUid:'t1',subjectId:'math',classId:'c1',grade:'1'}]]);
  const t=user('t1');
  const c={teacherUid:'t1',grade:'1',classId:'c1',subjectId:'math',title:'ع',published:true,createdAt:serverTimestamp()};
  await assertSucceeds(setDoc(doc(t,'content','v1'),{...c,type:'video',url:'https://www.youtube.com/watch?v=abc'}));
  await assertFails(setDoc(doc(t,'content','v2'),{...c,type:'video',url:'https://catbox.moe/x.mp4'}));
  await assertSucceeds(setDoc(doc(t,'content','f1'),{...c,type:'file',url:'https://drive.google.com/file/d/1/view'}));
  await assertFails(setDoc(doc(t,'content','f2'),{...c,type:'file',url:'https://evil.example/a.pdf'}));
  const img={teacherUid:'t1',grade:'1',classId:'c1',subjectId:'math',title:'صورة',data:'data:image/jpeg;base64,AAAA',createdAt:serverTimestamp()};
  await assertSucceeds(setDoc(doc(t,'images','i1'),img));
  await assertFails(setDoc(doc(t,'images','i2'),{...img,data:'data:image/jpeg;base64,'+'A'.repeat(961000)}));
  await assertFails(setDoc(doc(t,'images','i3'),{...img,data:'data:text/html;base64,AAAA'}));
  await assertFails(setDoc(doc(t,'images','i4'),{...img,subjectId:'ar'}));
  await assertSucceeds(getDoc(doc(user('s1'),'images','i1')));
  await assertFails(getDoc(doc(user('s9'),'images','i1')));
});

test('إدارة الحسابات: الإدارة توقف وتنقل وتعدل الطالب فقط دون تغيير الدور أو البريد، والطالب لا يفعل ذلك', {skip:!emulatorAvailable}, async()=>{
  await seed([...base,
    ['classes/c2',{name:'1/2',grade:'2',section:'2',year:'2026-2027',branch:'bac_med'}],
    ['profiles/s1',studentProfile('s1')],
    ['profiles/p1',{uid:'p1',email:'p1@example.com',displayName:'ولي أمر',role:'parent',status:'active',phone:'01012345678'}]]);
  const a=user('adm');
  await assertSucceeds(updateDoc(doc(a,'profiles','s1'),{status:'disabled',updatedBy:'adm',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(a,'profiles','s1'),{status:'active',classId:'c2',className:'1/2',grade:'2',branch:'bac_med'}));
  await assertFails(updateDoc(doc(a,'profiles','s1'),{classId:'c1',className:'1/1',grade:'3'}));
  await assertFails(updateDoc(doc(a,'profiles','s1'),{role:'admin'}));
  await assertFails(updateDoc(doc(a,'profiles','s1'),{email:'x@example.com'}));
  await assertFails(updateDoc(doc(a,'profiles','s1'),{status:'weird'}));
  await assertSucceeds(updateDoc(doc(a,'profiles','p1'),{displayName:'اسم جديد',phone:'01112345678'}));
  await assertSucceeds(updateDoc(doc(a,'profiles','s1'),{status:'graduated'}));
  const s=user('s1');
  await assertFails(updateDoc(doc(s,'profiles','s1'),{status:'active'}));
  await assertFails(updateDoc(doc(user('p1'),'profiles','s1'),{status:'disabled'}));
});

test('امتحانات وواجبات: المدرس المسند ينشر وطلاب الفصل فقط يقرؤون، ودفعة الحضور الجماعي بحدها', {skip:!emulatorAvailable}, async()=>{
  const students=Array.from({length:8},(_,i)=>[`profiles/s${i}`,studentProfile(`s${i}`,{studentId:`STU-${i}`})]);
  await seed([...base,
    ['profiles/t1',{uid:'t1',role:'teacher',status:'active',displayName:'م',grades:['1'],subjectId:'math',subjectIds:['math'],assignedClassIds:['c1']}],
    ['profiles/s9',studentProfile('s9',{studentId:'STU-9',classId:'c9'})],
    ['teacherAssignments/t1_math_c1',{teacherUid:'t1',subjectId:'math',classId:'c1',grade:'1'}],...students]);
  const t=user('t1');
  const task={teacherUid:'t1',grade:'1',classId:'c1',subjectId:'math',subjectName:'رياضيات',kind:'exam',title:'امتحان',dueDate:'2026-12-20',note:'',createdAt:serverTimestamp()};
  await assertSucceeds(setDoc(doc(t,'tasks','k1'),task));
  await assertFails(setDoc(doc(t,'tasks','k2'),{...task,subjectId:'ar'}));
  await assertFails(setDoc(doc(t,'tasks','k3'),{...task,dueDate:'غدا'}));
  await assertFails(setDoc(doc(t,'tasks','k4'),{...task,kind:'party'}));
  await assertSucceeds(getDoc(doc(user('s0'),'tasks','k1')));
  await assertFails(getDoc(doc(user('s9'),'tasks','k1')));
  const batch=writeBatch(t);
  for(let i=0;i<8;i++)batch.set(doc(t,'attendance',`c1_math_2026-11-25_s${i}`),{teacherUid:'t1',studentUid:`s${i}`,grade:'1',classId:'c1',subjectId:'math',date:'2026-11-25',present:i%2===0,createdAt:serverTimestamp()});
  await assertSucceeds(batch.commit());
  const again=writeBatch(t);
  for(let i=0;i<8;i++)again.set(doc(t,'attendance',`c1_math_2026-11-25_s${i}`),{teacherUid:'t1',studentUid:`s${i}`,grade:'1',classId:'c1',subjectId:'math',date:'2026-11-25',present:true,createdAt:serverTimestamp()});
  await assertSucceeds(again.commit());
  const gb=writeBatch(t);
  for(let i=0;i<8;i++)gb.set(doc(t,'grades',`g${i}`),{teacherUid:'t1',studentUid:`s${i}`,grade:'1',classId:'c1',subjectId:'math',subjectName:'رياضيات',title:'اختبار',score:15,max:20,createdAt:serverTimestamp()});
  await assertSucceeds(gb.commit());
});

test('جدول الحصص: الإدارة تكتب وطلاب الفصل فقط يقرؤون', {skip:!emulatorAvailable}, async()=>{
  await seed([...base,['profiles/s1',studentProfile('s1')],['profiles/s9',studentProfile('s9',{studentId:'STU-9',classId:'c9'})]]);
  const a=user('adm');
  await assertSucceeds(setDoc(doc(a,'timetables','c1'),{classId:'c1',grade:'1',cells:{'0_1':'الرياضيات'},updatedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(a,'timetables','c1'),{classId:'c1',grade:'2',cells:{},updatedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(user('s1'),'timetables','c1'),{classId:'c1',grade:'1',cells:{},updatedAt:serverTimestamp()}));
  await assertSucceeds(getDoc(doc(user('s1'),'timetables','c1')));
  await assertFails(getDoc(doc(user('s9'),'timetables','c1')));
});

test('رسائل التواصل: الزائر يكتب فقط والإدارة تقرأ وتعلّم',{skip:!emulatorAvailable},async()=>{
  await seed([...base]);
  const anon=environment.unauthenticatedContext().firestore();
  const row={name:'أحمد',email:'',message:'مرحبا',read:false,createdAt:serverTimestamp()};
  await assertSucceeds(setDoc(doc(anon,'contactMessages','m1'),row));
  await assertFails(setDoc(doc(anon,'contactMessages','m2'),{...row,read:true}));
  await assertFails(setDoc(doc(anon,'contactMessages','m3'),{...row,message:'x'.repeat(801)}));
  await assertFails(setDoc(doc(anon,'contactMessages','m4'),{...row,extra:1}));
  await assertFails(getDoc(doc(anon,'contactMessages','m1')));
  await assertFails(getDoc(doc(user('s1'),'contactMessages','m1')));
  const a=user('adm');
  await assertSucceeds(getDoc(doc(a,'contactMessages','m1')));
  await assertSucceeds(updateDoc(doc(a,'contactMessages','m1'),{read:true}));
  await assertFails(updateDoc(doc(a,'contactMessages','m1'),{message:'x'}));
  await assertFails(updateDoc(doc(anon,'contactMessages','m1'),{read:true}));
  await assertSucceeds(deleteDoc(doc(a,'contactMessages','m1')));
});

test('أخطاء المتصفح: أي مستخدم يكتب خطأه فقط والمالك وحده يقرأ', {skip:!emulatorAvailable}, async()=>{
  await seed([...base,['profiles/s1',studentProfile('s1')],['admins/own',{active:true,isOwner:true}]]);
  const s=user('s1');
  const row={uid:'s1',message:'x is undefined',source:'app.js',route:'/dashboard',agent:'UA',at:serverTimestamp()};
  await assertSucceeds(setDoc(doc(s,'clientErrors','e1'),row));
  await assertFails(setDoc(doc(s,'clientErrors','e2'),{...row,uid:'other'}));
  await assertFails(setDoc(doc(s,'clientErrors','e3'),{...row,message:'x'.repeat(301)}));
  await assertFails(getDoc(doc(s,'clientErrors','e1')));
  // القراءة انتقلت من أي أدمن إلى المالك فقط بعد إضافة نظام isOwner.
  await assertFails(getDoc(doc(user('adm'),'clientErrors','e1')));
  await assertSucceeds(getDoc(doc(user('own'),'clientErrors','e1')));
});

test('الأدمن: لا يصبح أحد أدمن بنفسه، الدعوة من أدمن نشط فقط وتُستخدم مرة واحدة', {skip:!emulatorAvailable}, async()=>{
  await seed([...base,['profiles/s1',studentProfile('s1')]]);
  const a=user('adm');
  const invite={email:'new@example.com',createdBy:'adm',createdAt:serverTimestamp(),claimed:false};
  await assertFails(setDoc(doc(user('s1'),'adminInvites','new@example.com'),{...invite,createdBy:'s1'}));
  await assertFails(setDoc(doc(a,'adminInvites','New@example.com'),{...invite,email:'New@example.com'}));
  await assertSucceeds(setDoc(doc(a,'adminInvites','new@example.com'),invite));
  const claim=async(uid,email,verified=true)=>{
    const db=environment.authenticatedContext(uid,{email,email_verified:verified}).firestore();
    const batch=writeBatch(db);
    batch.update(doc(db,'adminInvites',email),{claimed:true,claimedBy:uid,claimedAt:serverTimestamp()});
    batch.set(doc(db,'admins',uid),{active:true,email,displayName:'مدير جديد',createdBy:'adm',createdAt:serverTimestamp()});
    return batch.commit();
  };
  await assertFails(claim('x1','other@example.com'));
  await assertFails(claim('n1','new@example.com',false));
  await assertSucceeds(claim('n1','new@example.com'));
  await assertFails(claim('n2','new@example.com'));
  const self=user('s1');
  await assertFails(setDoc(doc(self,'admins','s1'),{active:true,email:'s1@example.com',displayName:'x',createdBy:'s1',createdAt:serverTimestamp()}));
  const n=user('n1');
  await assertSucceeds(getDoc(doc(n,'admins','adm')));
  await assertFails(updateDoc(doc(n,'admins','n1'),{active:false}));
  await assertSucceeds(updateDoc(doc(a,'admins','n1'),{active:false}));
  await assertFails(updateDoc(doc(a,'admins','adm'),{active:false}));
});

test('ولي الأمر يرى مهام وجدول فصل ابنه المرتبط فقط ويفقد ذلك عند فك الربط', {skip:!emulatorAvailable}, async()=>{
  await seed([...base,['classes/c2',{name:'1/2',grade:'1',section:'2',year:'2026-2027'}],
    ['profiles/s1',studentProfile('s1')],
    ['profiles/p1',{uid:'p1',email:'p1@example.com',displayName:'ولي',role:'parent',status:'active'}],
    ['profiles/p2',{uid:'p2',email:'p2@example.com',displayName:'ولي',role:'parent',status:'active'}],
    ['parentLinks/p1_s1',{parentUid:'p1',studentUid:'s1',active:true}],
    ['tasks/k1',{teacherUid:'t',grade:'1',classId:'c1',subjectId:'math',subjectName:'ر',kind:'exam',title:'ا',dueDate:'2026-12-20',note:'',createdAt:new Date()}],
    ['timetables/c1',{classId:'c1',grade:'1',cells:{},updatedAt:new Date()}]]);
  const p1=user('p1'),p2=user('p2');
  await assertFails(getDoc(doc(p1,'tasks','k1')));
  await assertSucceeds(setDoc(doc(p1,'parentClassAccess','p1_c1'),{parentUid:'p1',classId:'c1',studentUid:'s1'}));
  await assertFails(setDoc(doc(p1,'parentClassAccess','p1_c2'),{parentUid:'p1',classId:'c2',studentUid:'s1'}));
  await assertFails(setDoc(doc(p2,'parentClassAccess','p2_c1'),{parentUid:'p2',classId:'c1',studentUid:'s1'}));
  await assertSucceeds(getDoc(doc(p1,'tasks','k1')));
  await assertSucceeds(getDoc(doc(p1,'timetables','c1')));
  await assertFails(getDoc(doc(p2,'tasks','k1')));
  await environment.withSecurityRulesDisabled(async c=>updateDoc(doc(c.firestore(),'parentLinks/p1_s1'),{active:false}));
  await assertFails(getDoc(doc(p1,'tasks','k1')));
});

test('إيصال القراءة: كل طرف يكتب وقته فقط',{skip:!emulatorAvailable},async()=>{
  await seed([...chatBase(),['conversations/s1_t1',{studentUid:'s1',teacherUid:'t1',studentName:'أ',teacherName:'م',lastAt:T0,lastText:'x',lastBy:'s1'}]]);
  const s=user('s1'),t=user('t1');
  await assertSucceeds(updateDoc(doc(t,'conversations','s1_t1'),{teacherReadAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(t,'conversations','s1_t1'),{studentReadAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(s,'conversations','s1_t1'),{teacherReadAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(s,'conversations','s1_t1'),{studentReadAt:Timestamp.fromMillis(1)}));
  await assertSucceeds(updateDoc(doc(s,'conversations','s1_t1'),{studentReadAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(user('s2'),'conversations','s1_t1'),{studentReadAt:serverTimestamp()}));
});
