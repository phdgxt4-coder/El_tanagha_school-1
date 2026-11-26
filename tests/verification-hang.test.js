import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { withTimeout } from '../src/utils/load-state.js';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('withTimeout يرفض الوعد المعلّق بدل الانتظار للأبد', async () => {
  const hanging = new Promise(() => {});
  await assert.rejects(withTimeout(hanging, 5), error => error?.code === 'load-timeout');
});

test('withTimeout يمرر النتيجة عند نجاح الوعد في الوقت', async () => {
  assert.equal(await withTimeout(Promise.resolve(42), 50), 42);
});

test('قراءة حالة الحساب محددة بزمن: تحديث المستخدم وقراءتا Firestore', () => {
  const spark = read('../src/services/spark-backend.js');
  assert.match(spark, /withTimeout\(user\.reload\(\),\s*10000\)/u);
  assert.match(spark, /withTimeout\(getDoc\(doc\(database,\s*'admins'/u);
  assert.match(spark, /withTimeout\(getDoc\(doc\(database,\s*'profiles'/u);
});

test('شاشة الدخول لا تعلق: حالة الحساب في الدخول والتسجيل والاشتراك محددة بزمن', () => {
  const app = read('../src/app.js');
  assert.match(app, /await withTimeout\(api\.getMyAccountStatus\(\)\)/u);
  assert.match(app, /await withTimeout\(api\.submitAccountRequest\(profile\)\)/u);
  assert.match(app, /await withTimeout\(api\.createAuthUser\(email,password\)\)/u);
});

test('زر «وثّقت بريدي» يحدّث الجلسة في مكانها بدل إعادة تحميل الصفحة', () => {
  const page = read('../src/pages/dashboard-pages.js');
  assert.match(page, /withTimeout\(user\.reload\(\),10000\)/u);
  assert.doesNotMatch(page, /data-check-verify[\s\S]{0,400}location\.reload\(\)/u);
});

test('فشل تحميل اللوحة يعرض زر إعادة محاولة بدل هيكل معلّق', () => {
  const page = read('../src/pages/dashboard-pages.js');
  assert.match(page, /settleWithRetry/u);
  assert.match(page, /withTimeout\(auth\.getMyAccountStatus\(\)\)/u);
  assert.match(page, /withTimeout\(getDoc\(doc\(database,'profiles',user\.uid\)\)/u);
});

test('رسالة الخطأ المفهومة تغطي مهلة التحميل', () => {
  const auth = read('../src/auth/auth-service.js');
  assert.match(auth, /'load-timeout':/u);
});
