/* Wiring: connects the Living layer to the real app. Loaded only when the flag is on (src/config/features.js).
   Reads the DOM through a few stable hooks, never edits page code. Exam screens (data-exam-active) are fully silent. */
import '../../../styles/studycrew.css';
import '../../../styles/living.css';
import {applyWorld} from './world.js';
import {setFocus,getFocus,focusFromContext} from './focus.js';
import {createDirector} from './director.js';
import {createGuard,applyTier} from './quality.js';
import {remember,visit} from './memory.js';
import {getPrefs} from '../Shared/prefs.js';
import {LIVING} from './config.js';

const TICK_MS=4*60*1000,TYPING_MS=1500;
let started=false;

export function startLiving(doc=document){
  if(started)return;started=true;
  const root=doc.documentElement;
  root.dataset.scLiving='on';
  applyWorld(root);
  const guard=createGuard({onChange:t=>applyTier(root,t)});
  applyTier(root,guard.tier());
  const ambient=doc.createElement('div');ambient.className='sc-ambient';ambient.setAttribute('aria-hidden','true');doc.body.prepend(ambient);
  const layer=doc.createElement('div');layer.className='sc-living-layer';layer.setAttribute('aria-live','polite');doc.body.append(layer);

  let lastKey=0;
  doc.addEventListener('keydown',()=>{lastKey=Date.now();},true);
  const typing=()=>Date.now()-lastKey<TYPING_MS&&/^(INPUT|TEXTAREA)$/.test(doc.activeElement?.tagName||'');
  const refreshFocus=()=>{
    const mode=focusFromContext({route:location.pathname,examActive:!!doc.querySelector('[data-exam-active]'),typing:typing()});
    setFocus(mode);root.dataset.scFocus=mode;
    if(mode==='exam')layer.replaceChildren();
  };
  const director=createDirector({getFocus,prefs:getPrefs,quality:guard.tier});

  let current=null;
  const say=async(out,characterId='alex')=>{
    if(!out.show||(!out.message&&out.tier==='none'))return;
    if(out.haptics)import('../Shared/haptics.js').then(m=>m.haptic(out.state==='Error'?'error':'success')).catch(()=>{});
    if(out.tier!=='none'&&out.tier!=='glow'&&getFocus()==='browsing')import('../Effects/confetti.js').then(m=>m.confetti?.(null,out.effects.confetti)).catch(()=>{});
    if(!out.message)return;
    try{
      const {MascotBubble}=await import('../Shared/components.js');
      if(getFocus()==='exam')return;
      current?.destroy?.();
      current=MascotBubble({characterId,text:out.message,autoHideMs:6000,onClose:()=>{current=null;}});
      layer.append(current.el);
    }catch{}
  };

  /* Login: calm help instead of a bare red line. The page's own message stays; the crew adds comfort. */
  let lastAuthText='';
  const checkAuth=()=>{
    const m=doc.querySelector('[data-auth-message]');
    const text=m?.textContent?.trim()||'';
    if(!m||text===lastAuthText)return;
    lastAuthText=text;
    if(!text)return;
    if(m.dataset.kind==='error'){
      const kind=navigator.onLine===false?'offline':/كلمة|password/i.test(text)?'password':'generic';
      say(director('fail',{kind}),kind==='password'?'arthur':'alex');
    }else if(m.dataset.kind==='success'){say(director('success'),'alex');doc.querySelector('.auth-panel')?.classList.add('sc-glow');}
  };

  /* Crew spots outside auth (guidelines §1): Oscar on the student's tasks tab, Chloe on the grades
     tab, Arthur welcomes the teacher and parent dashboards, Alex covers 404, Leo owns network
     states. Each hint shows once per session through the same focus policy; exam stays silent. */
  const shownHints=new Set();
  const hintOnce=(key,characterId)=>{
    if(shownHints.has(key)||getFocus()==='exam')return;
    try{if(sessionStorage.getItem('sc.hint.'+key))return;sessionStorage.setItem('sc.hint.'+key,'1');}catch{}
    shownHints.add(key);
    say(director('hint',{hint:key}),characterId);
  };
  const checkSpots=()=>{
    if(doc.querySelector('.dash-teacher'))hintOnce('teacher','arthur');
    if(doc.querySelector('.dash-parent'))hintOnce('parent','arthur');
    if(doc.querySelector('.dash-student [data-panel="tasks"]:not([hidden])'))hintOnce('tasks','oscar');
    if(doc.querySelector('.dash-student [data-panel="grades"]:not([hidden])'))hintOnce('grades','chloe');
    if(doc.querySelector('[data-page="404"]'))hintOnce('notFound','alex');
  };

  /* Register page: Arthur above the registration form, "يلا سجل" + dance (register-mascot.js).
     Lazy: the module and Arthur's chunk load only when the register tab is actually open. */
  let registerMascotMod=null;
  const checkRegisterMascot=()=>{
    registerMascotMod=registerMascotMod||import('./register-mascot.js').catch(()=>null);
    registerMascotMod.then(m=>m?.updateRegisterMascot(doc));
  };

  /* Leo owns network states (guidelines §8): a calm note when the connection drops or returns.
     The app's own offline bar stays; Leo only adds a face, and important info stays real text. */
  let leoNote=null,netWasOff=false;
  const clearLeo=()=>{leoNote?.destroy?.();leoNote=null;};
  const networkNote=online=>{
    refreshFocus();
    if(getFocus()==='exam')return;
    clearLeo();
    const out=director('hint',{hint:online?'online':'offline'});
    if(!out.show||!out.message)return;
    import('../Shared/components.js').then(({NotificationCharacter})=>{
      if(getFocus()==='exam')return;
      clearLeo();
      leoNote=NotificationCharacter({type:online?'success':'warn',text:out.message,characterId:'leo'});
      layer.append(leoNote.el);
      setTimeout(clearLeo,6000);
    }).catch(()=>{});
  };
  addEventListener('offline',()=>{netWasOff=true;networkNote(false);});
  addEventListener('online',()=>{if(netWasOff){netWasOff=false;networkNote(true);}});

  /* Student home: welcome back once per session, only after a long absence. */
  let welcomed=false;
  const checkHome=()=>{
    if(welcomed||!doc.querySelector('.dash-student'))return;
    welcomed=true;
    try{if(sessionStorage.getItem('sc.welcomed'))return;sessionStorage.setItem('sc.welcomed','1');}catch{}
    const v=visit();
    say(director('return',v),'alex');
  };

  /* Cheap frame sampling for a short window after each route change, so a slow device downgrades once. */
  const sample=()=>{
    let n=0,prev=performance.now();
    const step=t=>{guard.frame(t-prev);prev=t;if(++n<90&&doc.visibilityState==='visible')requestAnimationFrame(step);};
    requestAnimationFrame(step);
  };

  let queued=false;
  const mo=new MutationObserver(()=>{
    if(queued)return;queued=true;
    setTimeout(()=>{queued=false;refreshFocus();if(getFocus()==='exam')return;checkAuth();checkHome();checkSpots();checkRegisterMascot();},120);
  });
  mo.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-kind','hidden']});
  doc.addEventListener('focusin',refreshFocus);
  const tick=setInterval(()=>{if(doc.visibilityState==='visible'){refreshFocus();say(director('tick'),'alex');}},TICK_MS);
  addEventListener('pagehide',()=>{clearInterval(tick);remember('route',location.pathname);remember('scroll:'+location.pathname,Math.round(scrollY));});
  addEventListener('popstate',sample);
  refreshFocus();sample();checkAuth();checkHome();checkSpots();checkRegisterMascot();
}
export const _cfg=LIVING;
