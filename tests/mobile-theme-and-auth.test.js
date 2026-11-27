import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loginPage } from '../src/pages/auth-pages.js';
import { schedulePage, subjectPage } from '../src/pages/public-pages.js';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('التسجيل يطلب الهاتف والبريد وكلمة المرور ويستخدم classId حقيقيًا', () => {
  const html = loginPage('student');
  assert.match(html, /name="email" type="email"[^>]*required/u);
  assert.match(html, /name="password" type="password"[^>]*required/u);
  assert.match(html, /name="phone" type="tel"[^>]*required/u);
  assert.match(html, /data-password-reset/u);
  assert.match(html, /name="branch"/u);
  assert.equal((html.match(/name="branch"/gu) || []).length, 1);
  assert.doesNotMatch(html, /name="className"/u);
  assert.match(html, /name="classId"[^>]*required/u);
  assert.doesNotMatch(html, /name="birthDate"/u);
});

test('صفحة دخول الإدارة بعنوانها الصحيح ولا تتيح التسجيل الإداري', () => {
  const html = loginPage('admin');
  assert.match(html, /data-role="admin"/u);
  assert.match(html, /دخول الإدارة/u);
  assert.doesNotMatch(html, /دخول المدرس/u);
  assert.doesNotMatch(html, /id="register-form"/u);
  assert.doesNotMatch(html, /data-auth-mode="register"/u);
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

test('عامل الخدمة يخزّن الملفات الثابتة من نفس النطاق فقط ولا يخزّن بيانات', () => {
  const worker = read('../public/sw.js');
  assert.match(worker, /tn-v1/u);
  assert.match(worker, /url\.origin !== SCOPE\.origin/u);
  assert.match(worker, /request\.method !== 'GET'/u);
  assert.match(read('../index.html'), /rel="manifest"/u);
});

test('لوحة الحساب تتضمن ربط ولي الأمر بكود خادمي', () => {
  const dashboard = read('../src/pages/dashboards/parent.js');
  const app = read('../src/app.js');
  assert.match(dashboard, /data-parent-link/u);
  assert.match(dashboard, /linkParentToStudent/u);
  assert.match(app, /dashboardPage/u);
});

test('دورة ربط الحسابات فورية بدون موافقة إدارة مع كود عشوائي ومحاولات محدودة', () => {
  const dashboard = read('../src/pages/dashboards/student.js') + read('../src/pages/dashboards/parent.js');
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

test('أربع لوحات مختلفة: لكل دور تخطيط وتنقل وألوان وحركة خاصة', () => {
  const css = read('../styles/dashboards.css');
  for (const role of ['student', 'teacher', 'parent', 'admin']) {
    assert.ok(fs.existsSync(new URL(`../src/pages/dashboards/${role}.js`, import.meta.url)));
    assert.match(css, new RegExp(`\\.dash-${role}\\{--d-accent`, 'u'));
  }
  assert.match(css, /stu-tabs/u);
  assert.match(css, /tch-side/u);
  assert.match(css, /par-stats/u);
  assert.match(css, /adm-side/u);
  const accents = [...css.matchAll(/\.dash-(student|teacher|parent|admin)\{--d-accent:(#[0-9a-f]+)/gu)].map(match => match[2]);
  assert.equal(new Set(accents).size, 4);
  assert.match(css, /prefers-reduced-motion:no-preference/u);
});

test('لوحات الأدوار تستخدم الترقيم بالمؤشر ولا تجلب مجموعات كاملة', () => {
  for (const role of ['student', 'teacher', 'parent', 'admin']) {
    const source = read(`../src/pages/dashboards/${role}.js`);
    assert.doesNotMatch(source, /getDocs\(collection\(database, '[a-zA-Z]+'\)\)/u);
  }
  assert.match(read('../src/pages/dashboards/common.js'), /startAfter/u);
});

test('الجلسة محفوظة على الجهاز وتُفتح اللوحة تلقائيًا لمن سجّل دخوله', () => {
  const auth = read('../src/auth/auth-service.js');
  const app = read('../src/app.js');
  assert.match(auth, /setPersistence\(authClient, browserLocalPersistence\)/u);
  assert.match(app, /جارٍ فتح لوحتك/u);
});

test('جرس الإشعارات والعامل اللحظي موجودان في كل لوحة', () => {
  const common = read('../src/pages/dashboards/common.js');
  assert.match(common, /data-bell-slot/u);
  assert.match(common, /mountBell/u);
  assert.match(read('../src/pages/dashboard-pages.js'), /mountBell/u);
  assert.match(read('../src/services/notifications-service.js'), /requestPermission/u);
  assert.ok(fs.existsSync(new URL('../public/push-sw.js', import.meta.url)));
});

test('وضع Spark: كل عملية خادم لها تنفيذ مباشر بنفس الاسم، والوضع الافتراضي spark', () => {
  const auth = read('../src/auth/auth-service.js');
  const sparkSource = read('../src/services/spark-backend.js');
  assert.match(read('../src/config/backend-mode.js'), /'spark'/u);
  const names = [...auth.matchAll(/spark => spark\.(\w+)\(/gu)].map(match => match[1]);
  assert.ok(names.length >= 19);
  for (const name of names) assert.match(sparkSource, new RegExp(`export (async )?function ${name}\\b`, 'u'), name);
  assert.doesNotMatch(sparkSource, /httpsCallable/u);
});

test('لوحة الأدمن فيها زر إرسال رابط كلمة المرور ولا تضع كلمة مرور في الكود', async () => {
  const fs = await import('node:fs');
  const code = fs.readFileSync(new URL('../src/pages/dashboards/admin.js', import.meta.url), 'utf8');
  assert.match(code, /data-reset-link/u);
  assert.match(code, /auth\.sendPasswordReset\(user\.email\)/u);
});
