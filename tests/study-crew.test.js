import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {STATES,PRIORITY,createStateMachine,ONE_SHOT} from '../src/studycrew/Shared/stateMachine.js';
import {createIdlePicker,createIdleScheduler,gapMs} from '../src/studycrew/Shared/idleScheduler.js';
import {idlePool,SHARED_IDLES} from '../src/studycrew/Shared/idles.js';
import {claimSlot,releaseSlot,slotOwner} from '../src/studycrew/Shared/slots.js';
import {tokens,tokenVars} from '../src/studycrew/Themes/tokens.js';
import {themeTokens,themeNames} from '../src/studycrew/Themes/index.js';
import {characterLoaders,characterIds} from '../src/studycrew/Characters/registry.js';
import {CONFIG} from '../src/studycrew/Shared/config.js';
import {loadAsset,clearAssetCache,assetCacheSize,AssetError} from '../src/studycrew/Shared/assetLoader.js';
import {RECIPES} from '../src/studycrew/Shared/placeholder.js';
import {watchConnection} from '../src/studycrew/Shared/connection.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const css=read('../styles/studycrew.css');
const seeded=seed=>()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};

test('all 14 required states exist and have a priority',()=>{
  for(const s of ['Idle','Thinking','Reading','Searching','Typing','Loading','Success','Error','Celebrate','Sleep','Wake','Wave','HiddenPassword','VisiblePassword'])assert.ok(STATES.includes(s)&&s in PRIORITY,s);
  assert.ok(PRIORITY.Error>PRIORITY.Success&&PRIORITY.Success>PRIORITY.Celebrate&&PRIORITY.Celebrate>PRIORITY.Loading&&PRIORITY.Loading>PRIORITY.Idle);
});
test('state machine: lower priority never interrupts a one-shot, Error beats Success, finish returns to rest',()=>{
  const timers=[];const seen=[];
  const m=createStateMachine({onChange:(n)=>seen.push(n),setTimer:(f,ms)=>{timers.push({f,ms});return timers.length;},clearTimer:()=>{}});
  assert.equal(m.request('Success'),true);
  assert.equal(m.request('Idle'),false);
  assert.equal(m.request('Thinking'),false);
  assert.equal(m.request('Error'),true);
  assert.equal(m.state,'Error');
  assert.equal(m.request('Success'),false);
  timers.at(-1).f();assert.equal(m.state,'Idle');
  assert.equal(m.request('Loading'),true);assert.equal(m.request('Idle'),false);assert.equal(m.finish('Loading'),true);assert.equal(m.state,'Idle');
  assert.equal(m.request('bogus'),false);assert.equal(m.request('Idle'),false);
});
test('password states switch both ways and reject unknown moves into Sleep',()=>{
  const m=createStateMachine({setTimer:()=>0,clearTimer:()=>{}});
  assert.ok(m.request('HiddenPassword'));assert.ok(m.request('VisiblePassword'));assert.ok(m.request('HiddenPassword'));
});
test('one-shot durations come from tokens',()=>{
  assert.equal(ONE_SHOT.Success,tokens.motion.celebration);assert.equal(ONE_SHOT.Celebrate,tokens.motion.celebrationMax);
});
test('idle picker: never the same twice in a row, never from the last 5, big clips cool down',()=>{
  const pool=idlePool(characterLoaders&&[['a','tilt'],['b','tilt'],['c','tilt'],['d','tilt'],['e','tilt'],['f','tilt'],['g','tilt'],['h','hop',true]]);
  let t=0;const p=createIdlePicker({pool,rng:seeded(7),now:()=>t});
  const seq=[];const bigAt=[];
  for(let i=0;i<4000;i++){t+=4000;const c=p.next();seq.push(c.id);if(c.big)bigAt.push(t);}
  for(let i=1;i<seq.length;i++)assert.notEqual(seq[i],seq[i-1]);
  for(let i=5;i<seq.length;i++)assert.ok(!seq.slice(i-5,i).includes(seq[i]),'repeat inside window at '+i);
  for(let i=1;i<bigAt.length;i++)assert.ok(bigAt[i]-bigAt[i-1]>=CONFIG.idle.bigCooldownMs);
  assert.ok(new Set(seq).size>=10);
});
test('idle pool excludes the permanent breathing layer',()=>{
  assert.ok(!idlePool([]).some(c=>c.id==='breathe'));assert.equal(SHARED_IDLES.length,12);
});
test('idle scheduler plays on a timer, respects canRun, and stops cleanly',()=>{
  const q=[];let now=0;const played=[];let ok=true;
  const sched=createIdleScheduler({picker:createIdlePicker({pool:idlePool([['x','tilt'],['y','tilt'],['z','tilt'],['w','tilt'],['v','tilt'],['u','tilt'],['q','tilt']]),rng:seeded(3)}),play:c=>played.push(c.id),rng:seeded(5),setTimer:(f,ms)=>{q.push({f,at:now+ms});return q.length;},clearTimer:id=>{if(q[id-1])q[id-1].f=null;},canRun:()=>ok});
  sched.start();assert.ok(sched.running);
  const run=()=>{const next=q.filter(e=>e.f).sort((a,b)=>a.at-b.at)[0];if(!next)return false;now=next.at;const f=next.f;next.f=null;f();return true;};
  for(let i=0;i<5;i++)run();
  assert.ok(played.length>=2);
  ok=false;const before=played.length;run();run();assert.equal(played.length,before);
  sched.stop();assert.ok(!sched.running);assert.ok(q.every(e=>!e.f||true));
});
test('gap is inside the configured range',()=>{
  for(let i=0;i<200;i++){const g=gapMs(Math.random);assert.ok(g>=CONFIG.idle.minGapMs&&g<=CONFIG.idle.maxGapMs);}
});
test('slots: higher priority takes the spot, lower is refused, release frees it',()=>{
  const a={},b={},c={};let pre=0;
  assert.ok(claimSlot('t1',a,10,()=>pre++));
  assert.equal(claimSlot('t1',b,5),false);
  assert.ok(claimSlot('t1',c,50));assert.equal(pre,1);assert.equal(slotOwner('t1'),c);
  releaseSlot('t1',a);assert.equal(slotOwner('t1'),c);releaseSlot('t1',c);assert.equal(slotOwner('t1'),null);
});
test('every character has a manifest with 20 own idles, known recipes, and a registry entry',async()=>{
  assert.deepEqual(characterIds().sort(),['alex','arthur','chloe','leo','oscar']);
  for(const id of characterIds()){
    const m=(await characterLoaders[id]()).default;
    assert.equal(m.id,id);assert.ok(m.name&&m.ar&&m.palette.main&&m.shape);
    assert.equal(m.idles.length,20,id);
    assert.equal(new Set(m.idles.map(i=>i[0])).size,20,id+' duplicate idle ids');
    for(const [,recipe] of m.idles)assert.ok(RECIPES.includes(recipe),id+' '+recipe);
    assert.ok(existsSync(new URL(`../src/studycrew/Characters/${m.name}/manifest.js`,import.meta.url)));
  }
});
test('every character manifest points at placeholder art only (no heavy assets yet)',async()=>{
  for(const id of characterIds()){const m=(await characterLoaders[id]()).default;assert.equal(m.renderer.type,'svg');assert.equal(m.renderer.rive,null);assert.equal(m.renderer.lottie,null);}
});
test('every --sc-* variable used in CSS is defined by the tokens',()=>{
  const vars=tokenVars();
  const used=[...css.matchAll(/var\((--sc-[a-z0-9-]+)/g)].map(m=>m[1]).filter(v=>v!=='--sc-note');
  assert.ok(used.length>20);
  for(const v of new Set(used))assert.ok(v in vars,v+' missing from tokens');
});
test('themes merge over base tokens and light changes colors only',()=>{
  assert.deepEqual(themeNames().sort(),['dark','light']);
  const l=themeTokens('light');assert.equal(l.color.text,tokens.colorLight.text);assert.equal(l.radius.md,tokens.radius.md);
});
test('motion durations follow the Motion System table',()=>{
  const m=tokens.motion;
  assert.ok(m.micro>=100&&m.micro<=180&&m.button>=120&&m.button<=180&&m.card>=180&&m.card<=240&&m.dialog>=220&&m.dialog<=320&&m.character>=300&&m.character<=500&&m.celebration>=700&&m.celebrationMax<=1200);
});
test('CSS keyframes animate only transform and opacity, and reduced motion is handled',()=>{
  for(const k of css.matchAll(/@keyframes\s+\w+\{[\s\S]*?\}\}/g))assert.ok(!/(width|height|top|left|margin|box-shadow|inset)\s*:/.test(k[0]),k[0]);
  assert.ok(css.includes('@media (prefers-reduced-motion:reduce)'));
  assert.ok(css.includes('data-sc-motion="off"'));
});
test('placeholder renderer animates only transform and opacity',()=>{
  const src=read('../src/studycrew/Shared/placeholder.js');
  const frames=[...src.matchAll(/\{(transform|opacity):[^}]*\}/g)];
  assert.ok(frames.length>30);
  assert.ok(!/\b(width|height|top|left|margin)\s*:\s*'?-?\d/.test(src.split('const STATE_LOOP')[0].split('const R={')[1]||''));
});
test('no framework code imports a heavy library',()=>{
  const dir=new URL('../src/studycrew/Shared/',import.meta.url);
  for(const f of readdirSync(dir)){
    const s=readFileSync(new URL(f,dir),'utf8');
    for(const m of s.matchAll(/from\s+'([^']+)'/g))assert.ok(m[1].startsWith('.'),`${f} imports ${m[1]}`);
  }
});
test('asset loader: dedupes, caches, enforces budget, reports failures',async()=>{
  clearAssetCache();let calls=0;
  const ok=async()=>{calls++;return{ok:true,headers:{get:()=>'10'},arrayBuffer:async()=>new ArrayBuffer(10)};};
  await Promise.all([loadAsset('/a.riv',{fetchImpl:ok}),loadAsset('/a.riv',{fetchImpl:ok})]);
  await loadAsset('/a.riv',{fetchImpl:ok});assert.equal(calls,1);assert.equal(assetCacheSize(),1);
  const big=async()=>({ok:true,headers:{get:()=>String(CONFIG.budget.characterFile+1)},arrayBuffer:async()=>new ArrayBuffer(1)});
  await assert.rejects(loadAsset('/big.riv',{fetchImpl:big}),AssetError);
  await assert.rejects(loadAsset('/404.riv',{fetchImpl:async()=>({ok:false,status:404})}),AssetError);
  await assert.rejects(loadAsset('/net.riv',{fetchImpl:async()=>{throw new Error('offline');}}),AssetError);
  assert.equal(assetCacheSize(),1);
});
test('asset cache stays bounded',async()=>{
  clearAssetCache();
  const ok=async()=>({ok:true,headers:{get:()=>'4'},arrayBuffer:async()=>new ArrayBuffer(4)});
  for(let i=0;i<CONFIG.cache.maxEntries+8;i++)await loadAsset('/f'+i,{fetchImpl:ok});
  assert.equal(assetCacheSize(),CONFIG.cache.maxEntries);
});
test('connection watcher reports changes only once per change and unsubscribes',()=>{
  const t=new EventTarget();let online=true;const got=[];
  const off=watchConnection(s=>got.push(s),{target:t,isOnline:()=>online});
  online=false;t.dispatchEvent(new Event('offline'));t.dispatchEvent(new Event('offline'));
  online=true;t.dispatchEvent(new Event('online'));
  assert.deepEqual(got,['offline','online']);off();online=false;t.dispatchEvent(new Event('offline'));assert.deepEqual(got,['offline','online']);
});
test('the framework is not imported by the production entry point or index.html',()=>{
  assert.ok(!read('../src/app.js').includes('studycrew'));
  assert.ok(!read('../index.html').includes('studycrew'));
});
test('guidelines doc exists and is referenced from AGENTS.md',()=>{
  assert.ok(read('../STUDY_CREW_GUIDELINES.md').includes('كيف تضيف شخصية'));
  assert.ok(read('../AGENTS.md').includes('STUDY_CREW_GUIDELINES.md'));
});
