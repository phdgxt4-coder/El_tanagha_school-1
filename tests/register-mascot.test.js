import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DANCES, DEFAULT_DANCE, REGISTER_LINE } from '../src/studycrew/Living/register-mascot.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('register mascot says "يلا سجل" and offers 4 dance options with a valid default', () => {
  assert.equal(REGISTER_LINE, 'يلا سجل!');
  assert.equal(Object.keys(DANCES).length, 4);
  assert.ok(DANCES[DEFAULT_DANCE], 'default dance exists');
  for (const d of Object.values(DANCES)) {
    assert.ok(d.ms >= 700 && d.ms <= 2600, 'duration inside character motion budget');
    const props = d.frames.flatMap(f => Object.keys(f)).filter(k => k !== 'offset');
    assert.deepEqual([...new Set(props)], ['transform'], 'transform only');
    assert.equal(d.frames.at(-1).transform, d.frames[0].transform, 'loop closes cleanly');
  }
});

test('register mascot is lazy, exam-silent, reduced-motion aware and never touches the form', () => {
  const mod = read('../src/studycrew/Living/register-mascot.js');
  assert.match(mod, /reducedMotion/u);
  assert.match(mod, /getFocus\(\)!=='exam'/u);
  assert.match(mod, /arthur/u);
  assert.match(mod, /visibilitychange/u);
  assert.ok(!/querySelector\([^)]*input|\.value\s*=|submit/u.test(mod), 'no form interaction');
  const wire = read('../src/studycrew/Living/wire.js');
  assert.match(wire, /import\('\.\/register-mascot\.js'\)/u, 'wire lazy-imports the module');
  const app = read('../src/app.js');
  assert.equal((app.match(/studycrew/gu) || []).length, 1, 'app.js keeps its single lazy import');
});

test('register mascot styles reserve space and hide in exams', () => {
  const css = read('../styles/living.css');
  assert.match(css, /\.sc-register-mascot\{[^}]*block-size/u);
  assert.match(css, /\[data-sc-focus=exam\] \.sc-register-mascot\{display:none!important\}/u);
});
