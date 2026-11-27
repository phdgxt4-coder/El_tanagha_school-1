import assert from 'node:assert/strict';
import fs from 'node:fs';
import test, {after, before} from 'node:test';
import {assertFails,assertSucceeds,initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection,doc,getDoc,getDocs,query,serverTimestamp,setDoc,updateDoc,Timestamp,increment} from 'firebase/firestore';

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

const baseReport=(uid)=>({
  fingerprint:'abcdef0123456789',kind:'error',message:'رسالة خطأ تجريبية',source:'app.js',route:'/dashboard',
  line:0,stack:'',agent:'test-agent',release:'abc123',uid,status:'open',count:1,
  firstAt:serverTimestamp(),lastAt:serverTimestamp(),lastRoute:'/dashboard',lastRelease:'abc123',clientAtIso:'2026-11-27T00:00:00.000Z'
});

const ownerSeed=[
  ['admins/owner-uid',{active:true,email:'owner@example.com',displayName:'المالك',isOwner:true}],
  ['admins/admin-uid',{active:true,email:'admin@example.com',displayName:'مدير عادي'}],
  ['profiles/user-uid',{uid:'user-uid',role:'student',status:'active'}]
];

test('المستخدم المسجل ينشئ تقرير خطأ سليمًا ولا ينشئ تقريرًا مخالفًا', {skip:!emulatorAvailable}, async()=>{
  await seed([['profiles/user-uid',{uid:'user-uid',role:'student',status:'active'}]]);
  const db=environment.authenticatedContext('user-uid').firestore();
  await assertSucceeds(setDoc(doc(db,'errorReports/abcdef0123456789'),baseReport('user-uid')));
  // معرّف ليس بصمة 16 hex
  await assertFails(setDoc(doc(db,'errorReports/not-a-fingerprint'),{...baseReport('user-uid'),fingerprint:'not-a-fingerprint'}));
  // البصمة لا تطابق المعرّف
  await assertFails(setDoc(doc(db,'errorReports/0000000000000000'),baseReport('user-uid')));
  // uid لا يطابق المستخدم
  await assertFails(setDoc(doc(db,'errorReports/1111111111111111'),{...baseReport('someone-else'),fingerprint:'1111111111111111'}));
  // حالة غير open عند الإنشاء
  await assertFails(setDoc(doc(db,'errorReports/2222222222222222'),{...baseReport('user-uid'),fingerprint:'2222222222222222',status:'resolved'}));
});

test('غير المسجل لا يكتب تقارير أخطاء', {skip:!emulatorAvailable}, async()=>{
  await seed([]);
  const db=environment.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db,'errorReports/abcdef0123456789'),{...baseReport('anon'),firstAt:Timestamp.now(),lastAt:Timestamp.now()}));
});

test('القراءة من errorReports للمالك فقط وليست للأدمن العادي', {skip:!emulatorAvailable}, async()=>{
  await seed([...ownerSeed,['errorReports/abcdef0123456789',{...baseReport('user-uid'),firstAt:Timestamp.now(),lastAt:Timestamp.now()}]]);
  const ownerDb=environment.authenticatedContext('owner-uid').firestore();
  const adminDb=environment.authenticatedContext('admin-uid').firestore();
  const userDb=environment.authenticatedContext('user-uid').firestore();
  await assertSucceeds(getDoc(doc(ownerDb,'errorReports/abcdef0123456789')));
  await assertSucceeds(getDocs(query(collection(ownerDb,'errorReports'))));
  await assertFails(getDoc(doc(adminDb,'errorReports/abcdef0123456789')));
  await assertFails(getDocs(query(collection(adminDb,'errorReports'))));
  await assertFails(getDoc(doc(userDb,'errorReports/abcdef0123456789')));
});

test('زيادة العدّاد تعمل بعد فاصل 30 ثانية فقط', {skip:!emulatorAvailable}, async()=>{
  const old=Timestamp.fromMillis(Date.now()-60000);
  await seed([...ownerSeed,['errorReports/abcdef0123456789',{...baseReport('user-uid'),firstAt:old,lastAt:old}]]);
  const db=environment.authenticatedContext('user-uid').firestore();
  await assertSucceeds(updateDoc(doc(db,'errorReports/abcdef0123456789'),{count:increment(1),lastAt:serverTimestamp(),lastRoute:'/results',lastRelease:'abc123'}));
  // الزيادة الثانية فورًا مرفوضة (الفاصل الزمني)
  await assertFails(updateDoc(doc(db,'errorReports/abcdef0123456789'),{count:increment(1),lastAt:serverTimestamp(),lastRoute:'/results',lastRelease:'abc123'}));
  // لا يجوز تغيير الرسالة مع العدّاد
  await assertFails(updateDoc(doc(db,'errorReports/abcdef0123456789'),{message:'تغيير خبيث'}));
});

