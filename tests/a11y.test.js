import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('تبويبات الدخول تستخدم role=tab داخل tablist', () => {
  const html = read('../src/pages/auth-pages.js');
  assert.match(html, /role="tablist"/u);
  assert.equal((html.match(/class="auth-tab[^"]*" role="tab"/gu) ?? []).length, 2);
});

test('لوحات الحسابات تسمّي الحقول بلا تسمية', () => {
  assert.match(read('../src/pages/dashboards/common.js'), /export function labelOrphans/u);
  assert.match(read('../src/pages/dashboard-pages.js'), /labelOrphans\(root\)/u);
});
