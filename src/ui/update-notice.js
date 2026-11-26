// In-flow bar at the very top of the page (it pushes content down instead of floating over it, so it can never cover a field).
// Small "new version" notice. Never reloads by itself, never shows or stays visible while the user is typing,
// and does nothing on a first visit (only when an already-running page gets a newer service worker).
const EDITABLE = 'input,textarea,select,[contenteditable="true"]';

export function isTyping(doc = document) {
  const el = doc.activeElement;
  return Boolean(el && el !== doc.body && el.matches?.(EDITABLE));
}

export function initUpdateNotice(nav = navigator, doc = document, win = window) {
  if (!nav?.serviceWorker) return null;
  const hadController = Boolean(nav.serviceWorker.controller);
  let wanted = false, bar = null, dismissed = false;

  const hide = () => { bar?.remove(); bar = null; };
  const show = () => {
    if (!wanted || dismissed || bar || isTyping(doc)) return;
    bar = doc.createElement('div');
    bar.className = 'update-notice';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>يوجد إصدار أحدث من الموقع.</span><button type="button" data-update-reload>تحديث</button><button type="button" data-update-close aria-label="إغلاق">×</button>';
    bar.addEventListener('click', event => {
      if (event.target.closest('[data-update-reload]')) win.location.reload();
      if (event.target.closest('[data-update-close]')) { dismissed = true; hide(); }
    });
    (doc.body.prepend ? doc.body.prepend(bar) : doc.body.append(bar));
  };

  nav.serviceWorker.addEventListener('controllerchange', () => { if (hadController) { wanted = true; show(); } });
  doc.addEventListener('focusin', () => { if (isTyping(doc)) hide(); });
  doc.addEventListener('focusout', () => { win.setTimeout(show, 600); });
  return { show, hide, isShown: () => Boolean(bar) };
}
