/* Central animation manager: knows every live renderer, pauses them all when the tab is hidden, when the
   device is low power, or when motion is turned off, and enforces the live-character limit. */
import {CONFIG} from './config.js';
import {log} from './logger.js';
import {reducedMotion,lowPower,pageHidden,onPrefs} from './prefs.js';
const live=new Set();
let wired=false;
export const shouldAnimate=()=>!reducedMotion()&&!pageHidden();
export const shouldRunIdle=()=>shouldAnimate()&&!lowPower();
function sync(){live.forEach(c=>shouldAnimate()?c.resume():c.pause());}
function wire(){
  if(wired||typeof document==='undefined')return;
  wired=true;
  document.addEventListener('visibilitychange',sync);
  onPrefs(sync);
  if(typeof matchMedia==='function')matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',sync);
}
export function registerController(c){
  wire();
  if(live.size>=CONFIG.budget.maxLiveCharacters){
    log.warn('live character limit reached',{limit:CONFIG.budget.maxLiveCharacters});
    return false;
  }
  live.add(c);if(!shouldAnimate())c.pause();return true;
}
export const unregisterController=c=>{live.delete(c);};
export const liveCount=()=>live.size;
export const _resetForTests=()=>live.clear();
