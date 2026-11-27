import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttemptLimiter } from '../src/utils/attempt-limiter.js';

test('locks after max failures and unlocks after the cooldown', () => {
  let t = 1000;
  const l = createAttemptLimiter({ max: 3, cooldownMs: 5000, now: () => t });
  l.fail(); l.fail();
  assert.equal(l.remainingMs(), 0);
  l.fail();
  assert.equal(l.remainingMs(), 5000);
  t += 5001;
  assert.equal(l.remainingMs(), 0);
});

test('success resets the counter', () => {
  const l = createAttemptLimiter({ max: 2 });
  l.fail(); l.succeed(); l.fail();
  assert.equal(l.remainingMs(), 0);
});
