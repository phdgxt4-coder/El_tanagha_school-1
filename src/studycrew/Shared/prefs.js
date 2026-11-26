/* User preferences and environment checks. Safe when localStorage or matchMedia is missing. */
import {CONFIG} from './config.js';
const KEY=CONFIG.storageKey;
const defaults={sound:CONFIG.defaults.sound,haptics:CONFIG.defaults.haptics,motion:CONFIG.defaults.motion,theme:CONFIG.defaults.theme};
let cache=null;
const listeners=new Set();
function read(){
  if(cache)return cache;
  try{cache={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{cache={...defaults};}
  return cache;
}
export const getPrefs=()=>({...read()});
export function setPrefs(patch){
  cache={...read(),...patch};
  try{localStorage.setItem(KEY,JSON.stringify(cache));}catch{}
  listeners.forEach(fn=>fn(getPrefs()));
}
export const onPrefs=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
const mq=()=>typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
/* user setting 'off' (stop motion) or system reduced motion both stop long motion */
export const reducedMotion=()=>read().motion==='off'||!!mq()?.matches;
export const lowPower=()=>typeof navigator!=='undefined'&&(navigator.connection?.saveData===true||(navigator.deviceMemory||8)<=1);
export const coarsePointer=()=>typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
export const pageHidden=()=>typeof document!=='undefined'&&document.visibilityState==='hidden';
