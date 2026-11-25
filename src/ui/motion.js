/* Motion system. Every effect here uses transform and opacity only (GPU friendly),
   is skipped when the user asks for reduced motion, and has a purpose:
   feedback (ripple, press), orientation (route enter, progress), hierarchy (reveal), speed (prefetch). */

const reduceQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
export const reducedMotion=()=>Boolean(reduceQuery?.matches);
const finePointer=window.matchMedia?.('(hover: hover) and (pointer: fine)');
const raf=window.requestAnimationFrame?.bind(window)||(fn=>setTimeout(fn,16));

/* ---------- Touch and click feedback: ripple ---------- */
const RIPPLE_HOSTS='.button,.card,.subject-tabs button,.grade-button,.auth-tab,.role-link,.theme-toggle,.menu-toggle,.nav a';
function addRipple(event){
  if(reducedMotion()||event.button>0)return;
  const host=event.target.closest?.(RIPPLE_HOSTS);
  if(!host||host.disabled||host.getAttribute('aria-disabled')==='true')return;
  host.classList.add('ripple-host');
  const rect=host.getBoundingClientRect();
  const size=Math.min(Math.max(rect.width,rect.height)*1.6,520);
  const wave=document.createElement('span');
  wave.className='ripple';
  wave.setAttribute('aria-hidden','true');
  wave.style.width=wave.style.height=`${size}px`;
  wave.style.left=`${event.clientX-rect.left-size/2}px`;
  wave.style.top=`${event.clientY-rect.top-size/2}px`;
  host.append(wave);
  const done=()=>wave.remove();
  wave.addEventListener('animationend',done,{once:true});
  setTimeout(done,900);
}

