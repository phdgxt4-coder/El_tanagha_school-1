import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNotice, uniqueRecipients, wantsNotice } from '../src/notice-text.js';

test('نص إشعار الدرجة يحمل المادة والنتيجة', () => {
  const notice = buildNotice('grade', { subjectName: 'الفيزياء', title: 'اختبار', score: 18, max: 20 });
  assert.equal(notice.title, 'درجة جديدة');
  assert.match(notice.body, /الفيزياء: اختبار \(18\/20\)/u);
});
test('نوع غير معروف يُرفض ونصوص الدردشة تُقص', () => {
  assert.throws(() => buildNotice('x'), /unknown-type/u);
  assert.equal(buildNotice('chat', { fromName: 'أ', text: 'ب'.repeat(300) }).body.length, 100);
});
test('المستلمون بلا تكرار وبدون صاحب الفعل، والتفضيلات تحترم الإيقاف', () => {
  assert.deepEqual(uniqueRecipients(['a', 'b', 'a', '', 'c'], 'c'), ['a', 'b']);
  assert.equal(wantsNotice({ grade: false }, 'grade'), false);
  assert.equal(wantsNotice(null, 'grade'), true);
});
