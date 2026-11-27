/* منطق صفحة معالجة روابط Firebase Auth (/auth/action). دوال نقية بلا DOM ولا Firebase حتى تُختبر مباشرة.
   الأنماط المدعومة: verifyEmail وresetPassword وrecoverEmail. أي نمط آخر يُعرض كرابط غير صالح. */

export const ACTION_MODES = Object.freeze(['verifyEmail', 'resetPassword', 'recoverEmail']);
export const MIN_PASSWORD_LENGTH = 8;
export const RESEND_COOLDOWN_MS = 60_000;
export const RESEND_MAX_ATTEMPTS = 3;

/** يقرأ mode وoobCode وlang من query. يعيد null للنمط أو الرمز لو غاب أو لم يصلح. */
export function parseActionParams(search = '') {
  const params = new URLSearchParams(String(search).replace(/^\?/u, ''));
  const mode = params.get('mode') ?? '';
  const oobCode = (params.get('oobCode') ?? '').trim();
  const lang = (params.get('lang') ?? '').trim().slice(0, 12);
  const validMode = ACTION_MODES.includes(mode) ? mode : null;
  const validCode = /^[\w-]{6,512}$/u.test(oobCode) ? oobCode : null;
  return { mode: validMode, oobCode: validCode, lang, valid: Boolean(validMode && validCode) };
}

/** يصنّف خطأ Firebase إلى حالة عرض: expired | invalid | network | weak | other. */
export function classifyActionError(error) {
  const code = String(error?.code ?? error ?? '');
  if (/network-request-failed|timeout|load-timeout/u.test(code)) return 'network';
  if (/expired-action-code/u.test(code)) return 'expired';
  if (/invalid-action-code|user-disabled|user-not-found/u.test(code)) return 'invalid';
  if (/weak-password/u.test(code)) return 'weak';
  if (/too-many-requests/u.test(code)) return 'throttled';
  return 'other';
}

/** يتحقق من كلمة المرور الجديدة. يعيد رسالة عربية أو '' لو سليمة. */
export function validateNewPassword(password, confirm) {
  const value = String(password ?? '');
  if (value.length < MIN_PASSWORD_LENGTH) return `كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف.`;
  if (value !== String(confirm ?? '')) return 'كلمتا المرور غير متطابقتين.';
  return '';
}

/** حارس إعادة الإرسال: انتظار 60 ثانية بين كل محاولتين وحد أقصى للمحاولات. يحفظ حالته في sessionStorage ليصمد أمام الريفريش. */
export function createResendGuard({ storage = null, now = () => Date.now(), key = 'tn_resend', cooldownMs = RESEND_COOLDOWN_MS, max = RESEND_MAX_ATTEMPTS } = {}) {
  let state = { count: 0, last: 0 };
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? 'null');
    if (saved && Number.isFinite(saved.count) && Number.isFinite(saved.last)) state = { count: saved.count, last: saved.last };
  } catch { /* تخزين غير متاح: الحالة في الذاكرة فقط */ }
  const persist = () => { try { storage?.setItem(key, JSON.stringify(state)); } catch { /* تجاهل */ } };
  return {
    remainingMs() { return Math.max(0, state.last + cooldownMs - now()); },
    attemptsLeft() { return Math.max(0, max - state.count); },
    canSend() { return state.count < max && this.remainingMs() === 0; },
    record() { state = { count: state.count + 1, last: now() }; persist(); },
    reset() { state = { count: 0, last: 0 }; persist(); }
  };
}

/** نص زر إعادة الإرسال حسب حالة الحارس. */
export function resendLabel(guard, idle = 'إرسال رابط جديد') {
  if (guard.attemptsLeft() === 0) return 'وصلت للحد الأقصى من المحاولات';
  const wait = Math.ceil(guard.remainingMs() / 1000);
  return wait > 0 ? `انتظر ${wait} ثانية لإعادة الإرسال` : idle;
}
