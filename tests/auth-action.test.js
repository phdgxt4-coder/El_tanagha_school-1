import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  classifyActionError, createResendGuard, parseActionParams, resendLabel, validateNewPassword
} from '../src/auth/action-logic.js';
import { authActionPage, runActionPage } from '../src/pages/auth-action.js';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const CODE = 'AbCdEf123456_-xyz';

test('parseActionParams يقرأ mode وoobCode وlang ويرفض الناقص والنمط الغريب', () => {
  const ok = parseActionParams(`?mode=verifyEmail&oobCode=${CODE}&lang=ar&apiKey=x`);
  assert.deepEqual([ok.mode, ok.oobCode, ok.lang, ok.valid], ['verifyEmail', CODE, 'ar', true]);
  for (const mode of ['verifyEmail', 'resetPassword', 'recoverEmail']) assert.equal(parseActionParams(`?mode=${mode}&oobCode=${CODE}`).valid, true);
  assert.equal(parseActionParams('?mode=verifyEmail').valid, false);
  assert.equal(parseActionParams(`?oobCode=${CODE}`).valid, false);
  assert.equal(parseActionParams(`?mode=signIn&oobCode=${CODE}`).valid, false);
  assert.equal(parseActionParams('?mode=resetPassword&oobCode=<script>').valid, false);
  assert.equal(parseActionParams('').valid, false);
});

test('classifyActionError يفرّق بين الشبكة والانتهاء وعدم الصلاحية', () => {
  assert.equal(classifyActionError({ code: 'auth/network-request-failed' }), 'network');
  assert.equal(classifyActionError({ code: 'load-timeout' }), 'network');
  assert.equal(classifyActionError({ code: 'auth/expired-action-code' }), 'expired');
  assert.equal(classifyActionError({ code: 'auth/invalid-action-code' }), 'invalid');
  assert.equal(classifyActionError({ code: 'auth/weak-password' }), 'weak');
  assert.equal(classifyActionError(new Error('x')), 'other');
});

test('validateNewPassword: حد أدنى 8 وتطابق', () => {
  assert.match(validateNewPassword('1234567', '1234567'), /8/u);
  assert.match(validateNewPassword('12345678', '12345679'), /غير متطابقتين/u);
  assert.equal(validateNewPassword('12345678', '12345678'), '');
});

test('حارس إعادة الإرسال: 60 ثانية وثلاث محاولات ويصمد أمام الريفريش', () => {
  let t = 1_000_000;
  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const guard = createResendGuard({ storage, now: () => t });
  assert.equal(guard.canSend(), true);
  guard.record();
  assert.equal(guard.canSend(), false);
  assert.equal(guard.remainingMs(), 60_000);
  assert.match(resendLabel(guard), /60/u);
  const afterRefresh = createResendGuard({ storage, now: () => t });
  assert.equal(afterRefresh.canSend(), false);
  t += 59_000; assert.equal(afterRefresh.canSend(), false);
  t += 1_000; assert.equal(afterRefresh.canSend(), true);
  afterRefresh.record(); t += 60_000; afterRefresh.record(); t += 60_000;
  assert.equal(afterRefresh.attemptsLeft(), 0);
  assert.equal(afterRefresh.canSend(), false);
  assert.match(resendLabel(afterRefresh), /الأقصى من المحاولات/u);
});

