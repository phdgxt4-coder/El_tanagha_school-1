// نقطة تسجيل أخطاء المتصفح. تحوّل كل الأخطاء إلى المتتبع الموحّد (error-tracker.js)
// الذي يسجل في مجموعة errorReports (يقراها المالك فقط حسب firestore.rules).
// أبقينا اسم initErrorReporter كما هو حتى لا يتغير app.js.
// ملاحظة: مجموعة clientErrors القديمة لا يُكتب فيها بعد الآن؛ بياناتها القديمة تبقى كما هي.
import { installErrorTracker, reportError } from './error-tracker.js';

export function initErrorReporter() {
  installErrorTracker();
}

// للاستخدام اليدوي من أي وحدة: reportError(error, 'manual')
export { reportError };
