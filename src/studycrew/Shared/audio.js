/* Soft synthesized sounds, no audio files in the bundle. Default OFF (prefs.sound).
   One voice at a time: a new sound stops the old one, and a minimum gap avoids annoying repeats. */
import {getPrefs} from './prefs.js';
import {CONFIG} from './config.js';
const PITCH={alex:523,arthur:392,oscar:659,leo:440,chloe:587};
const SHAPES={success:[1,1.25,1.5],error:[1,.89],celebrate:[1,1.25,1.5,2],notify:[1.5],tap:[1]};
let ctx=null,current=null,lastAt=0;
const MIN_GAP=CONFIG.audio.minGapMs;
export function playSound(characterId,kind='tap',{now=()=>Date.now()}={}){
  if(!getPrefs().sound)return false;
  const t=now();if(t-lastAt<MIN_GAP)return false;
  const Ctx=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Ctx)return false;
  try{
    ctx=ctx||new Ctx();
    if(ctx.state==='suspended')ctx.resume?.();
    stopSound();
    const base=PITCH[characterId]||440,notes=SHAPES[kind]||SHAPES.tap;
    const gain=ctx.createGain();gain.connect(ctx.destination);
    const t0=ctx.currentTime;
    gain.gain.setValueAtTime(0.0001,t0);gain.gain.exponentialRampToValueAtTime(CONFIG.audio.volume,t0+0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001,t0+0.12*notes.length+0.2);
    const oscs=notes.map((m,i)=>{
      const o=ctx.createOscillator();o.type='sine';o.frequency.value=base*m;
      o.connect(gain);o.start(t0+i*0.12);o.stop(t0+i*0.12+0.2);return o;
    });
    current={gain,oscs};lastAt=t;return true;
  }catch{return false;}
}
export function stopSound(){
  if(!current)return;
  try{current.oscs.forEach(o=>{try{o.stop();}catch{}});current.gain.disconnect();}catch{}
  current=null;
}
