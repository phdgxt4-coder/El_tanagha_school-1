import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { isPublicRoute, shouldLockSession, gatedRoute } from '../src/auth/session-gate.js';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('تصنيف المسارات العامة: صفحات البروشور فقط', () => {
  for (const path of ['/', '/subjects', '/subjects/', '/subjects/ar', '/subjects/bio', '/teachers', '/news', '/schedule', '/results', '/contact', '/privacy', '/privacy/']) {
    assert.equal(isPublicRoute(path), true, path);
  }
  for (const path of ['/dashboard', '/login', '/login/student', '/login/parent', '/login/teacher', '/login/admin', '/admin/join', '/admin/teacher-requests', '/subjectsx', '/teachersx', '', 'teachers', null, undefined]) {
    assert.equal(isPublicRoute(path), false, String(path));
  }
});

test('القفل يشمل الأدوار الأربعة النشطة فقط', () => {
  for (const role of ['student', 'teacher', 'parent', 'admin']) {
    assert.equal(shouldLockSession({ role, status: 'active' }), true, role);
  }
  assert.equal(shouldLockSession({ role: 'teacher_applicant', status: 'pending' }), false);
  assert.equal(shouldLockSession({ role: 'teacher', status: 'pending' }), false);
  assert.equal(shouldLockSession({ role: 'teacher_applicant', status: 'rejected' }), false);
  assert.equal(shouldLockSession({ role: 'student', status: 'disabled' }), false);
  assert.equal(shouldLockSession({ role: 'student', status: 'graduated' }), false);
  assert.equal(shouldLockSession({ role: 'student', status: 'none' }), false);
  assert.equal(shouldLockSession({ status: 'active' }), false);
  assert.equal(shouldLockSession(null), false);
  assert.equal(shouldLockSession(undefined), false);
});

test('المسار المقفول يحوّل العام إلى اللوحة فقط أثناء القفل', () => {
  assert.equal(gatedRoute('/', true), '/dashboard');
  assert.equal(gatedRoute('/subjects/ar', true), '/dashboard');
  assert.equal(gatedRoute('/contact', true), '/dashboard');
  assert.equal(gatedRoute('/dashboard', true), '/dashboard');
  assert.equal(gatedRoute('/admin/teacher-requests', true), '/admin/teacher-requests');
  assert.equal(gatedRoute('/login/teacher', true), '/login/teacher');
  assert.equal(gatedRoute('/', false), '/');
  assert.equal(gatedRoute('/subjects', false), '/subjects');
});

test('التطبيق يربط البوابة: توجيه، شعار، إخفاء القائمة، واشتراك الجلسة', () => {
  const app = read('../src/app.js');
  assert.match(app, /session-gate\.js/u);
  assert.match(app, /gatedRoute\(/u);
  assert.match(app, /dataset\.session='active'/u);
  assert.match(app, /initSessionGate\(\)/u);
  assert.match(app, /subscribeToAuth/u);
  const css = read('../styles/main.css');
  assert.match(css, /html\[data-session="active"\] \.topbar \.nav/u);
  assert.match(css, /html\[data-session="active"\] \.topbar \.menu-toggle/u);
  assert.match(css, /html\[data-session="active"\] \.topbar>\.button/u);
  assert.match(css, /html\[data-session="active"\] \.footer/u);
});

test('تسجيل الخروج من اللوحة يبقى يعمل ويعيد لصفحة الدخول', () => {
  const app = read('../src/app.js');
  assert.match(app, /data-dashboard-sign-out/u);
  assert.match(app, /signOutUser\(\)/u);
  const common = read('../src/pages/dashboards/common.js');
  assert.match(common, /data-dashboard-sign-out/u);
});
