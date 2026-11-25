import assert from 'node:assert/strict';
import test from 'node:test';
import {InputValidationError,validateAccountRequest} from '../src/validation.js';

test('تقبل الوظيفة طلب طالب بتاريخ ميلاد صحيح وتطبع الاسم والصف',()=>{
  const result=validateAccountRequest({role:'student',displayName:'عبد الرحمن محمود',grade:'1',branch:'science',className:'1/أ',birthDate:'2009-04-12'});
  assert.equal(result.displayName,'عبد الرحمن محمود');
  assert.equal(result.grade,'1');
  assert.equal(result.role,'student');
});

test('ترفض الوظيفة تاريخ ميلاد مستحيل أو تاريخًا مستقبليًا',()=>{
  const base={role:'student',displayName:'طالب مجتهد',grade:'1',branch:'science',className:'1/أ'};
  assert.throws(()=>validateAccountRequest({...base,birthDate:'2009-02-29'}),InputValidationError);
  assert.throws(()=>validateAccountRequest({...base,birthDate:'2999-01-01'}),InputValidationError);
});

test('ترفض الوظيفة محاولة التسجيل بدور إدارة',()=>{
  assert.throws(()=>validateAccountRequest({role:'admin',displayName:'مدير المدرسة'}),InputValidationError);
});
