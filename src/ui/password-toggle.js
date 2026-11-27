/* Plain eye button for password fields. No mascot here: signup and other screens use only this. */
const EYE='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path class="pw-slash" d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function enhancePasswordFields(root=document){
  root.querySelectorAll('input[type="password"]:not([data-pw-enhanced])').forEach(input=>{
    input.dataset.pwEnhanced='1';
    const wrap=document.createElement('span');
    wrap.className='pw-field';
    input.replaceWith(wrap);
    const button=document.createElement('button');
    button.type='button';
    button.className='pw-toggle';
    button.setAttribute('aria-label','إظهار كلمة المرور');
    button.setAttribute('aria-pressed','false');
    button.innerHTML=EYE;
    wrap.append(input,button);
    button.addEventListener('click',()=>{
      const show=input.type==='password';
      input.type=show?'text':'password';
      button.setAttribute('aria-pressed',String(show));
      button.setAttribute('aria-label',show?'إخفاء كلمة المرور':'إظهار كلمة المرور');
      button.classList.toggle('is-shown',show);
      input.dispatchEvent(new CustomEvent('pwtoggle',{bubbles:true}));
      input.focus({preventScroll:true});
    });
  });
}
