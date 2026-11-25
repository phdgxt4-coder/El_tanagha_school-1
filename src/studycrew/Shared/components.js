/* Reusable components (plain DOM, no framework). All of them are built on makeScene(), so there is one
   code path for mounting, slots, accessibility text and cleanup. Each returns {el, destroy()}.
   Important information is always real text; the character is decorative (aria-hidden). */
import {mountCharacter} from './characterManager.js';
import {CONFIG} from './config.js';
import {reducedMotion} from './prefs.js';
import {tokens} from '../Themes/tokens.js';
import {log} from './logger.js';
import {setTheme} from '../Themes/index.js';
import {getPrefs} from './prefs.js';
import '../../../styles/studycrew.css';
let themed=false;
const ensureTheme=()=>{if(themed||typeof document==='undefined')return;themed=true;if(!document.documentElement.dataset.scTheme)setTheme(getPrefs().theme||'dark');};
const h=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const LOADING_STATE={alex:'Searching',arthur:'Reading',oscar:'Typing',chloe:'Loading',leo:'Loading'};
const NOTE_COLOR={info:tokens.color.info,success:tokens.color.success,warn:tokens.color.warn,error:tokens.color.error,message:tokens.color.calm};

export function makeScene({characterId,state='Idle',title,message,role='status',slot=CONFIG.slots.main,priority=0,variant='card',tone,actions=[],live=true,idle=true,tracking=true,delayMs=0,onPreempt}){
  ensureTheme();
  const el=h('section',`sc-scene sc-${variant}`);
  if(tone)el.dataset.tone=tone;
  el.setAttribute('role',role);
  if(live)el.setAttribute('aria-live',role==='alert'?'assertive':'polite');
  const stage=h('div','sc-stage');stage.setAttribute('aria-hidden','true');
  const body=h('div','sc-body');
  if(title)body.append(h('p','sc-title',title));
  if(message)body.append(h('p','sc-text',message));
  actions.forEach(a=>{const b=h('button','sc-btn',a.label);b.type='button';b.addEventListener('click',a.onClick);body.append(b);});
  el.append(stage,body);
  let ctrl=null,gone=false,timer=null;
  const start=()=>{
    if(gone)return;
    mountCharacter(stage,characterId,{slot,priority,state,idle,tracking,onPreempt:()=>{el.dataset.hidden='true';onPreempt?.();}}).then(c=>{
      if(gone){c?.destroy();return;}
      ctrl=c;if(!c){el.dataset.noCharacter='true';}
    }).catch(err=>log.error('scene mount failed',{error:String(err)}));
  };
  if(delayMs>0)timer=setTimeout(start,delayMs);else start();
  return{el,get character(){return ctrl;},setState:s=>ctrl?.request(s),destroy(){gone=true;clearTimeout(timer);ctrl?.destroy();el.remove();}};
}
export const CharacterCard=({characterId,title,text,state='Idle',actions})=>makeScene({characterId,state,title,message:text,actions,variant:'card'});
export function MascotBubble({characterId,text,corner='end',autoHideMs=4500,slot=CONFIG.slots.popup,onClose}){
  const s=makeScene({characterId,message:text,variant:'bubble',slot,priority:20,idle:false,tracking:false});
  s.el.dataset.corner=corner;
  const t=autoHideMs?setTimeout(()=>{s.destroy();onClose?.();},autoHideMs):null;
  const destroy=s.destroy;
  return{...s,destroy(){clearTimeout(t);destroy();}};
}
export const SuccessAnimation=({characterId='alex',message})=>makeScene({characterId,state:'Success',message,priority:80,variant:'card',tone:'success'});
export const ErrorAnimation=({characterId='alex',message,retry})=>makeScene({characterId,state:'Error',message,role:'alert',priority:100,variant:'card',tone:'error',actions:retry?[{label:retry.label,onClick:retry.onClick}]:[]});
export const LoadingScene=({characterId='alex',message='جارٍ التحميل…',delayMs=400})=>makeScene({characterId,state:LOADING_STATE[characterId]||'Loading',message,variant:'card',slot:CONFIG.slots.loading,priority:30,delayMs,idle:false});
export function NotificationCharacter({type='info',text,characterId='leo'}){
  const s=makeScene({characterId,state:'Wave',message:text,variant:'bubble',slot:CONFIG.slots.notification,priority:40,idle:false,tracking:false});
  s.el.style.setProperty('--sc-note',NOTE_COLOR[type]||NOTE_COLOR.info);s.el.dataset.type=type;
  return s;
}
export function AchievementBanner({title,text,importance='small',extra=['alex','oscar','leo']}){
  const s=makeScene({characterId:'chloe',state:importance==='small'?'Success':'Celebrate',title,message:text,variant:'banner',priority:60,idle:false,tracking:false});
  const kids=[];
  if(importance==='big'&&!reducedMotion()){
    extra.forEach((id,i)=>{const slot=`${CONFIG.slots.popup}-${id}`;kids.push(setTimeout(()=>{const m=makeScene({characterId:id,state:'Celebrate',variant:'mini',slot,priority:60,idle:false,tracking:false,live:false});s.el.append(m.el);kids.push(m);},300+i*80));});
  }
  const destroy=s.destroy;
  return{...s,destroy(){kids.forEach(k=>typeof k==='object'?k.destroy():clearTimeout(k));destroy();}};
}
export async function CelebrationOverlay({characterIds=['chloe','alex','oscar','leo','arthur'],text='مبروك!',ms=tokens.motion.celebrationMax}={}){
  const el=h('div','sc-overlay');el.setAttribute('role','status');
  el.append(h('p','sc-text sc-overlay-text',text));
  const row=h('div','sc-row');row.setAttribute('aria-hidden','true');el.append(row);
  document.body.append(el);
  const scenes=characterIds.map((id,i)=>{const c=makeScene({characterId:id,state:'Celebrate',variant:'mini',slot:`overlay-${id}`,priority:60,idle:false,tracking:false,live:false,delayMs:i*80});row.append(c.el);return c;});
  if(!reducedMotion()){try{(await import('../Effects/confetti.js')).confetti(row);}catch(e){log.warn('confetti unavailable',{error:String(e)});}}
  let t=null;const destroy=()=>{clearTimeout(t);scenes.forEach(s=>s.destroy());el.remove();};
  t=setTimeout(destroy,reducedMotion()?Math.min(ms,1200):ms);
  el.addEventListener('click',destroy);
  return{el,destroy};
}
