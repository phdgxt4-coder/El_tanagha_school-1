/* Idle picker: random, weighted, never the same clip twice in a row, not from the last 5, big clips cool down.
   Also escalation timers at 30/60/90 seconds without interaction. Clock and rng are injectable for tests. */
export function createIdlePicker({pool,rng=Math.random,now=()=>Date.now(),recent=CONFIG.idle.recent,bigCooldownMs=CONFIG.idle.bigCooldownMs}){
  const history=[],lastBig=new Map();
  return{
    next(){
      const t=now();
      let cands=pool.filter(c=>!history.slice(-recent).includes(c.id)&&(!c.big||t-(lastBig.get(c.id)??-Infinity)>=bigCooldownMs));
      if(!cands.length)cands=pool.filter(c=>c.id!==history[history.length-1]);
      if(!cands.length)return null;
      const total=cands.reduce((s,c)=>s+(c.weight||1),0);
      let r=rng()*total,pick=cands[cands.length-1];
      for(const c of cands){r-=(c.weight||1);if(r<=0){pick=c;break;}}
      history.push(pick.id);if(history.length>50)history.shift();
      if(pick.big)lastBig.set(pick.id,t);
      return pick;
    },
    history:()=>history.slice()
  };
}
import {CONFIG} from './config.js';
export const gapMs=(rng=Math.random,min=CONFIG.idle.minGapMs,max=CONFIG.idle.maxGapMs)=>min+rng()*(max-min);
const [E1,E2,E3]=CONFIG.idle.escalationMs;
export const ESCALATION=[{afterMs:E1,kind:'idle'},{afterMs:E2,kind:'wave'},{afterMs:E3,kind:'random-big'}];
export function createIdleScheduler({picker,play,rng=Math.random,setTimer=setTimeout,clearTimer=clearTimeout,min=CONFIG.idle.minGapMs,max=CONFIG.idle.maxGapMs,canRun=()=>true}){
  let timer=null,running=false,esc=[];
  const tick=()=>{
    timer=null;if(!running)return;
    if(canRun()){const c=picker.next();if(c)play(c);}
    timer=setTimer(tick,gapMs(rng,min,max));
  };
  const arm=()=>{
    esc.forEach(clearTimer);esc=[];
    for(const e of ESCALATION)esc.push(setTimer(()=>{if(running&&canRun())play({id:'@'+e.kind,escalation:e.kind});},e.afterMs));
  };
  return{
    start(){if(running)return;running=true;timer=setTimer(tick,gapMs(rng,min,max));arm();},
    interact(){if(running)arm();},
    stop(){running=false;clearTimer(timer);timer=null;esc.forEach(clearTimer);esc=[];},
    get running(){return running;}
  };
}