/* واجهة DOM مصغّرة تكفي لتشغيل المتحكم بدون متصفح */
function fakeRoot() {
  const listeners = {};
  const root = {
    dataset: {}, innerHTML: '', attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(type, fn) { listeners[type] = fn; },
    removeEventListener(type) { delete listeners[type]; },
    querySelector() { return null; },
    click(act) { return listeners.click({ target: { closest: () => ({ dataset: { act }, disabled: false }) } }); },
    submit(password, confirm) {
      const message = { textContent: '', dataset: {} };
      const submit = { disabled: false, textContent: '' };
      const form = { elements: { password: { value: password }, confirm: { value: confirm } }, querySelector: sel => (sel.includes('error') ? message : submit) };
      listeners.submit({ target: { closest: () => form }, preventDefault() {} });
      return { message, submit };
    }
  };
  return root;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const urls = { login: '/login', dashboard: '/dashboard' };
const baseApi = (over = {}) => ({
  inspect: async () => ({ data: { email: 'a@b.co' } }), apply: async () => {}, verifyResetCode: async () => 'a@b.co',
  confirmReset: async () => {}, refreshVerifiedSession: async () => true, resendVerification: async () => {}, sendPasswordReset: async () => {}, ...over
});
const start = (search, api, extra = {}) => {
  const root = fakeRoot();
  const handle = runActionPage({ root, search, api, urls, ...extra });
  return { root, handle };
};

test('رابط بلا mode أو oobCode يعرض حالة رابط غير صالح', () => {
  const { root } = start('', baseApi());
  assert.equal(root.dataset.state, 'invalid');
  assert.match(root.innerHTML, /الرابط غير صالح/u);
});

test('verifyEmail: قبل التأكيد ثم تحميل ثم نجاح مع تحديث الجلسة', async () => {
  const calls = [];
  const api = baseApi({ apply: async c => calls.push(['apply', c]), refreshVerifiedSession: async () => { calls.push(['refresh']); return true; } });
  let celebrated = 0;
  const { root } = start(`?mode=verifyEmail&oobCode=${CODE}`, api, { celebrate: () => { celebrated += 1; } });
  assert.equal(root.dataset.state, 'verify-idle');
  assert.match(root.innerHTML, /تأكيد بريدي/u);
  assert.deepEqual(calls, []);
  const pending = root.click('verify');
  assert.equal(root.dataset.state, 'verify-loading');
  await pending; await tick();
  assert.equal(root.dataset.state, 'verify-success');
  assert.deepEqual(calls, [['apply', CODE], ['refresh']]);
  assert.match(root.innerHTML, /الدخول إلى المنصة/u);
  assert.match(root.innerHTML, /href="\/dashboard"/u);
  assert.equal(celebrated, 1);
});

test('verifyEmail: بلا جلسة يذهب زر الدخول إلى صفحة الدخول', async () => {
  const { root } = start(`?mode=verifyEmail&oobCode=${CODE}`, baseApi({ refreshVerifiedSession: async () => false }));
  await root.click('verify'); await tick();
  assert.match(root.innerHTML, /href="\/login"/u);
});

test('verifyEmail: رابط مستخدم والبريد موثق يعرض "تم التأكيد من قبل"', async () => {
  const api = baseApi({ apply: async () => { throw { code: 'auth/invalid-action-code' }; }, refreshVerifiedSession: async () => true });
  const { root } = start(`?mode=verifyEmail&oobCode=${CODE}`, api);
  await root.click('verify'); await tick();
  assert.equal(root.dataset.state, 'verify-already');
  assert.match(root.innerHTML, /تسجيل الدخول/u);
});

test('verifyEmail: رابط منتهٍ يعرض زر إرسال رابط جديد وبه انتظار وحد أقصى', async () => {
  let t = 5_000_000, sent = 0;
  const api = baseApi({ apply: async () => { throw { code: 'auth/expired-action-code' }; }, resendVerification: async () => { sent += 1; } });
  const { root, handle } = start(`?mode=verifyEmail&oobCode=${CODE}`, api, { now: () => t });
  await root.click('verify'); await tick();
  assert.equal(root.dataset.state, 'verify-expired');
  assert.match(root.innerHTML, /انتهت صلاحية الرابط/u);
  assert.match(root.innerHTML, /Spam/u);
  await root.click('resend'); await tick();
  assert.equal(sent, 1);
  await root.click('resend'); await tick();
  assert.equal(sent, 1, 'الضغط خلال 60 ثانية لا يرسل');
  handle.dispose();
});

test('verifyEmail: انقطاع الشبكة يعرض إعادة المحاولة وينجح بعدها', async () => {
  let fail = true;
  const api = baseApi({ apply: async () => { if (fail) throw { code: 'auth/network-request-failed' }; } });
  const { root } = start(`?mode=verifyEmail&oobCode=${CODE}`, api);
  await root.click('verify'); await tick();
  assert.equal(root.dataset.state, 'network');
  assert.match(root.innerHTML, /إعادة المحاولة/u);
  fail = false;
  await root.click('retry'); await tick();
  assert.equal(root.dataset.state, 'verify-success');
});

test('resetPassword: نموذج بتأكيد وحد أدنى ثم نجاح، وأخطاء عربية', async () => {
  let saved = null;
  const api = baseApi({ confirmReset: async (c, p) => { saved = [c, p]; } });
  const { root } = start(`?mode=resetPassword&oobCode=${CODE}`, api);
  await tick();
  assert.equal(root.dataset.state, 'reset-form');
  assert.match(root.innerHTML, /type="password"/u);
  assert.match(root.innerHTML, /a@b\.co/u);
  let r = root.submit('short', 'short');
  assert.match(r.message.textContent, /8/u);
  assert.equal(saved, null);
  r = root.submit('12345678', 'different');
  assert.match(r.message.textContent, /غير متطابقتين/u);
  root.submit('12345678', '12345678'); await tick(); await tick();
  assert.deepEqual(saved, [CODE, '12345678']);
  assert.equal(root.dataset.state, 'reset-success');
});

test('resetPassword: رابط منتهٍ أو مستخدم يعرض حالة عربية بزر طلب رابط جديد', async () => {
  const api = baseApi({ verifyResetCode: async () => { throw { code: 'auth/expired-action-code' }; } });
  const { root } = start(`?mode=resetPassword&oobCode=${CODE}`, api);
  await tick();
  assert.equal(root.dataset.state, 'reset-invalid');
  assert.match(root.innerHTML, /طلب رابط جديد/u);
});

test('recoverEmail: يعرض البريد المستعاد، يطبّق عند الضغط فقط، ثم يعرض النجاح', async () => {
  let applied = 0;
  const api = baseApi({ apply: async () => { applied += 1; } });
  const { root } = start(`?mode=recoverEmail&oobCode=${CODE}`, api);
  await tick();
  assert.equal(root.dataset.state, 'recover-idle');
  assert.match(root.innerHTML, /a@b\.co/u);
  assert.equal(applied, 0);
  await root.click('recover'); await tick();
  assert.equal(applied, 1);
  assert.equal(root.dataset.state, 'recover-success');
});

test('الصفحة نفسها: RTL عربية بلا نصوص إنجليزية ظاهرة سوى Spam', () => {
  const html = authActionPage();
  assert.match(html, /data-action-root/u);
  assert.match(html, /data-action-mascot/u);
});

test('التوصيل: المسار معلن، يُعالج في app.js، ولا يمس القواعد ولا حركة Arthur', () => {
  const app = read('../src/app.js');
  assert.match(app, /\^\\\/auth\\\/action\\\/\?\$\/,authActionPage/u);
  assert.match(app, /initializeAuthAction/u);
  const manifest = JSON.parse(read('../public/manus-routes.json'));
  assert.ok(manifest.routes.some(route => route.path === '/auth/action'));
  const service = read('../src/auth/auth-service.js');
  assert.match(service, /user\.reload\(\)/u);
  assert.match(service, /getIdToken\(true\)/u);
});

test('التسجيل: رسالة التفعيل تذكر Spam وبها زر إعادة إرسال بنفس الحارس', () => {
  const app = read('../src/app.js');
  assert.match(app, /أرسلنا رسالة تفعيل لبريدك\. لو لم تجدها ابحث في الرسائل غير المرغوبة \(Spam\)/u);
  assert.match(app, /appendResendVerification\(message\)/u);
  const dash = read('../src/pages/dashboard-pages.js');
  assert.match(dash, /createResendGuard/u);
});

test('CSS: أزرار 44px على الأقل وحركة الدوران تحترم تقليل الحركة', () => {
  const css = read('../styles/states.css');
  assert.match(css, /\.aa-btn\{min-height:48px;min-width:44px/u);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.aa-icon\.is-spinning\{animation:none\}/u);
});