test('تعديل الحالة والحل للمالك فقط', {skip:!emulatorAvailable}, async()=>{
  await seed([...ownerSeed,['errorReports/abcdef0123456789',{...baseReport('user-uid'),firstAt:Timestamp.now(),lastAt:Timestamp.now()}]]);
  const ownerDb=environment.authenticatedContext('owner-uid').firestore();
  const adminDb=environment.authenticatedContext('admin-uid').firestore();
  const userDb=environment.authenticatedContext('user-uid').firestore();
  await assertSucceeds(updateDoc(doc(ownerDb,'errorReports/abcdef0123456789'),{status:'resolved',solution:'أصلحناه',resolvedAt:serverTimestamp(),resolvedBy:'owner-uid',autoResolved:false}));
  await assertFails(updateDoc(doc(adminDb,'errorReports/abcdef0123456789'),{status:'open'}));
  await assertFails(updateDoc(doc(userDb,'errorReports/abcdef0123456789'),{status:'open'}));
  // حالة غير معروفة مرفوضة حتى للمالك
  await assertFails(updateDoc(doc(ownerDb,'errorReports/abcdef0123456789'),{status:'deleted'}));
});

test('سجل clientErrors القديم يقرأه المالك فقط بعد الآن', {skip:!emulatorAvailable}, async()=>{
  await seed([...ownerSeed,['clientErrors/old-1',{uid:'user-uid',message:'قديم',source:'a.js',route:'/',agent:'x',at:Timestamp.now()}]]);
  const ownerDb=environment.authenticatedContext('owner-uid').firestore();
  const adminDb=environment.authenticatedContext('admin-uid').firestore();
  await assertSucceeds(getDocs(query(collection(ownerDb,'clientErrors'))));
  await assertFails(getDocs(query(collection(adminDb,'clientErrors'))));
});

test('لا يستطيع أدمن إيقاف المالك ولا كتابة isOwner', {skip:!emulatorAvailable}, async()=>{
  await seed(ownerSeed);
  const adminDb=environment.authenticatedContext('admin-uid').firestore();
  // إيقاف المالك مرفوض
  await assertFails(updateDoc(doc(adminDb,'admins/owner-uid'),{active:false}));
  // إيقاف أدمن عادي آخر مسموح
  await seed([...ownerSeed,['admins/admin-two',{active:true,email:'two@example.com',displayName:'مدير ثان'}]]);
  await assertSucceeds(updateDoc(doc(adminDb,'admins/admin-two'),{active:false}));
  // منح النفس isOwner مرفوض (الحقول محصورة في active)
  await assertFails(updateDoc(doc(adminDb,'admins/admin-uid'),{isOwner:true}));
});

test('تعليقات الصفحات ونتائج المراجعة للمالك فقط', {skip:!emulatorAvailable}, async()=>{
  await seed(ownerSeed);
  const ownerDb=environment.authenticatedContext('owner-uid').firestore();
  const adminDb=environment.authenticatedContext('admin-uid').firestore();
  const note={route:'/dashboard',text:'ملاحظة',solution:'',done:false,createdAt:serverTimestamp(),createdBy:'owner-uid'};
  await assertSucceeds(setDoc(doc(ownerDb,'errorNotes/n1'),note));
  await assertFails(setDoc(doc(adminDb,'errorNotes/n2'),note));
  await assertFails(getDoc(doc(adminDb,'errorNotes/n1')));
  const run={schema:'tanagha-review/1',generatedAtIso:'2026-11-27',commit:'abc123',summary:{total:0},findings:[],createdAt:serverTimestamp(),createdBy:'owner-uid'};
  await assertSucceeds(setDoc(doc(ownerDb,'reviewRuns/r1'),run));
  await assertFails(setDoc(doc(adminDb,'reviewRuns/r2'),run));
  // نتائج المراجعة لا تُعدَّل أبدًا
  await assertFails(updateDoc(doc(ownerDb,'reviewRuns/r1'),{summary:{total:9}}));
});
