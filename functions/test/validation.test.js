import assert from 'node:assert/strict';
import test from 'node:test';
import {InputValidationError,validateAccountRequest} from '../src/validation.js';

test('تقبل الوظيفة طلب طالب بتاريخ ميلاد صحيح وتطبع الاسم والصف',()=>{
  const result=validateAccountRequest({role:'student',displayName:'عبد الرحمن محمود أحمد علي',phone:'01012345678',grade:'3',branch:'science',classId:'c1',birthDate:'2009-04-12'});
  assert.equal(result.displayName,'عبد الرحمن محمود أحمد علي');
  assert.equal(result.grade,'3');
  assert.equal(result.role,'student');
});

test('ترفض الوظيفة تاريخ ميلاد مستحيل أو تاريخًا مستقبليًا',()=>{
  const base={role:'student',displayName:'طالب مجتهد جدا اسمه',phone:'01012345678',grade:'3',branch:'science',classId:'c1'};
  assert.throws(()=>validateAccountRequest({...base,birthDate:'2009-02-29'}),InputValidationError);
  assert.throws(()=>validateAccountRequest({...base,birthDate:'2999-01-01'}),InputValidationError);
});

test('ترفض الوظيفة محاولة التسجيل بدور إدارة',()=>{
  assert.throws(()=>validateAccountRequest({role:'admin',displayName:'مدير المدرسة'}),InputValidationError);
});
