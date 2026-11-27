/* Back to top: a small round button with Alex (الثعلب أليكس) that appears after
   scrolling down and returns the page to the top. Alex's chunk loads lazily the
   first time the button shows; if the character fails to load the button still
   works with a plain arrow. Hidden on exam screens and respects reduced motion. */
import {reducedMotion} from '../studycrew/Shared/prefs.js';

const SHOW_AFTER_PX=600;

export function mountBackToTop(doc=document){
  if(doc.querySelector('[data-back-to-top]'))return;
  const view=doc.defaultView;
  const btn=doc.createElement('button');
  btn.type='button';
  btn.className='back-to-top';
  btn.dataset.backToTop='';
  btn.setAttribute('aria-label','الرجوع إلى أعلى الصفحة');
  btn.hidden=true;
  const host=doc.createElement('span');
  host.className='back-to-top-host';
  host.setAttribute('aria-hidden','true');
  host.textContent='↑';
  btn.append(host);
  doc.body.append(btn);

  let loading=false,alex=null;
  const ensureAlex=async()=>{
    if(loading||alex)return;
    loading=true;
    try{
      const {mountCharacter}=await import('../studycrew/Shared/characterManager.js');
      alex=await mountCharacter(host,'alex',{slot:'popup',tracking:false,sound:false,state:'Idle'});
      if(alex)host.textContent='';
    }catch{/* الزر يعمل بالسهم حتى بدون الشخصية */}
  };

  const onScroll=()=>{
    const show=view.scrollY>=SHOW_AFTER_PX&&!doc.querySelector('[data-exam-active]');
    if(show&&btn.hidden)ensureAlex();
    btn.hidden=!show;
  };
  view.addEventListener('scroll',onScroll,{passive:true});
  onScroll();

  btn.addEventListener('click',()=>{
    view.scrollTo({top:0,behavior:reducedMotion()?'auto':'smooth'});
    alex?.request?.('Wave');
  });
}
