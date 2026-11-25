import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readXlsxRows, rosterLinesFromRows } from '../src/utils/xlsx-reader.js';

test('قراءة ملف xlsx: نصوص عربية ورموز XML وأرقام هاتف بدون صفر أول', async () => {
  const file = fs.readFileSync(new URL('./fixtures/roster.xlsx', import.meta.url));
  const rows = await readXlsxRows(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[1], ['محمد أحمد علي حسن', '01012345678']);
  const lines = rosterLinesFromRows(rows);
  assert.equal(lines.length, 3);
  assert.equal(lines[1], 'سارة محمود إبراهيم خليل, 01022334455');
  assert.match(lines[2], /& <خالد>/u);
});

test('ملف غير xlsx يرفض', async () => {
  await assert.rejects(() => readXlsxRows(new TextEncoder().encode('hello world, not a zip file at all').buffer));
});
