import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('index.html carries the required meta tags', () => {
  assert.match(html, /<html lang="ar" dir="rtl">/u);
  for (const needle of ['name="description"', 'name="theme-color"', 'rel="manifest"', 'rel="icon"', 'property="og:title"', 'property="og:description"', 'property="og:image"']) {
    assert.ok(html.includes(needle), needle);
  }
});
