import assert from 'node:assert/strict';
import test from 'node:test';
import {InputValidationError,normalizeArabicName,normalizePhone,validateAccountRequest,validateClassInput,validateRejectionReason,validateRosterRows,validateSubjectInput} from '../functions/src/validation.js';

test('يقبل طلب طالب سليمًا ويطبع الصف',()=>{
  const result=validateAccountRequest({role:'student',displayName:'  عبد   الرحمن محمود أحمد علي ',phone:'01012345678',grade:'2',branch:'bac_med',classId:'c1'});
  assert.equal(result.displayName,'عبد الرحمن محمود أحمد علي');
  assert.equal(result.phoneKey,'01012345678');
  assert.equal(result.grade,'2');
  assert.equal(result.role,'student');
  assert.equal(result.branch,'bac_med');
});

test('يرفض دور الإدارة وأي دور غير معلن',()=>{
  assert.throws(()=>validateAccountRequest({role:'admin',displayName:'مدير المدرسة'}),InputValidationError);
  assert.throws(()=>validateAccountRequest({role:'unknown',displayName:'اسم صحيح'}),InputValidationError);
});

test('يرفض أسماء مفقودة أو مدخلات HTML',()=>{
  assert.throws(()=>validateAccountRequest({role:'parent',displayName:''}),InputValidationError);
  assert.throws(()=>validateAccountRequest({role:'parent',displayName:'<script>alert(1)</script>'}),InputValidationError);
});

test('يشترط صفًا صالحًا والاسم الرباعي والهاتف للطالب',()=>{
  assert.throws(()=>validateAccountRequest({role:'student',displayName:'طالب مجتهد',phone:'01012345678',grade:'1',classId:'c1'}),InputValidationError);
  assert.throws(()=>validateAccountRequest({role:'student',displayName:'طالب مجتهد جدا اسمه',grade:'1',classId:'c1'}),InputValidationError);
  assert.throws(()=>validateAccountRequest({role:'student',displayName:'طالب مجتهد جدا اسمه',phone:'01012345678',grade:'4',branch:'science',classId:'c1'}),InputValidationError);
  const parent=validateAccountRequest({role:'parent',displayName:'ولي أمر',phone:'+20 101 234 5678'});
  assert.equal(parent.role,'parent');
  assert.equal(parent.phoneKey,'01012345678');
});

test('يتحقق من التخصص ويحتفظ بموافقة النشر كقيمة صريحة فقط',()=>{
  const privateTeacher=validateAccountRequest({role:'teacher',displayName:'أحمد محمد',phone:'01012345678',subjectId:'math',publishConsent:false});
  assert.equal(privateTeacher.subjectId,'math');
  assert.equal(privateTeacher.publishConsent,false);
  assert.throws(()=>validateAccountRequest({role:'teacher',displayName:'أحمد محمد',phone:'01012345678',subjectId:'bad id!',publishConsent:true}),InputValidationError);
});

test('يتحقق من رقم الهاتف وسبب الرفض',()=>{
  assert.throws(()=>validateAccountRequest({role:'parent',displayName:'ولي أمر',phone:'<img src=x>'}),InputValidationError);
  assert.equal(validateRejectionReason('لا توجد بيانات كافية'),'لا توجد بيانات كافية');
  assert.throws(()=>validateRejectionReason('<b>مرفوض</b>'),InputValidationError);
});

test('يطبّع الاسم العربي والهاتف لمطابقة قائمة المدرسة',()=>{
  assert.equal(normalizeArabicName('  أَحمد   إبراهيم عليّ '),normalizeArabicName('احمد ابراهيم علي'.replace('علي','علي')));
  assert.equal(normalizePhone('+20 101 390 5431'),'01013905431');
  assert.equal(normalizePhone('٠١٠١٣٩٠٥٤٣١'),'01013905431');
});

test('يتحقق من الفصل والمادة وملف الاستيراد',()=>{
  const cls=validateClassInput({grade:'1',section:'أ',year:'2026-2027'});
  assert.equal(cls.name,'الأول الثانوي - أ');
  assert.throws(()=>validateClassInput({grade:'9',section:'أ'}),InputValidationError);
  assert.throws(()=>validateSubjectInput({name:'<b>x</b>'}),InputValidationError);
  const rows=validateRosterRows([{fullName:'محمد أحمد علي حسن',phone:'01012345678',classId:'c1'}]);
  assert.equal(rows[0].phoneKey,'01012345678');
  assert.throws(()=>validateRosterRows([{fullName:'محمد أحمد',phone:'01012345678',classId:'c1'}]),InputValidationError);
  assert.throws(()=>validateRosterRows([]),InputValidationError);
});
