// مفتاح موقع reCAPTCHA v3 لـ Firebase App Check (مفتاح عام وليس سريًا). اتركه فارغًا لتعطيل App Check.
// الخطوات في DEPLOY.md. ابدأ بوضع المراقبة في Firebase Console ولا تفعّل الإلزام قبل التأكد.
export const APP_CHECK_SITE_KEY = import.meta.env?.VITE_APPCHECK_SITE_KEY || '';
