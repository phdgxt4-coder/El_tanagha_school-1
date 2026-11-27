import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprint } from '../src/services/error-tracker.js';

test('بصمة الخطأ ثابتة لنفس النوع والرسالة والملف', () => {
  const a = fingerprint('error', 'Cannot read properties of undefined', 'app.js');
  const b = fingerprint('error', 'Cannot read properties of undefined', 'app.js');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{16}$/);
});

test('البصمة تتجاهل الأرقام في الرسالة وتتغير مع النوع أو الملف', () => {
  const a = fingerprint('error', 'فشل تحميل 42 عنصرًا', 'app.js');
  const b = fingerprint('error', 'فشل تحميل 7 عنصرًا', 'app.js');
  assert.equal(a, b);
  assert.notEqual(fingerprint('promise', 'فشل تحميل 42 عنصرًا', 'app.js'), a);
  assert.notEqual(fingerprint('error', 'فشل تحميل 42 عنصرًا', 'other.js'), a);
});
