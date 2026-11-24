export const SUBJECTS = Object.freeze({
  ar: 'اللغة العربية',
  en: 'اللغة الإنجليزية',
  math: 'الرياضيات',
  phy: 'الفيزياء',
  chem: 'الكيمياء',
  bio: 'الأحياء',
  hist: 'التاريخ',
  geo: 'الجغرافيا',
  phil: 'الفلسفة',
  psy: 'علم النفس',
  fr: 'اللغة الفرنسية'
});

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]{1,78}[\p{L}\p{M}]$/u;
const PHONE_RE = /^\+?[0-9][0-9()\s.-]{5,18}[0-9]$/;
const GRADES = new Set(['1', '2', '3']);
const ROLES = new Set(['student', 'parent', 'teacher']);

export class InputValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputValidationError';
  }
}

function requiredString(value, field, maxLength) {
  if (typeof value !== 'string') throw new InputValidationError(`حقل ${field} غير صالح.`);
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (!normalized || normalized.length > maxLength) {
    throw new InputValidationError(`تحقق من حقل ${field}.`);
  }
  return normalized;
}

export function validateAccountRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InputValidationError('بيانات التسجيل غير صالحة.');
  }
  if (!ROLES.has(input.role)) throw new InputValidationError('نوع الحساب غير متاح.');

  const displayName = requiredString(input.displayName, 'الاسم', 80);
  if (!NAME_RE.test(displayName)) throw new InputValidationError('اكتب الاسم بحروف صحيحة.');

  const result = { role: input.role, displayName };
  if (input.phone != null && input.phone !== '') {
    const phone = requiredString(input.phone, 'الهاتف', 24);
    if (!PHONE_RE.test(phone)) throw new InputValidationError('رقم الهاتف غير صالح.');
    result.phone = phone;
  }

  if (input.role === 'student') {
    const grade = String(input.grade ?? '');
    if (!GRADES.has(grade)) throw new InputValidationError('اختر الصف الدراسي الصحيح.');
    result.grade = grade;
  }

  if (input.role === 'teacher') {
    const subjectId = requiredString(input.subjectId, 'التخصص', 12);
    if (!Object.hasOwn(SUBJECTS, subjectId)) throw new InputValidationError('اختر تخصصًا من القائمة.');
    result.subjectId = subjectId;
    result.subjectName = SUBJECTS[subjectId];
    result.publishConsent = input.publishConsent === true;
  }

  return Object.freeze(result);
}

export function validateRejectionReason(value) {
  if (value == null || value === '') return '';
  const reason = requiredString(value, 'سبب الرفض', 300);
  if (/[<>]/u.test(reason)) throw new InputValidationError('سبب الرفض يحتوي على محارف غير مسموحة.');
  return reason;
}
