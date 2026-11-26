import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate } from '../src/pages/dashboards/common.js';

// 22:30 UTC on 25 Nov is 00:30 on 26 Nov in Cairo (UTC+2 in November), whatever the device time zone is.
test('dates are shown in Cairo time, not the device time zone', () => {
  const text = formatDate(new Date('2026-11-25T22:30:00Z'));
  assert.match(text, /٢٦/u);
  assert.doesNotMatch(text, /٢٥/u);
});