/* ---------- Pointer light and soft tilt on cards (desktop only) ---------- */
let pending=null;
function trackCard(event){
  if(reducedMotion()||!finePointer?.matches)return;
  const card=event.target.closest?.('.card');
  if(!card)return;
  pending={card,x:event.clientX,y:event.clientY};
  if(trackCard.queued)return;
  trackCard.queued=true;
  raf(()=>{
    trackCard.queued=false;
    if(!pending)return;
    const {card:el,x,y}=pending;pending=null;
    const rect=el.getBoundingClientRect();
    const px=(x-rect.left)/rect.width;
    const py=(y-rect.top)/rect.height;
    el.style.setProperty('--mx',`${(px*100).toFixed(1)}%`);
    el.style.setProperty('--my',`${(py*100).toFixed(1)}%`);
    el.style.setProperty('--tilt-x',`${((.5-py)*3).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y',`${((px-.5)*3).toFixed(2)}deg`);
  });
}
function releaseCard(event){
  const card=event.target.closest?.('.card');
  if(!card||card.contains(event.relatedTarget))return;
  card.style.removeProperty('--tilt-x');
  card.style.removeProperty('--tilt-y');
}

/* ---------- Scroll reveal with smart stagger ---------- */
const REVEAL_SELECTOR='.hero-copy,.section-heading,.stats>div,.card,.dashboard-card,.approval-card,.contact-panel>*,.empty-state,.auth-panel,.closing';
let revealObserver=null;
function reveal(root=document){
  if(reducedMotion()||!('IntersectionObserver' in window))return;
  revealObserver??=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      entry.target.classList.add('is-in');
      revealObserver.unobserve(entry.target);
    }
  },{rootMargin:'0px 0px -8% 0px',threshold:.08});
  const groups=new Map();
  root.querySelectorAll(REVEAL_SELECTOR).forEach(node=>{
    if(node.dataset.revealed)return;
    node.dataset.revealed='1';
    const siblings=groups.get(node.parentElement)??0;
    groups.set(node.parentElement,siblings+1);
    node.style.setProperty('--i',String(Math.min(siblings,7)));
    node.classList.add('reveal');
    revealObserver.observe(node);
  });
}

/* ---------- Route transition and progress ---------- */
let progressEl=null;
let progressTimer=0;
export function routeStart(){
  if(reducedMotion())return;
  progressEl??=(()=>{const el=document.createElement('div');el.className='route-progress';el.setAttribute('aria-hidden','true');document.body.append(el);return el;})();
  clearTimeout(progressTimer);
  progressEl.className='route-progress';
  void progressEl.offsetWidth;
  progressEl.classList.add('is-running');
}
export function routeEnd(app){
  if(reducedMotion())return;
  progressEl?.classList.add('is-done');
  progressTimer=setTimeout(()=>{if(progressEl)progressEl.className='route-progress';},420);
  if(app){
    app.classList.remove('page-enter');
    void app.offsetWidth;
    app.classList.add('page-enter');
  }
}

/* ---------- Theme switch: crossfade where the browser supports view transitions ---------- */
export function withThemeTransition(change){
  if(reducedMotion()||typeof document.startViewTransition!=='function'){change();return;}
  document.documentElement.classList.add('theme-switching');
  const transition=document.startViewTransition(change);
  transition.finished.finally(()=>document.documentElement.classList.remove('theme-switching'));
}

/* ---------- Prefetch the lazy chunks before the tap ---------- */
const prefetchers={
  dashboard:()=>import('../pages/dashboard-pages.js'),
  auth:()=>import('../auth/auth-service.js'),
  firebase:()=>import('../config/firebase-env.js'),
  content:()=>import('../services/content-service.js')
};
const warmed=new Set();
function warm(kind){
  if(warmed.has(kind))return;
  warmed.add(kind);
  prefetchers[kind]?.().catch(()=>warmed.delete(kind));
}
function prefetchFor(event){
  const link=event.target.closest?.('a[href]');
  if(!link)return;
  const href=link.getAttribute('href')||'';
  if(/\/login/.test(href)){warm('firebase');warm('auth');}
  else if(/\/dashboard/.test(href)){warm('dashboard');warm('auth');}
  else if(/\/teachers/.test(href)){warm('firebase');warm('content');}
}
function idlePrefetch(){
  const run=()=>{warm('firebase');};
  (window.requestIdleCallback||(fn=>setTimeout(fn,2500)))(run,{timeout:4000});
}

/* ---------- Header and mobile menu ---------- */
function initHeader(){
  const bar=document.querySelector('.topbar');
  if(!bar)return;
  let ticking=false;
  const update=()=>{ticking=false;bar.classList.toggle('is-scrolled',window.scrollY>12);};
  window.addEventListener('scroll',()=>{if(!ticking){ticking=true;raf(update);}},{passive:true});
  update();
  const nav=document.querySelector('#nav');
  const toggle=document.querySelector('.menu-toggle');
  if(!nav||!toggle)return;
  const close=(returnFocus)=>{
    if(!nav.classList.contains('open'))return;
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded','false');
    if(returnFocus)toggle.focus();
  };
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close(true);});
  document.addEventListener('pointerdown',event=>{
    if(!nav.classList.contains('open'))return;
    if(nav.contains(event.target)||toggle.contains(event.target))return;
    close(false);
  });
  nav.querySelectorAll('a').forEach((link,index)=>link.style.setProperty('--i',String(index)));
}

/* ---------- Theme toggle icon spin ---------- */
function spinToggle(event){
  if(reducedMotion())return;
  const button=event.target.closest?.('[data-theme-toggle]');
  button?.animate?.([{transform:'rotate(0deg) scale(1)'},{transform:'rotate(180deg) scale(.88)',offset:.5},{transform:'rotate(360deg) scale(1)'}],{duration:480,easing:'cubic-bezier(.22,1,.36,1)'});
}

export function initMotion(){
  document.documentElement.classList.add('has-motion');
  document.addEventListener('pointerdown',addRipple,{passive:true});
  document.addEventListener('pointermove',trackCard,{passive:true});
  document.addEventListener('pointerout',releaseCard,{passive:true});
  document.addEventListener('pointerover',prefetchFor,{passive:true});
  document.addEventListener('touchstart',prefetchFor,{passive:true});
  document.addEventListener('focusin',prefetchFor);
  document.addEventListener('click',spinToggle);
  initHeader();
  idlePrefetch();
  const app=document.querySelector('#app');
  if(app){
    new MutationObserver(()=>raf(()=>reveal(app))).observe(app,{childList:true,subtree:true});
    reveal(app);
  }
  reveal(document.querySelector('.footer')?.parentElement||document);
}
