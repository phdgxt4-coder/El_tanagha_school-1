import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {daypart,season} from '../src/studycrew/Living/world.js';
import {focusFromContext,policy} from '../src/studycrew/Living/focus.js';
import {tierFor,capTier} from '../src/studycrew/Living/celebrations.js';
import {createDelight,createFrustration,createPicker,COPY} from '../src/studycrew/Living/emotion.js';
import {detectTier,createGuard} from '../src/studycrew/Living/quality.js';
import {createDirector} from '../src/studycrew/Living/director.js';
const D=(f,extra={})=>createDirector({rand:()=>0,getFocus:()=>f,prefs:()=>({sound:true,haptics:true}),...extra});
test('dayparts wrap midnight',()=>{assert.equal(daypart(new Date(2026,0,1,23)),'night');assert.equal(daypart(new Date(2026,0,1,3)),'night');assert.equal(daypart(new Date(2026,0,1,9)),'morning');});
test('Ramadan 2026 and Eid detected from Hijri calendar',()=>{
  assert.equal(season(new Date(2026,2,1,12)),'ramadan');
  assert.equal(season(new Date(2026,2,21,12)),'eid');
});
test('exam is absolute silence for every event',()=>{
  const d=D('exam');
  for(const e of ['fail','success','score','firstExam','achievement','streak','return','tick'])assert.equal(d(e,{score:100,streak:30,longAway:true}).show,false,e);
});
test('focus detection: exam wins',()=>{assert.equal(focusFromContext({route:'/exam/take/12',typing:true}),'exam');assert.equal(focusFromContext({examActive:true,reading:true}),'exam');assert.equal(focusFromContext({reading:true}),'reading');});
test('celebration tiers scale with value',()=>{
  assert.equal(tierFor('save'),'glow');assert.equal(tierFor('score',{score:90}),'sparkles');assert.equal(tierFor('score',{score:100}),'confetti');
  assert.equal(tierFor('score',{score:60}),'none');assert.equal(tierFor('streak',{streak:7}),'full');assert.equal(capTier('full','glow'),'glow');
});
test('reading mode: no bubbles, no motion, glow at most',()=>{
  const r=D('reading')('score',{score:100});assert.equal(r.message,'');assert.ok(['none','glow'].includes(r.tier));assert.equal(r.state,'Idle');
});
test('failure copy is encouraging, not red-only; repeated error switches to help',()=>{
  const d=D('browsing');const a=d('fail',{kind:'quiz'});assert.ok(COPY.fail.includes(a.message));assert.equal(a.state,'Error');
  const b=d('fail',{kind:'quiz'});assert.equal(b.message,COPY.help.generic);
  assert.equal(d('fail',{kind:'offline'}).retry,true);
});
test('welcome back only after a long absence',()=>{const d=D('browsing');assert.equal(d('return',{longAway:false}).show,false);assert.ok(d('return',{longAway:true}).message);});
test('delight is rare: gap and daily cap',()=>{
  let t=0;const f=createDelight({now:()=>t,rand:()=>0});
  assert.equal(f(),true);t+=1000;assert.equal(f(),false);t+=25*60000;assert.equal(f(),true);t+=25*60000;assert.equal(f(),true);t+=25*60000;assert.equal(f(),false);
});
test('picker never repeats back to back',()=>{const p=createPicker(()=>0);const a=p('fail'),b=p('fail');assert.notEqual(a,b);});
test('frustration window',()=>{let t=0;const f=createFrustration({now:()=>t});assert.equal(f.record('x'),false);t+=1000;assert.equal(f.record('x'),true);t+=100000;assert.equal(f.record('x'),false);});
test('quality tiers and guard only downgrades',()=>{
  assert.equal(detectTier({deviceMemory:1,hardwareConcurrency:8}),0);assert.equal(detectTier({deviceMemory:8,hardwareConcurrency:8,saveData:false}),2);
  const g=createGuard({tier:2});for(let i=0;i<8;i++)g.frame(80);assert.equal(g.tier(),1);for(let i=0;i<100;i++)g.frame(5);assert.equal(g.tier(),1);
});
test('low quality caps tier at glow',()=>{assert.equal(D('browsing',{quality:()=>0})('score',{score:100}).tier,'glow');});
test('living layer is not imported by the app entry',()=>{
  for(const f of ['../src/app.js','../index.html'])assert.ok(!/studycrew|Living/.test(readFileSync(new URL(f,import.meta.url),'utf8')),f);
});
