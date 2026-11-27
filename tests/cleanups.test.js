import test from 'node:test';
import assert from 'node:assert/strict';
import { registerCleanup, runCleanups, pendingCleanups } from '../src/ui/cleanups.js';

test('runCleanups stops every registered listener once', () => {
  let a = 0, b = 0;
  registerCleanup(() => { a += 1; });
  registerCleanup(() => { b += 1; });
  assert.equal(pendingCleanups(), 2);
  runCleanups();
  runCleanups();
  assert.deepEqual([a, b, pendingCleanups()], [1, 1, 0]);
});

test('a throwing stop does not block the others', () => {
  let ran = false;
  registerCleanup(() => { throw new Error('x'); });
  registerCleanup(() => { ran = true; });
  runCleanups();
  assert.equal(ran, true);
});
