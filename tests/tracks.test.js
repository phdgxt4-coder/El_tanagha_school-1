import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAccountRequest, validateClassInput, validateSubjectInput, TRACKS } from '../functions/src/validation.js';

test('class track must match grade', () => {
  assert.equal(validateClassInput({ grade: '2', section: 'أ', year: '2026-2027', branch: 'bac_med' }).branch, 'bac_med');
  assert.throws(() => validateClassInput({ grade: '2', section: 'أ', year: '2026-2027', branch: 'math' }));
  assert.throws(() => validateClassInput({ grade: '1', section: 'أ', year: '2026-2027', branch: 'science' }));
  assert.equal(validateClassInput({ grade: '1', section: 'أ', year: '2026-2027' }).branch, '');
});
test('subject tracks are validated', () => {
  assert.deepEqual(validateSubjectInput({ name: 'فيزياء', branches: ['math', 'math'] }).branches, ['math']);
  assert.throws(() => validateSubjectInput({ name: 'فيزياء', branches: ['x'] }));
  assert.deepEqual(validateSubjectInput({ name: 'عربي' }).branches, []);
});
test('grade 3 has the old system tracks, grade 2 the four bac tracks', () => {
  assert.equal(Object.keys(TRACKS['2']).length, 4);
  assert.deepEqual(Object.keys(TRACKS['3']), ['science', 'math', 'literary']);
});
