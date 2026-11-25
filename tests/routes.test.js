import assert from 'node:assert/strict';
import test from 'node:test';
import { createRouteHelpers } from '../src/utils/routes.js';

test('المسارات المحلية على جذر النطاق لا تتغير', () => {
  const routes = createRouteHelpers('/', 'https://school.example');
  assert.equal(routes.toUrlPath('/'), '/');
  assert.equal(routes.toUrlPath('/subjects/ar'), '/subjects/ar');
  assert.equal(routes.fromUrlPath('/subjects/ar'), '/subjects/ar');
});

test('المسارات تحت بادئة GitHub Pages تُترجم ذهابًا وإيابًا', () => {
  const routes = createRouteHelpers('/El_tanagha_school-1/', 'https://phdgxt4-coder.github.io');
  assert.equal(routes.toUrlPath('/'), '/El_tanagha_school-1/');
  assert.equal(routes.toUrlPath('/login/student'), '/El_tanagha_school-1/login/student');
  assert.equal(routes.fromUrlPath('/El_tanagha_school-1/login/student'), '/login/student');
  assert.equal(routes.fromUrlPath('/El_tanagha_school-1'), '/');
});

test('لا تُفسَّر مسارات مستودعات أخرى كأنها من التطبيق', () => {
  const routes = createRouteHelpers('/El_tanagha_school-1/', 'https://phdgxt4-coder.github.io');
  assert.equal(routes.fromUrlPath('/another-repository/login'), null);
});
