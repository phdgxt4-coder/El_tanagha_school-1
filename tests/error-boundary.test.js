import assert from 'node:assert/strict';
import test from 'node:test';
import { isNoise, scrubMessage, errorCardHtml } from '../src/ui/error-boundary.js';

test('الضوضاء المعروفة لا تُظهر شاشة خطأ', () => {
  assert.equal(isNoise('ResizeObserver loop completed with undelivered notifications.'), true);
  assert.equal(isNoise('Script error.'), true);
  assert.equal(isNoise(''), true);
  assert.equal(isNoise('Cannot read properties of undefined'), false);
});

test('سجل الأخطاء يقنّع البريد والهاتف وكود الربط والمعرّفات', () => {
  const text = scrubMessage('fail for a.b@school.edu.eg phone 01012345678 code TNG-ABCDEFGH1234 uid OvfAm0iKEOaI17xH1nOk5zZNp8uq');
  assert.doesNotMatch(text, /@school/u);
  assert.doesNotMatch(text, /01012345678/u);
  assert.doesNotMatch(text, /TNG-ABCDEFGH1234/u);
  assert.doesNotMatch(text, /OvfAm0iKEOaI17xH1nOk5zZNp8uq/u);
  assert.match(text, /\[email\]/u);
});

test('بطاقة الخطأ عربية وفيها زر إعادة المحاولة بلا رسالة خام', () => {
  const html = errorCardHtml('تعذر عرض الصفحة', 'حاول مرة أخرى');
  assert.match(html, /إعادة المحاولة/u);
  assert.match(html, /role="alert"/u);
});

test('scrubMessage يقبل حدًا أقصى اختياريًا للطول', () => {
  const long = 'أ'.repeat(500);
  assert.equal(scrubMessage(long).length, 300);
  assert.equal(scrubMessage(long, 1500).length, 500);
  assert.equal(scrubMessage(long, 50).length, 50);
});
