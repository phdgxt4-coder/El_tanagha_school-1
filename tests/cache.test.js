import assert from 'node:assert/strict';
import test from 'node:test';
import { cacheGet, cacheInvalidate, cached } from '../src/services/cache.js';

test('الكاش يعيد القيمة المخزنة ولا يكرر الجلب أثناء الصلاحية', async () => {
  let calls = 0;
  const loader = async () => { calls += 1; return ['a']; };
  const [first, second] = await Promise.all([cached('t1', 1000, loader), cached('t1', 1000, loader)]);
  assert.deepEqual(first, ['a']);
  assert.deepEqual(second, ['a']);
  await cached('t1', 1000, loader);
  assert.equal(calls, 1);
  cacheInvalidate('t1');
  assert.equal(cacheGet('t1'), undefined);
  await cached('t1', 1000, loader);
  assert.equal(calls, 2);
});

test('انتهاء المدة يُعيد الجلب', async () => {
  let calls = 0;
  await cached('t2', 1, async () => { calls += 1; return 1; });
  await new Promise(resolve => setTimeout(resolve, 10));
  await cached('t2', 1, async () => { calls += 1; return 1; });
  assert.equal(calls, 2);
});
