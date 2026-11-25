import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, chartSvg, reportHtml } from '../src/pages/report-card.js';

test('buildReport: متوسط المواد والعام ونسبة الحضور', () => {
  const report = buildReport(
    [{ subjectName: 'رياضيات', score: 18, max: 20 }, { subjectName: 'رياضيات', score: 10, max: 20 }, { subjectName: 'عربي', score: 30, max: 40 }, { subjectName: 'x', score: 5, max: 0 }],
    [{ present: true }, { present: true }, { present: false }, { present: true }]
  );
  assert.deepEqual(report.subjects.map(item => [item.subject, item.percent]), [['رياضيات', 70], ['عربي', 75]]);
  assert.equal(report.overall, 73);
  assert.equal(report.attendance.rate, 75);
  assert.equal(report.attendance.absent, 1);
});

test('بدون بيانات: لا أخطاء ولا قيم مختلقة', () => {
  const report = buildReport([], []);
  assert.equal(report.overall, null);
  assert.equal(report.attendance.rate, null);
  assert.equal(chartSvg([]), '');
});

test('الشهادة تهرب النصوص', () => {
  const html = reportHtml({ name: '<img src=x onerror=1>', className: '1/1' }, buildReport([], []), '1/1/2027');
  assert.ok(!html.includes('<img src=x'));
});
