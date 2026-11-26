import fs from 'node:fs';
import test, {after, before} from 'node:test';
import {assertFails,assertSucceeds,initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {Timestamp,deleteDoc,doc,getDoc,serverTimestamp,setDoc,updateDoc,writeBatch} from 'firebase/firestore';

const emulatorAvailable=Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let environment;
before(async()=>{
  if(!emulatorAvailable)return;
  environment=await initializeTestEnvironment({projectId:'demo-tracks-rules',firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
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
  ['classes/c2',{name:'2/1',grade:'2',section:'1',year:'2026-2027',branch:'bac_med'}],
  ['classes/c3',{name:'3/1',grade:'3',section:'1',year:'2026-2027',branch:'math'}],
  ['subjects/math',{name:'الرياضيات'}],
  ['admins/adm',{active:true}]
];
const studentProfile=(uid,over={})=>({uid,email:`${uid}@example.com`,displayName:'أحمد محمد علي حسن',role:'student',status:'active',phone:'01012345678',createdAt:serverTimestamp(),consentAt:serverTimestamp(),studentId:'STU-ABCDEFGH',grade:'1',branch:'',classId:'c1',className:'1/1',rosterVerified:false,...over});

async function register(uid,data){
  const database=user(uid);
  const batch=writeBatch(database);
  batch.set(doc(database,'profiles',uid),data);
  batch.set(doc(database,'studentIds',data.studentId),{uid});
  return batch.commit();
}
test('tracks: student track must match grade and class track',{skip:!emulatorAvailable},async()=>{
  await seed(base);
  await assertSucceeds(register('a',studentProfile('a',{grade:'2',branch:'bac_med',classId:'c2',studentId:'STU-AAAAAAAA'})));
  await seed(base);
  await assertFails(register('b',studentProfile('b',{grade:'2',branch:'bac_eng',classId:'c2',studentId:'STU-BBBBBBBB'})));
  await assertFails(register('b',studentProfile('b',{grade:'2',branch:'',classId:'c2',studentId:'STU-BBBBBBBB'})));
  await assertFails(register('b',studentProfile('b',{grade:'1',branch:'science',classId:'c1',studentId:'STU-BBBBBBBB'})));
  await assertFails(register('b',studentProfile('b',{grade:'3',branch:'bac_med',classId:'c3',studentId:'STU-BBBBBBBB'})));
  await assertSucceeds(register('c',studentProfile('c',{grade:'3',branch:'math',classId:'c3',studentId:'STU-CCCCCCCC'})));
});
