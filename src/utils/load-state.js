// Honest loading failures: a timeout instead of an endless skeleton, and a different message when the
// service itself is not available (rules or indexes not published yet) versus a bad connection.
export const LOAD_TIMEOUT_MS = 15000;

export function withTimeout(promise, ms = LOAD_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'load-timeout' })), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function loadErrorMessage(error) {
  const code = String(error?.code ?? '');
  if (/permission-denied|failed-precondition/u.test(code)) return 'هذه الخدمة غير متاحة الآن. أبلغ إدارة المدرسة.';
  if (/load-timeout|unavailable|deadline-exceeded/u.test(code) || error?.message === 'timeout') return 'التحميل بطيء. تأكد من الاتصال وحاول مرة أخرى.';
  return 'تعذر تحميل البيانات الآن. حاول مرة أخرى.';
}
