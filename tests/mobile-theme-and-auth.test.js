import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loginPage } from '../src/pages/auth-pages.js';
import { schedulePage, subjectPage } from '../src/pages/public-pages.js';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('التسجيل يطلب الهاتف والبريد وكلمة المرور، ويعرض استعادة كلمة المرور، ويعرض استعادة كلمة المرور', () => {
  const html = loginPage('student');
  assert.match(html, /name="email" type="email"[^>]*required/u);
  assert.match(html, /name="password" type="password"[^>]*required/u);
  assert.match(html, /name="phone" type="tel"[^>]*required/u);
  assert.match(html, /data-password-reset/u);
  assert.match(html, /name="branch"/u);
  assert.match(html, /name="className"/u);
  assert.doesNotMatch(html, /name="birthDate"/u);
});

test('دخول الإدارة يمر عبر صفحة المدرس ولا يتيح التسجيل الإداري', () => {
  const html = loginPage('admin');
  assert.match(html, /data-role="teacher"/u);
  assert.doesNotMatch(html, /id="register-form"/u);
  assert.doesNotMatch(html, /href="\/login\/admin"/u);
});

test('يحتوي التطبيق على تبديل ثيم محفوظ ودعم وضع فاتح فعلي', () => {
  const html = read('../index.html');
  const css = read('../styles/tokens.css') + read('../styles/main.css');
  const app = read('../src/app.js');
  assert.match(html, /data-theme-toggle/u);
  assert.match(app, /localStorage\.setItem\('tn_theme'/u);
  assert.match(css, /:root\[data-theme="light"\]/u);
  assert.match(css, /@media\(max-width:560px\)/u);
});

test('عامل الخدمة يزيل مخازن النسخة القديمة المعروفة فقط ويلغي تسجيل نفسه', () => {
  const worker = read('../public/sw.js');
  assert.match(worker, /tn-v1/u);
  assert.match(worker, /tanagha-v1/u);
  assert.match(worker, /self\.registration\.unregister\(\)/u);
  assert.match(worker, /filter\(name => legacyCaches\.has\(name\)/u);
});

test('لوحة الحساب تتضمن ربط ولي الأمر بكود خادمي', () => {
  const dashboard = read('../src/pages/dashboard-pages.js');
  const app = read('../src/app.js');
  assert.match(dashboard, /data-parent-link/u);
  assert.match(dashboard, /linkParentToStudent/u);
  assert.match(app, /dashboardPage/u);
});

test('دورة ربط الحسابات فورية بدون موافقة إدارة مع كود عشوائي ومحاولات محدودة', () => {
  const dashboard = read('../src/pages/dashboard-pages.js');
  const functions = read('../functions/src/index.js');
  const auth = read('../src/auth/auth-service.js');
  assert.match(dashboard, /data-issue-parent-code/u);
  assert.doesNotMatch(dashboard, /data-parent-link-review/u);
  assert.match(functions, /PARENT_CODE_TTL_MS = 15 \* 60 \* 1000/u);
  assert.match(functions, /MAX_LINK_FAILURES = 5/u);
  assert.match(functions, /action: 'parent_link_created'/u);
  assert.doesNotMatch(functions, /export const approveParentLink/u);
  assert.match(functions, /randomInt\(CODE_ALPHABET\.length\)/u);
  assert.match(auth, /export function issueParentCode/u);
  assert.doesNotMatch(auth, /approveParentLink/u);
});

test('اختيار الصف وتبويب المادة يعرضان الحالة المختارة دون الإيحاء بوجود محتوى غير منشور', () => {
  const schedule = schedulePage();
  const subject = subjectPage('math');
  const app = read('../src/app.js');
  assert.match(schedule, /data-schedule-grade/u);
  assert.match(schedule, /aria-pressed="true"/u);
  assert.match(schedule, /data-schedule-message/u);
  assert.match(subject, /role="tablist"/u);
  assert.match(subject, /data-subject-kind="lessons"/u);
  assert.match(subject, /aria-selected="true"/u);
  assert.match(subject, /data-subject-content/u);
  assert.match(app, /button\.setAttribute\('aria-pressed',String\(selected\)\)/u);
  assert.match(app, /لا يوجد محتوى منشور في قسم \$\{label\}/u);
  assert.match(app, /لم يُنشر جدول \$\{gradeName\} بعد/u);
});

test('نموذج التسجيل يطلب الاسم والهاتف ويحمّل الفصول والمواد من الهيكل المعتمد', () => {
  const html = loginPage('student');
  assert.match(html, /name="phone"[^>]*required/u);
  assert.match(html, /data-class-select/u);
  assert.match(html, /الاسم الكامل \(للطالب: اسم رباعي\)/u);
  assert.match(html, /حسابك يعمل فور إنشائه بدون موافقة الإدارة/u);
  const teacher = loginPage('teacher');
  assert.match(teacher, /data-subject-select/u);
  assert.doesNotMatch(teacher, /name="grades"/u);
  assert.match(teacher, /بانتظار اعتماد الإدارة/u);
});

test('الجلسة محفوظة على الجهاز وتُفتح اللوحة تلقائيًا لمن سجّل دخوله', () => {
  const auth = read('../src/auth/auth-service.js');
  const app = read('../src/app.js');
  assert.match(auth, /setPersistence\(authClient, browserLocalPersistence\)/u);
  assert.match(app, /جارٍ فتح لوحتك/u);
});
