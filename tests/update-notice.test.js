import test from 'node:test';
import assert from 'node:assert/strict';
import { initUpdateNotice, isTyping } from '../src/ui/update-notice.js';

function fakeEnv({ controller = {}, active = null } = {}) {
  const listeners = {};
  const body = { children: [], append(el) { el.parent = body; body.children.push(el); } };
  const doc = {
    body, activeElement: active,
    createElement: () => ({ remove() { body.children = body.children.filter(c => c !== this); }, setAttribute() {}, addEventListener() {}, set innerHTML(v) {} }),
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  const swListeners = {};
  const nav = { serviceWorker: { controller, addEventListener: (n, fn) => { swListeners[n] = fn; } } };
  return { doc, nav, win: { setTimeout: fn => fn(), location: {} }, swListeners, listeners, body };
}

test('first visit (no controller): nothing is shown', () => {
  const e = fakeEnv({ controller: null });
  const n = initUpdateNotice(e.nav, e.doc, e.win);
  e.swListeners.controllerchange();
  assert.equal(n.isShown(), false);
});

test('update on a running page shows the notice', () => {
  const e = fakeEnv();
  const n = initUpdateNotice(e.nav, e.doc, e.win);
  e.swListeners.controllerchange();
  assert.equal(n.isShown(), true);
});

test('while typing it is not shown, then appears after the field loses focus', () => {
  const e = fakeEnv({ active: { matches: () => true } });
  assert.equal(isTyping(e.doc), true);
  const n = initUpdateNotice(e.nav, e.doc, e.win);
  e.swListeners.controllerchange();
  assert.equal(n.isShown(), false);
  e.doc.activeElement = null;
  e.listeners.focusout();
  assert.equal(n.isShown(), true);
});

test('focusing a field hides a visible notice', () => {
  const e = fakeEnv();
  const n = initUpdateNotice(e.nav, e.doc, e.win);
  e.swListeners.controllerchange();
  e.doc.activeElement = { matches: () => true };
  e.listeners.focusin();
  assert.equal(n.isShown(), false);
});
