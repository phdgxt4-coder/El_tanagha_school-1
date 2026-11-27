/* Register mascot (Living layer): Arthur stands above the registration form, says "يلا سجل"
   and dances while the register tab is open. Mounted only when the register form is visible,
   fully lazy (Arthur's chunk loads only then), fixed-height box so nothing shifts, silent in
   exams, still when reduced motion is on, and never touches the form or registration logic.
   The dance variant is one constant until the owner picks his favourite from the option video. */
import {reducedMotion} from '../Shared/prefs.js';
import {getFocus} from './focus.js';
import {log} from '../Shared/logger.js';

/* Dance loops: transform-only keyframes played on the character host, one per option.
   1 = neutral default shown in this PR; the owner's pick replaces DEFAULT_DANCE later. */
export const DANCES={
  1:{name:'تمايل مبسوط',ms:1800,frames:[
    {transform:'translateY(0) rotate(0deg)'},
    {transform:'translateY(-7%) rotate(-4deg)',offset:.25},
    {transform:'translateY(0) rotate(0deg)',offset:.5},
    {transform:'translateY(-7%) rotate(4deg)',offset:.75},
    {transform:'translateY(0) rotate(0deg)'}]},
  2:{name:'نطاط متحمس',ms:1400,frames:[
    {transform:'translateY(0) scale(1,1)'},
    {transform:'translateY(-14%) scale(.96,1.05)',offset:.3},
    {transform:'translateY(0) scale(1.05,.92)',offset:.55},
    {transform:'translateY(-9%) scale(.98,1.03)',offset:.8},
    {transform:'translateY(0) scale(1,1)'}]},
  3:{name:'لفة كبيرة',ms:2200,frames:[
    {transform:'translateY(0) rotate(0deg)'},
    {transform:'translateY(-5%) rotate(-12deg)',offset:.25},
    {transform:'translateY(0) rotate(0deg)',offset:.5},
    {transform:'translateY(-5%) rotate(12deg)',offset:.75},
    {transform:'translateY(0) rotate(0deg)'}]},
  4:{name:'رقصة سريعة',ms:1100,frames:[
    {transform:'translate(0,0) rotate(0deg)'},
    {transform:'translate(-5%,-4%) rotate(-7deg)',offset:.25},
    {transform:'translate(0,0) rotate(0deg)',offset:.5},
    {transform:'translate(5%,-4%) rotate(7deg)',offset:.75},
    {transform:'translate(0,0) rotate(0deg)'}]}
};
export const DEFAULT_DANCE=2;
export const REGISTER_LINE='يلا سجل!';

let current=null;

function stopDance(){current?.dance?.cancel?.();current&&(current.dance=null);}
function startDance(){
  if(!current||reducedMotion())return;
  const d=DANCES[current.variant]||DANCES[DEFAULT_DANCE];
  stopDance();
  current.dance=current.ctrl.el.animate(d.frames,{duration:d.ms,iterations:Infinity,easing:'ease-in-out'});
  if(document.visibilityState==='hidden')current.dance.pause();
}

/* Exported for the dev harness and the option video: mount into any host with a chosen variant. */
export async function mountRegisterMascot(host,{variant=DEFAULT_DANCE}={}){
  unmountRegisterMascot();
  const box=host.ownerDocument.createElement('div');
  box.className='sc-register-mascot';
  box.dataset.dance=String(variant in DANCES?variant:DEFAULT_DANCE);
  const stage=host.ownerDocument.createElement('div');
  stage.className='sc-register-stage';stage.setAttribute('aria-hidden','true');
  const line=host.ownerDocument.createElement('p');
  line.className='sc-register-note';line.textContent=REGISTER_LINE;
  box.append(stage,line);
  host.append(box);
  current={box,ctrl:null,variant:Number(box.dataset.dance),dance:null,onVis:()=>{if(!current?.dance)return;if(document.visibilityState==='hidden')current.dance.pause();else current.dance.play();}};
  document.addEventListener('visibilitychange',current.onVis);
  try{
    const {mountCharacter}=await import('../Shared/characterManager.js');
    const ctrl=await mountCharacter(stage,'arthur',{state:'Wave',slot:'register-mascot',idle:true,tracking:false,sound:false});
    if(!current||current.box!==box){ctrl?.destroy();return current?current.ctrl:null;}
    if(!ctrl){box.dataset.noCharacter='true';return null;}
    current.ctrl=ctrl;
    startDance();
    return ctrl;
  }catch(err){
    log.warn('register mascot failed to mount',{error:String(err?.message||err)});
    box.dataset.noCharacter='true';
    return null;
  }
}

export function unmountRegisterMascot(){
  if(!current)return;
  stopDance();
  document.removeEventListener('visibilitychange',current.onVis);
  current.ctrl?.destroy();
  current.box.remove();
  current=null;
}

/* Called by wire.js whenever the auth DOM may have changed: mount while the register form
   is shown, unmount when it hides or an exam starts. Never touches the form itself. */
export function updateRegisterMascot(doc=document){
  const form=doc.querySelector('[data-auth-form="register"]');
  const visible=!!form&&!form.hidden&&getFocus()!=='exam';
  if(!visible){unmountRegisterMascot();return;}
  if(current&&current.box.isConnected)return;
  unmountRegisterMascot();
  /* the box goes directly above the register form, inside the same panel */
  const host=doc.createElement('div');
  form.before(host);
  void mountRegisterMascot(host);
}
