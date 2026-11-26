import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('لوحة الإدارة: قائمة الأقسام تلف على شبكة كاملة العناوين تحت سطح المكتب', () => {
  const css = read('../styles/dashboards.css');
  assert.match(css, /@media\(max-width:959\.98px\)/u);
  assert.match(css, /\.adm-side nav\{display:grid;grid-template-columns:repeat\(auto-fill,minmax\(9\.5rem,1fr\)\);overflow:visible\}/u);
  assert.match(css, /\.adm-side nav button\{white-space:normal/u);
});

test('إحصاءات ولي الأمر: القيم الطويلة تلتف ولا تفيض على الهاتف', () => {
  const css = read('../styles/dashboards.css');
  assert.match(css, /\.par-stats strong\{overflow-wrap:anywhere\}/u);
});

test('أهداف اللمس لا تقل عن 44px في اللوحات', () => {
  const css = read('../styles/dashboards.css');
  assert.match(css, /\.bell-btn\{flex:none;width:44px\}/u);
  assert.match(css, /\.tch-chip\{min-height:44px;min-width:44px\}/u);
});

test('لا فيض أفقي: القاعدة العامة وقواعد الجداول موجودة', () => {
  const css = read('../styles/dashboards.css');
  assert.match(css, /html\{overflow-x:clip;max-width:100%\}/u);
  assert.match(css, /\.adm-table,\.tch-table\{display:block;overflow-x:auto;max-width:100%\}/u);
  assert.match(css, /\.dash,\.dash \*\{min-width:0\}/u);
});
