var e=[`happy`,`thinking`,`waiting`,`celebrating`,`sad`,`waving`];function t(t,n=`waving`){t.innerHTML=`<svg class="mascot" viewBox="0 0 160 170" role="img" aria-label="التميمة تناغه" focusable="false">
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
</g></svg>`;let r=t.firstElementChild,i={setMood(t){e.includes(t)&&(r.dataset.mood=t)},cover(e){r.classList.toggle(`is-covering`,!!e)},peek(e){r.classList.toggle(`is-peeking`,!!e)}};return i.setMood(n),i}function n(e){if(!e||e.dataset.mounted)return null;e.dataset.mounted=`1`;let n=e.closest(`form`)||document,r=n.querySelector(`input[name="password"]`),i=document.querySelector(`[data-auth-message]`),a=t(e,`waving`),o=0,s=(e,t)=>{clearTimeout(o),o=setTimeout(()=>a.setMood(e),t)};s(`happy`,2200);let c=()=>{let e=r?.type===`password`,t=document.activeElement===r;a.cover(!!r&&e&&t),a.peek(!!r&&!e&&t)};return r&&(r.addEventListener(`focus`,c),r.addEventListener(`blur`,c),r.addEventListener(`pwtoggle`,c)),n.querySelector(`input[name="email"]`)?.addEventListener(`focus`,()=>{clearTimeout(o),a.setMood(`happy`)}),n.addEventListener(`submit`,()=>{clearTimeout(o),a.setMood(`thinking`)}),n.querySelector(`[data-password-reset]`)?.addEventListener(`click`,()=>{clearTimeout(o),a.setMood(`waiting`)}),i&&new MutationObserver(()=>{let e=i.dataset.kind;i.textContent.trim()&&(e===`error`?(a.setMood(`sad`),s(`happy`,3500)):e===`success`?(a.setMood(`celebrating`),s(`happy`,2600)):a.setMood(`happy`))}).observe(i,{childList:!0,characterData:!0,subtree:!0,attributes:!0,attributeFilter:[`data-kind`]}),a}export{n as mountLoginMascot};