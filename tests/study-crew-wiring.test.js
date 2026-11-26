import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDirector } from '../src/studycrew/Living/director.js';
import { COPY } from '../src/studycrew/Living/emotion.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const D = (focus, extra = {}) => createDirector({ rand: () => 0, getFocus: () => focus, prefs: () => ({ sound: true, haptics: true }), ...extra });

test('كل موضع ظهور له نص مصري في COPY.hints', () => {
  for (const key of ['tasks', 'grades', 'teacher', 'parent', 'notFound', 'offline', 'online']) {
    assert.ok(COPY.hints[key], key);
  }
});

test('حدث hint: يتكلم أثناء التصفح ويصمت في القراءة والكتابة وصمت مطلق في الامتحان', () => {
  const out = D('browsing')('hint', { hint: 'tasks' });
  assert.equal(out.show, true);
  assert.equal(out.message, COPY.hints.tasks);
  assert.equal(out.tier, 'none');
  for (const mode of ['reading', 'typing']) {
    assert.equal(D(mode)('hint', { hint: 'tasks' }).message, '', mode);
  }
  assert.equal(D('exam')('hint', { hint: 'tasks' }).show, false);
  assert.equal(D('browsing')('hint', { hint: 'unknown-spot' }).show, false);
});

test('wire.js يضع الشخصيات الخمس في مواضعها ويبقى كسولًا وصامتًا في الامتحان', () => {
  const wire = read('../src/studycrew/Living/wire.js');
  for (const id of ["'alex'", "'arthur'", "'oscar'", "'leo'", "'chloe'"]) {
    assert.ok(wire.includes(id), id);
  }
  assert.match(wire, /data-panel="tasks"/u);
  assert.match(wire, /data-panel="grades"/u);
  assert.match(wire, /\.dash-teacher/u);
  assert.match(wire, /\.dash-parent/u);
  assert.match(wire, /data-page="404"/u);
  assert.match(wire, /addEventListener\('offline'/u);
  assert.match(wire, /addEventListener\('online'/u);
  assert.match(wire, /NotificationCharacter/u);
  assert.match(wire, /getFocus\(\)==='exam'/u);
  assert.match(wire, /attributeFilter:\['data-kind','hidden'\]/u);
  assert.match(wire, /sessionStorage/u);
});

test('صفحة 404 تحمل خطاف الكشف', () => {
  assert.match(read('../src/pages/public-pages.js'), /data-page="404"/u);
});

test('الشخصيات الخمس مسجلة وتُحمَّل كسولًا وحدها', () => {
  const registry = read('../src/studycrew/Characters/registry.js');
  for (const id of ['alex', 'arthur', 'oscar', 'leo', 'chloe']) {
    assert.match(registry, new RegExp(`${id}:\\(\\)=>import\\(`, 'u'), id);
  }
});

test('لا استيراد جديد للشخصيات خارج الطبقة الكسولة', () => {
  const app = read('../src/app.js');
  assert.equal((app.match(/studycrew/gu) || []).length, 1, 'app.js يستورد Living/wire.js كسولًا فقط');
});
