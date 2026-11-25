/** أدوات مساعدة */
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const now = () => Date.now();
export const today = () => new Date().toISOString().slice(0, 10);
export const fmt = ts => new Date(ts).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
export const fmtTime = ts => new Date(ts).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

export function toast(msg, ms = 2800) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a2334;color:#e8edf5;padding:12px 24px;border-radius:12px;z-index:9999;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.45);transition:opacity .3s;opacity:0;max-width:90vw;text-align:center;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._tm);
  t._tm = setTimeout(() => { t.style.opacity = '0'; }, ms);
}

export function card(title, html) {
  return `<div class="w"><h5>${title}</h5>${html || '<div class="li empty">لا يوجد محتوى</div>'}</div>`;
}

export function empty(m = 'لا يوجد محتوى حالياً') {
  return `<div class="li empty">${m}</div>`;
}

export function strongPass(p) {
  return p.length >= 6 && /[0-9]/.test(p) && /[a-zA-Z\u0600-\u06FF]/.test(p);
}

export function isValidPhone(p) {
  return /^01[0125][0-9]{8}$/.test(p);
}

export function isHttps(url) {
  return !url || /^https?:\/\//i.test(url);
}
