// Live smoke: 16 routes x 360/390, reports JS errors, overflow, broken images. Usage: node scripts/live-smoke.mjs  (needs google-chrome, Node 22)
import {spawn} from 'node:child_process';import fs from 'node:fs';
const chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=9488','about:blank'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,4000));
const tabs=await (await fetch('http://localhost:9488/json')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();let errs=[];
ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&pend.has(d.id)){pend.get(d.id)(d.result);pend.delete(d.id)}
 if(d.method==='Runtime.exceptionThrown')errs.push('EXC '+(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text).slice(0,120));
 if(d.method==='Log.entryAdded'&&d.params.entry.level==='error')errs.push('LOG '+d.params.entry.text.slice(0,100)+' '+(d.params.entry.url||'').slice(0,80));};
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result?.value;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await send('Runtime.enable');await send('Page.enable');await send('Log.enable');
const B=process.env.SITE||'https://phdgxt4-coder.github.io/El_tanagha_school-1/';
const routes=['','subjects/','subjects/ar/','teachers/','news/','schedule/','results/','contact/','privacy/','login/','login/student/','login/parent/','login/teacher/','login/admin/','dashboard/','admin/join/'];
for(const [W,H] of [[360,640],[390,844]]){
 await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:true});
 for(const r of routes){errs=[];await send('Page.navigate',{url:B+r});await sleep(2800);
  const m=await ev(`JSON.stringify({t:document.title.slice(0,30),sw:document.documentElement.scrollWidth,iw:innerWidth,h1:(document.querySelector('h1')||{}).textContent?.slice(0,40),imgsBroken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).length,forms:document.forms.length,links:document.querySelectorAll('a[href]').length})`);
  console.log(W,r||'/',m,errs.length?JSON.stringify([...new Set(errs)].slice(0,3)):'');
  if(W===360&&['','login/student/','login/teacher/','dashboard/'].includes(r)){const x=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`/tmp/live-${r.replace(/\W/g,'')||'home'}-360.png`,Buffer.from(x.data,'base64'));}
 }}
chrome.kill();process.exit(0);
