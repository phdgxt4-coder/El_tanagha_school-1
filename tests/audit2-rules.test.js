import fs from 'node:fs';
import test, {after, before} from 'node:test';
import {assertFails,assertSucceeds,initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {Timestamp,deleteDoc,doc,getDoc,serverTimestamp,setDoc,updateDoc,writeBatch} from 'firebase/firestore';

const emulatorAvailable=Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let environment;
before(async()=>{
  if(!emulatorAvailable)return;
  environment=await initializeTestEnvironment({projectId:'demo-audit2-rules',firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
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
  ['classes/c3',{name:'3/1',grade:'3',section:'1',year:'2026-2027'}],
  ['subjects/math',{name:'الرياضيات'}],
  ['admins/adm',{active:true}]
];
const studentProfile=(uid,over={})=>({uid,email:`${uid}@example.com`,displayName:'أحمد محمد علي حسن',role:'student',status:'active',phone:'01012345678',createdAt:serverTimestamp(),consentAt:serverTimestamp(),studentId:'STU-ABCDEFGH',grade:'1',branch:'',classId:'c1',className:'1/1',rosterVerified:false,...over});


const profileDoc=(over={})=>({uid:'s1',email:'s1@example.com',displayName:'أحمد محمد علي حسن',role:'student',status:'active',phone:'01012345678',studentId:'STU-ABCDEFGH',grade:'1',branch:'',classId:'c1',className:'1/1',rosterVerified:false,...over});
const admin=()=>environment.authenticatedContext('adm',{email:'adm@example.com',email_verified:true}).firestore();
test('admin moves a student to a class with a track (branch is updated with it)',{skip:!emulatorAvailable},async()=>{
  await seed([...base,['profiles/s1',profileDoc()]]);
  await assertSucceeds(updateDoc(doc(admin(),'profiles/s1'),{classId:'c2',className:'2/1',grade:'2',branch:'bac_med',updatedBy:'adm',updatedAt:serverTimestamp()}));
  await seed([...base,['profiles/s1',profileDoc()]]);
  await assertFails(updateDoc(doc(admin(),'profiles/s1'),{classId:'c2',className:'2/1',grade:'2',branch:'bac_eng',updatedBy:'adm',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(admin(),'profiles/s1'),{branch:'hacker',updatedBy:'adm',updatedAt:serverTimestamp()}));
});
test('legacy top-level messages collection can no longer be created by teachers or parents',{skip:!emulatorAvailable},async()=>{
  await seed([...base,['profiles/t1',profileDoc({uid:'t1',email:'t1@example.com',role:'teacher'})]]);
  const teacher=environment.authenticatedContext('t1',{email:'t1@example.com',email_verified:true}).firestore();
  await assertFails(setDoc(doc(teacher,'messages/m1'),{fromUid:'x',toUid:'y',text:'spoof'}));
});
