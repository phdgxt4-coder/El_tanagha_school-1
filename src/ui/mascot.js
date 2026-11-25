/* Mascot "Tano": original vector character. Lazy loaded, only mounted on the login screen.
   Moods: happy, thinking, waiting, celebrating, sad, waving. Hidden password covers the eyes. */
import '../../styles/mascot.css';

const SVG=`<svg class="mascot" viewBox="0 0 160 170" role="img" aria-label="التميمة تناغه" focusable="false">
<g class="m-all">
 <ellipse class="m-shadow" cx="80" cy="162" rx="40" ry="5"/>
 <g class="m-body-g">
  <ellipse class="m-body" cx="80" cy="102" rx="54" ry="52"/>
  <ellipse class="m-belly" cx="80" cy="120" rx="30" ry="26"/>
  <g class="m-cap"><path class="m-cap-top" d="M80 22 140 44 80 64 20 44Z"/><path class="m-cap-base" d="M50 54v16c0 8 60 8 60 0V54L80 66Z"/><path class="m-tassel" d="M132 47v22"/><circle class="m-tassel-end" cx="132" cy="72" r="4"/></g>
  <g class="m-eyes">
   <circle class="m-eye-bg" cx="60" cy="96" r="14"/><circle class="m-eye-bg" cx="100" cy="96" r="14"/>
   <g class="m-pupils"><circle class="m-pupil" cx="60" cy="98" r="6"/><circle class="m-pupil" cx="100" cy="98" r="6"/><circle class="m-glint" cx="62" cy="95" r="2"/><circle class="m-glint" cx="102" cy="95" r="2"/></g>
  </g>
  <g class="m-arcs"><path d="M47 98q13-16 26 0M87 98q13-16 26 0"/></g>
  <g class="m-lids"><path d="M47 98q13 10 26 0M87 98q13 10 26 0"/></g>
  <g class="m-brows"><path class="m-brow-l" d="M48 78q12-6 24 0"/><path class="m-brow-r" d="M88 78q12-6 24 0"/></g>
  <g class="m-mouths">
   <path class="m-mouth m-smile" d="M68 122q12 12 24 0"/>
   <path class="m-mouth m-open" d="M66 120q14 24 28 0Z"/>
   <path class="m-mouth m-frown" d="M68 130q12-12 24 0"/>
   <ellipse class="m-mouth m-o" cx="80" cy="127" rx="5" ry="6"/>
   <path class="m-mouth m-flat" d="M70 126h20"/>
  </g>
  <g class="m-cheeks"><ellipse cx="46" cy="114" rx="7" ry="4"/><ellipse cx="114" cy="114" rx="7" ry="4"/></g>
 </g>
 <g class="m-arm m-arm-l"><ellipse class="m-hand" cx="28" cy="124" rx="13" ry="15"/></g>
 <g class="m-arm m-arm-r"><ellipse class="m-hand" cx="132" cy="124" rx="13" ry="15"/></g>
 <g class="m-fx">
  <g class="m-dots"><circle cx="124" cy="40" r="3"/><circle cx="134" cy="30" r="4"/><circle cx="148" cy="18" r="5"/></g>
  <g class="m-spark"><path d="M20 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><path d="M142 66l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></g>
  <g class="m-tear"><path d="M52 112q-4 8 0 12 4-4 0-12Z"/></g>
 </g>
</g></svg>`;

export const MOODS=['happy','thinking','waiting','celebrating','sad','waving'];

export function createMascot(host,mood='waving'){
  host.innerHTML=SVG;
  const svg=host.firstElementChild;
  const api={
    setMood(next){if(MOODS.includes(next))svg.dataset.mood=next;},
    cover(on){svg.classList.toggle('is-covering',Boolean(on));},
    peek(on){svg.classList.toggle('is-peeking',Boolean(on));}
  };
  api.setMood(mood);
  return api;
}

/* Login screen behaviour. Everything is driven by DOM events so the login code does not change. */
export function mountLoginMascot(host){
  if(!host||host.dataset.mounted)return null;
  host.dataset.mounted='1';
  const form=host.closest('form')||document;
  const input=form.querySelector('input[name="password"]');
  const message=document.querySelector('[data-auth-message]');
  const m=createMascot(host,'waving');
  let timer=0;
  const later=(mood,ms)=>{clearTimeout(timer);timer=setTimeout(()=>m.setMood(mood),ms);};
  later('happy',2200);
  const sync=()=>{
    const hidden=input?.type==='password';
    const focused=document.activeElement===input;
    m.cover(Boolean(input)&&hidden&&focused);
    m.peek(Boolean(input)&&!hidden&&focused);
  };
  if(input){
    input.addEventListener('focus',sync);
    input.addEventListener('blur',sync);
    input.addEventListener('pwtoggle',sync);
  }
  form.querySelector('input[name="email"]')?.addEventListener('focus',()=>{clearTimeout(timer);m.setMood('happy');});
  form.addEventListener('submit',()=>{clearTimeout(timer);m.setMood('thinking');});
  form.querySelector('[data-password-reset]')?.addEventListener('click',()=>{clearTimeout(timer);m.setMood('waiting');});
  if(message){
    new MutationObserver(()=>{
      const kind=message.dataset.kind;
      if(!message.textContent.trim())return;
      if(kind==='error'){m.setMood('sad');later('happy',3500);}
      else if(kind==='success'){m.setMood('celebrating');later('happy',2600);}
      else{m.setMood('happy');}
    }).observe(message,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-kind']});
  }
  return m;
}
