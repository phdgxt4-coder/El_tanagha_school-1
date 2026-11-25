/* Per-character state machine. Pure logic, no DOM. Priority model from the Motion System doc:
   Error > Success > Achievement > Notification > Idle. */
import {tokens} from '../Themes/tokens.js';
export const STATES=['Idle','Thinking','Reading','Searching','Typing','Loading','Success','Error','Celebrate','Sleep','Wake','Wave','HiddenPassword','VisiblePassword'];
export const PRIORITY={Error:100,Success:80,Celebrate:60,Wake:45,Wave:45,Loading:30,Thinking:30,Searching:30,Reading:30,Typing:30,HiddenPassword:30,VisiblePassword:30,Sleep:10,Idle:0};
/* states that finish by themselves and fall back to a resting state */
const M=tokens.motion;
export const ONE_SHOT={Success:M.celebration,Error:M.error,Celebrate:M.celebrationMax,Wake:M.wake,Wave:M.wave};
const REST=['Idle','Sleep'];
const ANY=STATES;
export const TRANSITIONS={
  Idle:ANY,Sleep:['Wake','Error','Idle'],Wake:['Idle','Error','Success','Wave'],Wave:['Idle','Error','Success'],
  HiddenPassword:['VisiblePassword','Idle','Error','Success'],VisiblePassword:['HiddenPassword','Idle','Error','Success']
};
const can=(from,to)=>(TRANSITIONS[from]||ANY).includes(to)||PRIORITY[to]>PRIORITY[from];
export function createStateMachine({initial='Idle',onChange=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let state=initial,timer=null,rest=initial;
  const enter=(next,reason)=>{
    clearTimer(timer);timer=null;
    const prev=state;state=next;
    onChange(next,prev,reason);
    if(ONE_SHOT[next])timer=setTimer(()=>{timer=null;enter(rest,'finished');},ONE_SHOT[next]);
  };
  return{
    get state(){return state;},
    /* returns true when the request was accepted */
    request(next,{force=false}={}){
      if(!STATES.includes(next))return false;
      if(next===state)return false;
      /* a lower priority request never interrupts a running higher one */
      if(!force&&PRIORITY[next]<PRIORITY[state]&&(ONE_SHOT[state]||PRIORITY[state]>=PRIORITY.Loading))return false;
      if(!force&&!can(state,next))return false;
      if(REST.includes(next)||!ONE_SHOT[next]&&PRIORITY[next]<PRIORITY.Loading)rest=next;
      enter(next,'request');return true;
    },
    /* leave a persistent state (Loading, Thinking...) when the work ends */
    finish(s){if(state===s){enter(rest,'finish');return true;}return false;},
    setRest(s){if(REST.includes(s))rest=s;},
    destroy(){clearTimer(timer);timer=null;}
  };
}
