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
const BRANCHES = new Set(['science', 'math', 'literary']);
const ROLES = new Set(['student', 'parent', 'teacher']);
const GRADE_LABELS = Object.freeze({ '1': 'الأول الثانوي', '2': 'الثاني الثانوي', '3': 'الثالث الثانوي' });

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

export function normalizeArabicName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/gu, '')
    .replace(/[أإآ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

export function normalizePhone(value) {
  let digits = String(value ?? '')
    .replace(/[\u0660-\u0669]/gu, ch => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[^0-9]/gu, '');
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`;
  return digits;
}

function validId(value, field) {
  const id = requiredString(value, field, 64);
  if (!/^[A-Za-z0-9_-]{1,64}$/u.test(id)) throw new InputValidationError(`معرّف ${field} غير صالح.`);
  return id;
}

export function validateAccountRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InputValidationError('بيانات التسجيل غير صالحة.');
  }
  if (!ROLES.has(input.role)) throw new InputValidationError('نوع الحساب غير متاح.');

  const displayName = requiredString(input.displayName, 'الاسم', 80);
  if (!NAME_RE.test(displayName)) throw new InputValidationError('اكتب الاسم بحروف صحيحة.');
  if (input.role === 'student' && displayName.split(' ').length < 4) {
    throw new InputValidationError('اكتب الاسم الرباعي للطالب.');
  }

  const result = { role: input.role, displayName };
  const phone = requiredString(input.phone, 'الهاتف', 24);
  if (!PHONE_RE.test(phone)) throw new InputValidationError('رقم الهاتف غير صالح.');
  result.phone = phone;
  result.phoneKey = normalizePhone(phone);
  if (result.phoneKey.length < 7) throw new InputValidationError('رقم الهاتف غير صالح.');

  if (input.role === 'student') {
    const grade = String(input.grade ?? '');
    if (!GRADES.has(grade)) throw new InputValidationError('اختر الصف الدراسي الصحيح.');
    result.grade = grade;
    if (input.classId != null && input.classId !== '') result.classId = validId(input.classId, 'الفصل');
    const branch = String(input.branch ?? '');
    if (branch && !BRANCHES.has(branch)) throw new InputValidationError('اختر الشعبة الدراسية الصحيحة.');
    result.branch = branch;
    if (input.className != null && input.className !== '') result.className = requiredString(input.className, 'الفصل', 40);
    if (!result.classId && !result.className) throw new InputValidationError('اختر الفصل.');
    if (input.birthDate != null && input.birthDate !== '') {
      const birthDate = String(input.birthDate);
      const parsedBirthDate = /^\d{4}-\d{2}-\d{2}$/u.test(birthDate)
        ? new Date(`${birthDate}T00:00:00.000Z`)
        : null;
      if (!parsedBirthDate || Number.isNaN(parsedBirthDate.getTime())
          || parsedBirthDate.toISOString().slice(0, 10) !== birthDate
          || parsedBirthDate.getTime() > Date.now()) {
        throw new InputValidationError('أدخل تاريخ الميلاد الصحيح.');
      }
      result.birthDate = birthDate;
    }
  }

  if (input.role === 'teacher') {
    const subjectId = requiredString(input.subjectId, 'التخصص', 32);
    if (!/^[A-Za-z0-9_-]{1,32}$/u.test(subjectId)) throw new InputValidationError('اختر تخصصًا من القائمة.');
    result.subjectId = subjectId;
    result.publishConsent = input.publishConsent === true;
  }

  return Object.freeze(result);
}

export function validateClassInput(input) {
  if (!input || typeof input !== 'object') throw new InputValidationError('بيانات الفصل غير صالحة.');
  const grade = String(input.grade ?? '');
  if (!GRADES.has(grade)) throw new InputValidationError('اختر الصف الدراسي.');
  const section = requiredString(input.section, 'الفصل', 20);
  if (/[<>]/u.test(section)) throw new InputValidationError('اسم الفصل يحتوي على محارف غير مسموحة.');
  const year = requiredString(input.year ?? '2026-2027', 'العام الدراسي', 9);
  if (!/^\d{4}-\d{4}$/u.test(year)) throw new InputValidationError('العام الدراسي غير صالح.');
  return { grade, section, year, name: `${GRADE_LABELS[grade]} - ${section}` };
}

export function validateSubjectInput(input) {
  if (!input || typeof input !== 'object') throw new InputValidationError('بيانات المادة غير صالحة.');
  const name = requiredString(input.name, 'اسم المادة', 60);
  if (/[<>]/u.test(name)) throw new InputValidationError('اسم المادة يحتوي على محارف غير مسموحة.');
  return { name };
}

export function validateRosterRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new InputValidationError('لا توجد صفوف للاستيراد.');
  if (rows.length > 300) throw new InputValidationError('الحد الأقصى 300 طالب في الدفعة الواحدة.');
  return rows.map((row, index) => {
    const line = index + 1;
    const fullName = requiredString(row?.fullName, `الاسم في السطر ${line}`, 80);
    if (!NAME_RE.test(fullName) || fullName.split(' ').length < 4) {
      throw new InputValidationError(`الاسم في السطر ${line} يجب أن يكون رباعيًا.`);
    }
    const phoneKey = normalizePhone(row?.phone);
    if (phoneKey.length < 7) throw new InputValidationError(`الهاتف في السطر ${line} غير صالح.`);
    return { fullName, phoneKey, classId: validId(row?.classId, `الفصل في السطر ${line}`) };
  });
}

export function validateRejectionReason(value) {
  if (value == null || value === '') return '';
  const reason = requiredString(value, 'سبب الرفض', 300);
  if (/[<>]/u.test(reason)) throw new InputValidationError('سبب الرفض يحتوي على محارف غير مسموحة.');
  return reason;
}
