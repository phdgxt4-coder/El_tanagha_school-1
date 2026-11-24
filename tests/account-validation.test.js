import assert from 'node:assert/strict';
import test from 'node:test';
import {InputValidationError,validateAccountRequest,validateRejectionReason} from '../functions/src/validation.js';

test('يقبل طلب طالب سليمًا ويطبع الصف',()=>{
  const result=validateAccountRequest({role:'student',displayName:'  عبد   الرحمن محمود ',grade:'2'});
  assert.equal(result.displayName,'عبد الرحمن محمود');
  assert.equal(result.grade,'2');
  assert.equal(result.role,'student');
});

test('يرفض دور الإدارة وأي دور غير معلن',()=>{
  assert.throws(()=>validateAccountRequest({role:'admin',displayName:'مدير المدرسة'}),InputValidationError);
  assert.throws(()=>validateAccountRequest({role:'unknown',displayName:'اسم صحيح'}),InputValidationError);
});

test('يرفض أسماء مفقودة أو مدخلات HTML',()=>{
  assert.throws(()=>validateAccountRequest({role:'parent',displayName:''}),InputValidationError);
  assert.throws(()=>validateAccountRequest({role:'parent',displayName:'<script>alert(1)</script>'}),InputValidationError);
});

test('يشترط صفًا صالحًا للطالب ويقبل عدم وجود رقم لولي الأمر',()=>{
  assert.throws(()=>validateAccountRequest({role:'student',displayName:'طالب مجتهد',grade:'4'}),InputValidationError);
  const parent=validateAccountRequest({role:'parent',displayName:'ولي أمر'});
  assert.equal(parent.role,'parent');
  assert.equal(parent.phone,undefined);
});

test('يتحقق من التخصص ويحتفظ بموافقة النشر كقيمة صريحة فقط',()=>{
  const privateTeacher=validateAccountRequest({role:'teacher',displayName:'أحمد محمد',subjectId:'math',publishConsent:false});
  assert.equal(privateTeacher.subjectName,'الرياضيات');
  assert.equal(privateTeacher.publishConsent,false);
  assert.throws(()=>validateAccountRequest({role:'teacher',displayName:'أحمد محمد',subjectId:'hacking',publishConsent:true}),InputValidationError);
});

test('يتحقق من رقم الهاتف الاختياري وسبب الرفض',()=>{
  assert.throws(()=>validateAccountRequest({role:'parent',displayName:'ولي أمر',phone:'<img src=x>'}),InputValidationError);
  assert.equal(validateRejectionReason('لا توجد بيانات كافية'),'لا توجد بيانات كافية');
  assert.throws(()=>validateRejectionReason('<b>مرفوض</b>'),InputValidationError);
});
