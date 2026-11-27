/* صفحة /auth/action: تعالج روابط Firebase Auth (تأكيد البريد، إعادة تعيين كلمة المرور، استعادة البريد) بالعربية داخل المنصة.
   لا تغيّر القواعد ولا إعدادات Firebase. الصفحة كلها حالات (state) تُرسم داخل [data-action-root]. */
import {
  classifyActionError, createResendGuard, parseActionParams, resendLabel, validateNewPassword, MIN_PASSWORD_LENGTH
} from '../auth/action-logic.js';

const esc = value => String(value ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Arthur فوق البطاقة، بحركته الحالية بلا تعديل. يُحمَّل كسولًا ويفشل بصمت لو تعذر. */
export async function mountActionMascot(stage) {
  if (!stage) return null;
  const { mountCharacter } = await import('../studycrew/Shared/characterManager.js');
  return mountCharacter(stage, 'arthur', { state: 'Wave', slot: 'auth-action', idle: true, tracking: false, sound: false });
}

export function authActionPage() {
  return `<section class="section page auth-action-page"><div class="aa-card"><div class="aa-mascot" data-action-mascot aria-hidden="true"></div><div class="aa-root" data-action-root aria-live="polite"><p class="aa-loading">جارٍ فتح الرابط…</p></div><noscript><p>تحتاج هذه الصفحة إلى تفعيل جافاسكربت.</p></noscript></div></section>`;
}

const ICONS = { ok: '✓', warn: '!', mail: '✉', lock: '🔒', wait: '…', net: '⚠' };

function button(item) {
  const cls = `button aa-btn${item.ghost ? ' ghost' : ''}`;
  if (item.href) return `<a class="${cls}" href="${esc(item.href)}">${esc(item.label)}</a>`;
  return `<button type="button" class="${cls}" data-act="${esc(item.act)}"${item.disabled ? ' disabled' : ''}>${esc(item.label)}</button>`;
}

let firstPaint = true;
function view(root, { state, tone = 'info', icon = 'mail', title, body = '', extra = '', actions = [], busy = false }) {
  root.dataset.state = state;
  root.setAttribute('aria-busy', String(busy));
  root.innerHTML = `<div class="aa-view" data-tone="${tone}"><span class="aa-icon${busy ? ' is-spinning' : ''}" aria-hidden="true">${ICONS[icon] ?? icon}</span><h1 tabindex="-1">${esc(title)}</h1>${body ? `<p>${esc(body)}</p>` : ''}${extra}<div class="aa-actions">${actions.map(button).join('')}</div></div>`;
  /* التركيز على العنوان بعد أي تغيير حالة لقارئات الشاشة، لا عند أول فتح حتى لا يظهر إطار التركيز. */
  if (!firstPaint) root.querySelector('h1')?.focus({ preventScroll: true });
  firstPaint = false;
}

/* api: { inspect, apply, verifyResetCode, confirmReset, refreshVerifiedSession, resendVerification, sendPasswordReset }
   urls: { login, dashboard }. enhance: يضيف زر إظهار/إخفاء كلمة المرور. */
export function runActionPage({ root, search, api, urls, storage = null, celebrate = () => {}, enhance = () => {}, now = () => Date.now() }) {
  const params = parseActionParams(search);
  const guard = createResendGuard({ storage, now, key: 'tn_resend_action' });
  let timer = null;
  let disposed = false;
  let current = null;
  const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };
  const set = config => { if (disposed) return; stopTimer(); view(root, config); };

  const invalidView = () => set({
    state: 'invalid', tone: 'bad', icon: 'warn', title: 'الرابط غير صالح',
    body: 'هذا الرابط غير صحيح أو سبق استخدامه. افتح الرابط من آخر رسالة وصلتك، أو اطلب رابطًا جديدًا من صفحة الدخول.',
    actions: [{ label: 'العودة لتسجيل الدخول', href: urls.login }]
  });
  const networkView = retry => set({
    state: 'network', tone: 'warn', icon: 'net', title: 'تعذر الاتصال',
    body: 'يبدو أن الاتصال بالإنترنت منقطع أو ضعيف. تحقق من الشبكة ثم أعد المحاولة.',
    actions: [{ label: 'إعادة المحاولة', act: 'retry' }]
  }) || (current = { retry });

  /* ---------- verifyEmail ---------- */
  const verifyIdle = () => {
    current = { retry: verifyRun };
    set({
      state: 'verify-idle', icon: 'mail', title: 'تأكيد بريدك الإلكتروني',
      body: 'اضغط الزر لتأكيد بريدك وتفعيل حسابك في منصة مدرسة التناغه الشرقيه الثانوية المشتركة.',
      actions: [{ label: 'تأكيد بريدي', act: 'verify' }]
    });
  };
  async function verifyRun() {
    set({ state: 'verify-loading', icon: 'wait', title: 'جارٍ تأكيد بريدك…', body: 'لحظات ويكتمل التأكيد.', busy: true });
    try {
      await api.apply(params.oobCode);
    } catch (error) {
      const kind = classifyActionError(error);
      if (kind === 'network') { current = { retry: verifyRun }; return networkView(verifyRun); }
      if (kind === 'invalid') {
        let verified = false;
        try { verified = await api.refreshVerifiedSession(); } catch { /* لا جلسة: يبقى الرابط غير صالح */ }
        if (verified) return verifiedBefore();
        return expiredView('invalid');
      }
      if (kind === 'expired') return expiredView('expired');
      return networkView(verifyRun);
    }
    let signedIn = false;
    try { signedIn = Boolean(await api.refreshVerifiedSession() ?? true); } catch { /* الجلسة تتحدث عند الدخول التالي */ }
    set({
      state: 'verify-success', tone: 'good', icon: 'ok', title: 'تم تأكيد بريدك بنجاح',
      body: 'حسابك جاهز الآن. ادخل المنصة وابدأ.',
      actions: [{ label: 'الدخول إلى المنصة', href: signedIn ? urls.dashboard : urls.login }]
    });
    celebrate(root.querySelector('.aa-icon'));
  }
  function verifiedBefore() {
    set({
      state: 'verify-already', tone: 'good', icon: 'ok', title: 'تم تأكيد بريدك من قبل',
      body: 'لا تحتاج إلى أي خطوة أخرى. سجّل الدخول وتابع.',
      actions: [{ label: 'تسجيل الدخول', href: urls.login }]
    });
  }
  function expiredView(why) {
    const label = () => resendLabel(guard);
    set({
      state: 'verify-expired', tone: 'bad', icon: 'warn',
      title: why === 'expired' ? 'انتهت صلاحية الرابط' : 'الرابط غير صالح',
      body: 'اطلب رابط تأكيد جديدًا. يلزم أن تكون مسجّل الدخول بنفس الحساب. لو لم تجد الرسالة ابحث في الرسائل غير المرغوبة (Spam).',
      extra: '<p class="aa-note" data-resend-note role="status"></p>',
      actions: [{ label: label(), act: 'resend', disabled: !guard.canSend() }, { label: 'تسجيل الدخول', href: urls.login, ghost: true }]
    });
    tickResend();
  }
  function tickResend() {
    const buttonEl = root.querySelector('[data-act="resend"]');
    if (!buttonEl) return;
    const paint = () => { buttonEl.textContent = resendLabel(guard); buttonEl.disabled = !guard.canSend(); };
    paint();
    stopTimer();
    if (guard.attemptsLeft() > 0 && guard.remainingMs() > 0) {
      timer = setInterval(() => { paint(); if (guard.remainingMs() === 0) stopTimer(); }, 1000);
    }
  }
  async function resendRun() {
    if (!guard.canSend()) return tickResend();
    const note = root.querySelector('[data-resend-note]');
    try {
      await api.resendVerification();
      guard.record();
      if (note) { note.textContent = 'أرسلنا رسالة تفعيل جديدة لبريدك. لو لم تجدها ابحث في الرسائل غير المرغوبة (Spam).'; note.dataset.kind = 'success'; }
    } catch (error) {
      const code = String(error?.code ?? '');
      if (note) {
        note.dataset.kind = 'error';
        note.textContent = code === 'auth/no-current-user' ? 'سجّل الدخول أولًا ثم اطلب رابطًا جديدًا من لوحتك.'
          : classifyActionError(error) === 'throttled' ? 'محاولات كثيرة؛ انتظر قليلًا ثم أعد المحاولة.'
          : 'تعذر الإرسال الآن. تحقق من الاتصال وأعد المحاولة.';
      }
    }
    tickResend();
  }

  /* ---------- resetPassword ---------- */
  async function resetStart() {
    current = { retry: resetStart };
    set({ state: 'reset-checking', icon: 'wait', title: 'جارٍ التحقق من الرابط…', busy: true });
    let email = '';
    try { email = await api.verifyResetCode(params.oobCode); } catch (error) {
      const kind = classifyActionError(error);
      if (kind === 'network') return networkView(resetStart);
      return set({
        state: 'reset-invalid', tone: 'bad', icon: 'warn',
        title: kind === 'expired' ? 'انتهت صلاحية رابط إعادة التعيين' : 'رابط إعادة التعيين غير صالح',
        body: 'اطلب رابطًا جديدًا من صفحة الدخول عبر "نسيت كلمة المرور". الرابط يعمل مرة واحدة فقط.',
        actions: [{ label: 'طلب رابط جديد', href: urls.login }]
      });
    }
    set({
      state: 'reset-form', icon: 'lock', title: 'كلمة مرور جديدة',
      body: `اختر كلمة مرور جديدة للحساب ${email}`,
      extra: `<form class="aa-form" data-reset-form novalidate><label>كلمة المرور الجديدة<input name="password" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" required></label><label>تأكيد كلمة المرور<input name="confirm" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" required></label><p class="aa-note">الحد الأدنى ${MIN_PASSWORD_LENGTH} أحرف.</p><p class="aa-note" data-reset-error role="alert"></p><button type="submit" class="button aa-btn">حفظ كلمة المرور</button></form>`
    });
    enhance(root);
  }
  async function resetSubmit(form) {
    const message = form.querySelector('[data-reset-error]');
    const submit = form.querySelector('[type="submit"]');
    const problem = validateNewPassword(form.elements.password.value, form.elements.confirm.value);
    message.textContent = problem;
    if (problem) { message.dataset.kind = 'error'; return; }
    submit.disabled = true;
    submit.textContent = 'جارٍ الحفظ…';
    try {
      await api.confirmReset(params.oobCode, form.elements.password.value);
    } catch (error) {
      submit.disabled = false;
      submit.textContent = 'حفظ كلمة المرور';
      const kind = classifyActionError(error);
      message.dataset.kind = 'error';
      message.textContent = kind === 'network' ? 'انقطع الاتصال. أعد المحاولة بعد التأكد من الشبكة.'
        : kind === 'weak' ? `اختر كلمة مرور من ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`
        : kind === 'expired' || kind === 'invalid' ? 'انتهت صلاحية الرابط أو سبق استخدامه. اطلب رابطًا جديدًا من صفحة الدخول.'
        : 'تعذر حفظ كلمة المرور الآن. أعد المحاولة.';
      return;
    }
    set({
      state: 'reset-success', tone: 'good', icon: 'ok', title: 'تم تغيير كلمة المرور',
      body: 'سجّل الدخول بكلمة المرور الجديدة.',
      actions: [{ label: 'تسجيل الدخول', href: urls.login }]
    });
    celebrate(root.querySelector('.aa-icon'));
  }

  /* ---------- recoverEmail ---------- */
  async function recoverStart() {
    current = { retry: recoverStart };
    set({ state: 'recover-checking', icon: 'wait', title: 'جارٍ التحقق من الرابط…', busy: true });
    let info;
    try { info = await api.inspect(params.oobCode); } catch (error) {
      if (classifyActionError(error) === 'network') return networkView(recoverStart);
      return invalidView();
    }
    const email = info?.data?.email ?? '';
    set({
      state: 'recover-idle', icon: 'mail', title: 'استعادة بريدك السابق',
      body: email ? `سيعود بريد حسابك إلى ${email}. لو لم تطلب تغيير البريد، اضغط الزر ثم غيّر كلمة المرور.` : 'سيعود بريد حسابك إلى بريدك السابق.',
      actions: [{ label: 'استعادة بريدي', act: 'recover' }]
    });
    current.email = email;
  }
  async function recoverRun() {
    const email = current?.email ?? '';
    set({ state: 'recover-loading', icon: 'wait', title: 'جارٍ استعادة بريدك…', busy: true });
    try { await api.apply(params.oobCode); } catch (error) {
      current = { retry: recoverStart };
      return classifyActionError(error) === 'network' ? networkView(recoverStart) : invalidView();
    }
    const resetNote = () => resendLabel(guard, 'إرسال رابط تغيير كلمة المرور');
    set({
      state: 'recover-success', tone: 'good', icon: 'ok', title: 'تمت استعادة بريدك',
      body: 'للأمان، غيّر كلمة مرورك الآن إن لم تكن أنت من غيّر البريد.',
      extra: '<p class="aa-note" data-resend-note role="status"></p>',
      actions: [{ label: resetNote(), act: 'recover-reset', disabled: !guard.canSend() }, { label: 'تسجيل الدخول', href: urls.login, ghost: true }]
    });
    current = { email };
    celebrate(root.querySelector('.aa-icon'));
  }
  async function recoverResetRun() {
    if (!guard.canSend()) return;
    const note = root.querySelector('[data-resend-note]');
    try {
      await api.sendPasswordReset(current?.email);
      guard.record();
      if (note) { note.textContent = 'أرسلنا رابط تغيير كلمة المرور لبريدك. لو لم تجده ابحث في الرسائل غير المرغوبة (Spam).'; note.dataset.kind = 'success'; }
    } catch {
      if (note) { note.textContent = 'تعذر الإرسال الآن. أعد المحاولة بعد قليل.'; note.dataset.kind = 'error'; }
    }
    const btn = root.querySelector('[data-act="recover-reset"]');
    if (btn) { btn.textContent = resendLabel(guard, 'إرسال رابط تغيير كلمة المرور'); btn.disabled = !guard.canSend(); }
  }

  const onClick = event => {
    const target = event.target.closest?.('[data-act]');
    if (!target || target.disabled) return;
    const act = target.dataset.act;
    if (act === 'verify') void verifyRun();
    else if (act === 'recover') void recoverRun();
    else if (act === 'resend') void resendRun();
    else if (act === 'recover-reset') void recoverResetRun();
    else if (act === 'retry') void current?.retry?.();
  };
  const onSubmit = event => {
    const form = event.target.closest?.('[data-reset-form]');
    if (!form) return;
    event.preventDefault();
    void resetSubmit(form);
  };
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);

  if (!params.valid) invalidView();
  else if (params.mode === 'verifyEmail') verifyIdle();
  else if (params.mode === 'resetPassword') void resetStart();
  else void recoverStart();

  return { dispose() { disposed = true; stopTimer(); root.removeEventListener('click', onClick); root.removeEventListener('submit', onSubmit); } };
}
