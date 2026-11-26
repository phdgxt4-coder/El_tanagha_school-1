import test from 'node:test';
import assert from 'node:assert/strict';
import { loadErrorMessage, withTimeout } from '../src/utils/load-state.js';

test('permission-denied and missing index say the service is unavailable', () => {
  assert.match(loadErrorMessage({ code: 'permission-denied' }), /غير متاحة/u);
  assert.match(loadErrorMessage({ code: 'failed-precondition' }), /غير متاحة/u);
});

test('network problems and timeouts get the connection message, others the generic one', () => {
  assert.match(loadErrorMessage({ code: 'unavailable' }), /بطيء/u);
  assert.match(loadErrorMessage({ code: 'load-timeout' }), /بطيء/u);
  assert.match(loadErrorMessage(new Error('boom')), /تعذر تحميل/u);
});

test('withTimeout rejects a promise that never settles, and passes a fast one through', async () => {
  await assert.rejects(() => withTimeout(new Promise(() => {}), 20), error => error.code === 'load-timeout');
  assert.equal(await withTimeout(Promise.resolve(7), 50), 7);
});
