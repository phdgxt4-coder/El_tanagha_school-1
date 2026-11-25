/* Context Awareness + Smart Silence. One place decides what the crew may do right now. */
import {LIVING} from './config.js';
import {reducedMotion} from '../Shared/prefs.js';
let current='browsing';
const subs=new Set();
export const FOCUS_MODES=Object.keys(LIVING.focus);
export function setFocus(mode){
  if(!(mode in LIVING.focus))mode='browsing';
  if(mode===current)return;
  current=mode;subs.forEach(f=>f(mode));
}
export const getFocus=()=>current;
export const onFocus=f=>{subs.add(f);return()=>subs.delete(f);};
/* Policy = focus rules AND user prefs. Reduced motion always wins. */
export function policy(mode=current,{sound=false,haptics=false}={}){
  const p={...(LIVING.focus[mode]||LIVING.focus.browsing)};
  if(reducedMotion()){p.motion=false;if(p.celebrate==='confetti'||p.celebrate==='full')p.celebrate='glow';}
  p.sound=p.sound&&sound;p.haptics=p.haptics&&haptics;
  return p;
}
/* Pick a focus mode from the page: an exam route or an active exam flag wins over everything. */
export function focusFromContext({route='',examActive=false,typing=false,reading=false,searching=false}={}){
  if(examActive||/exam|quiz|test/i.test(route)&&/take|run|attempt|session/i.test(route))return 'exam';
  if(typing)return 'typing';
  if(reading)return 'reading';
  if(searching)return 'searching';
  return 'browsing';
}
