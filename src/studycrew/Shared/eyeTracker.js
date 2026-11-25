/* One shared pointer listener for all characters. rAF-throttled, passive, zero work when nobody subscribes.
   Targets in priority order: popup, typing input, important button, pointer, free look. */
import {coarsePointer,reducedMotion} from './prefs.js';
import {CONFIG} from './config.js';
const subs=new Set();
let pointer=null,raf=0,attached=false,touchUntil=0,lastRect=null;
export const PRIORITY_TARGETS=['[role="dialog"]','input:not([type="password"]):focus,textarea:focus','[data-crew-target]'];
function targetPoint(){
  if(typeof document==='undefined')return pointer;
  for(const sel of PRIORITY_TARGETS){
    const el=document.querySelector(sel);
    if(el){const r=el.getBoundingClientRect();if(r.width&&r.height)return{x:r.left+r.width/2,y:r.top+r.height/2};}
  }
  if(pointer&&(!coarsePointer()||Date.now()<touchUntil))return pointer;
  return null;
}
const flush=()=>{
  raf=0;
  const p=targetPoint();
  subs.forEach(s=>{
    const r=s.el.getBoundingClientRect();
    if(!r.width)return;
    if(!p){s.look(0,0);return;}
    const dx=(p.x-(r.left+r.width/2))/Math.max(CONFIG.tracking.minRange,innerWidth/2),dy=(p.y-(r.top+r.height/2))/Math.max(CONFIG.tracking.minRange,innerHeight/2);
    s.look(Math.max(-1,Math.min(1,dx)),Math.max(-1,Math.min(1,dy)));
  });
};
const schedule=()=>{if(!raf&&subs.size)raf=requestAnimationFrame(flush);};
const move=e=>{pointer={x:e.clientX,y:e.clientY};if(e.pointerType==='touch')touchUntil=Date.now()+CONFIG.tracking.touchHoldMs;schedule();};
const leave=()=>{pointer=null;schedule();};
function attach(){
  if(attached||typeof addEventListener!=='function')return;
  attached=true;
  addEventListener('pointermove',move,{passive:true});addEventListener('pointerdown',move,{passive:true});
  addEventListener('focusin',schedule,{passive:true});document.addEventListener('mouseleave',leave);
}
function detach(){
  if(!attached)return;attached=false;
  removeEventListener('pointermove',move);removeEventListener('pointerdown',move);
  removeEventListener('focusin',schedule);document.removeEventListener('mouseleave',leave);
  if(raf)cancelAnimationFrame(raf);raf=0;
}
/* look(x,y) receives numbers in -1..1. Returns an unsubscribe function. */
export function trackEyes(el,look){
  if(reducedMotion())return()=>{};
  const s={el,look};subs.add(s);attach();schedule();
  return()=>{subs.delete(s);if(!subs.size)detach();};
}
export const trackerSubscribers=()=>subs.size;
