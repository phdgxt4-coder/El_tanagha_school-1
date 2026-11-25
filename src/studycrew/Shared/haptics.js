/* Light vibration on success, a small one on error. Off by default, toggle in prefs. */
import {getPrefs,reducedMotion} from './prefs.js';
import {CONFIG} from './config.js';
const PATTERNS=CONFIG.haptics;
export function haptic(kind='tap'){
  if(!getPrefs().haptics||reducedMotion())return false;
  if(typeof navigator==='undefined'||typeof navigator.vibrate!=='function')return false;
  try{return navigator.vibrate(PATTERNS[kind]||PATTERNS.tap);}catch{return false;}
}
