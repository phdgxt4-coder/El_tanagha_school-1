// شاشة خطأ عربية بزر "إعادة المحاولة". لا تعرض رسالة الخطأ الخام للمستخدم.
const NOISE = [/ResizeObserver loop/iu, /^Script error\.?$/iu, /Non-Error promise rejection/iu, /Load failed$/iu, /AbortError/iu];

export function isNoise(message) {
  const text = String(message ?? '').trim();
  return !text || NOISE.some(pattern => pattern.test(text));
}

/** يقنّع البريد والهاتف وأكواد الربط ومعرّفات المستخدمين قبل أي تسجيل. */
export function scrubMessage(message) {
  return String(message ?? '')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu, '[email]')
    .replace(/\bTNG-[A-Z0-9]{6,}\b/gu, '[code]')
    .replace(/\bSTU-[A-Z0-9]{6,}\b/gu, '[id]')
    .replace(/\+?\d[\d\s-]{7,}\d/gu, '[phone]')
    .replace(/\b[A-Za-z0-9]{24,}\b/gu, '[id]')
    .slice(0, 300);
}

export function errorCardHtml(title, note) {
  return `<section class="section page"><div class="state-card state-error" role="alert"><span class="state-icon" aria-hidden="true">!</span><h2>${title}</h2><p>${note}</p><button type="button" class="button" data-error-retry>إعادة المحاولة</button></div></section>`;
}

let shown = false;
export function initErrorBoundary(doc = document, win = window) {
  const show = () => {
    if (shown || doc.getElementById('error-toast')) return;
    shown = true;
    const bar = doc.createElement('div');
    bar.id = 'error-toast';
    bar.className = 'error-toast';
    bar.setAttribute('role', 'alert');
    bar.innerHTML = '<span>حدث خطأ غير متوقع. جرّب مرة أخرى.</span><button type="button" data-error-retry>إعادة المحاولة</button><button type="button" data-error-close aria-label="إغلاق">×</button>';
    bar.addEventListener('click', event => {
      if (event.target.closest('[data-error-retry]')) win.location.reload();
      if (event.target.closest('[data-error-close]')) { bar.remove(); shown = false; }
    });
    doc.body.append(bar);
  };
  win.addEventListener('error', event => { if (event.target === win && !isNoise(event.message)) show(); });
  win.addEventListener('unhandledrejection', event => { if (!isNoise(event.reason?.message ?? event.reason)) show(); });
}
