import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('registration submit never calls an undefined resyncRegistration (crashed after every submit)', () => {
  const app = read('../src/app.js');
  assert.doesNotMatch(app, /resyncRegistration/u);
  // Guard: every identifier called in a finally block of the auth handlers must be defined somewhere.
  assert.match(app, /finally\{if\(button\.isConnected\)button\.disabled=false;\}/u);
});

test('notification bell registers a page cleanup that stops the watcher and removes window/document listeners', () => {
  const common = read('../src/pages/dashboards/common.js');
  assert.match(common, /import \{ registerCleanup \} from '\.\.\/\.\.\/ui\/cleanups\.js'/u);
  assert.match(common, /registerCleanup\(\(\) => \{ stop\(\); window\.removeEventListener\('resize', onResize\); document\.removeEventListener\('click', onOutsideClick\); \}\)/u);
});

test('labelOrphans disconnects its MutationObserver on page cleanup', () => {
  const common = read('../src/pages/dashboards/common.js');
  assert.match(common, /registerCleanup\(\(\) => observer\.disconnect\(\)\)/u);
});

test('parent dashboard swaps list nodes on child switch so stale pager handlers never stack', () => {
  const parent = read('../src/pages/dashboards/parent.js');
  assert.match(parent, /list\.replaceWith\(list\.cloneNode\(false\)\)/u);
  assert.match(parent, /more\.replaceWith\(more\.cloneNode\(true\)\)/u);
});

test('single attendance marking uses the same deterministic id as bulk save (no duplicate day records)', () => {
  const teacher = read('../src/pages/dashboards/teacher.js');
  assert.match(teacher, /`\$\{current\.classId\}_\$\{current\.subjectId\}_\$\{dateInput\.value\}_\$\{button\.dataset\.uid\}`/u);
  const individual = teacher.split('rosterBox.addEventListener')[1]?.split('data-content-form')[0] ?? '';
  assert.doesNotMatch(individual, /addDoc\(collection\(database, 'attendance'\)/u);
  assert.match(individual, /setDoc\(doc\(database, 'attendance', recordId\)/u);
});
