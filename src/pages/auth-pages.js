import { SUBJECTS } from '../../functions/src/validation.js';
import { sectionHeading } from '../components/cards.js';

const ROLE_LABELS = Object.freeze({
  student: 'الطالب',
  parent: 'ولي الأمر',
  teacher: 'المدرس',
  admin: 'الإدارة'
});

function registrationFields(role) {
  const roleFields = role === 'student'
    ? `<label>الصف الدراسي<select name="grade" required><option value="">اختر الصف</option><option value="1">الأول الثانوي</option><option value="2">الثاني الثانوي</option><option value="3">الثالث الثانوي</option></select></label><label>الشعبة<select name="branch" required><option value="">اختر الشعبة</option><option value="science">علمي علوم</option><option value="math">علمي رياضة</option><option value="literary">أدبي</option></select></label><label>الفصل<input name="className" required maxlength="40" placeholder="مثال: 1/أ"></label><label>تاريخ الميلاد<input name="birthDate" type="date" required></label>`
    : role === 'teacher'
      ? `<label>التخصص<select name="subjectId" required><option value="">اختر التخصص</option>${Object.entries(SUBJECTS).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label class="consent-row"><input type="checkbox" name="publishConsent" value="yes"><span>أوافق على نشر اسمي وتخصصي في دليل المدرسين بعد اعتماد الإدارة. لن يُنشر بريدي أو هاتفي.</span></label>`
      : '';

  return `<label>الاسم الكامل (للطالب: اسم رباعي)<input name="displayName" autocomplete="name" required minlength="2" maxlength="80"></label>${roleFields}<label>رقم الهاتف<input name="phone" type="tel" autocomplete="tel" required maxlength="24"></label>`;
}

export function loginPage(role = 'student') {
  const safeRole = role === 'admin' ? 'teacher' : (Object.hasOwn(ROLE_LABELS, role) ? role : 'student');
  const roleLabel = ROLE_LABELS[safeRole];
  const registerAvailable = role !== 'admin' && safeRole !== 'admin';
  const roleLinks = ['student','parent','teacher'].map(item =>
    `<a class="role-link ${item===safeRole?'selected':''}" href="/login/${item}">${ROLE_LABELS[item]}</a>`
  ).join('');

  return `<section class="section page auth-page"><div class="auth-shell" data-role="${safeRole}">${sectionHeading('بوابة المدرسة',`دخول ${roleLabel}`,'المصادقة تتم عبر Firebase Authentication. لا تُحفظ كلمة المرور في الموقع أو قاعدة البيانات.')}
    <nav class="role-switch" aria-label="نوع الحساب">${roleLinks}</nav>
    <div class="auth-panel">
      <div class="auth-tabs" role="tablist" aria-label="الدخول أو إنشاء حساب">
        <button type="button" class="auth-tab selected" data-auth-mode="login" aria-selected="true">تسجيل الدخول</button>
        ${registerAvailable?'<button type="button" class="auth-tab" data-auth-mode="register" aria-selected="false">إنشاء حساب</button>':''}
      </div>
      <form id="login-form" data-auth-form="login">
        <label>البريد الإلكتروني<input name="email" type="email" autocomplete="username" required maxlength="254"></label>
        <label>كلمة المرور<input name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="128"></label>
        <button class="button" type="submit">دخول آمن</button>
        <button class="text-link password-reset" type="button" data-password-reset>نسيت كلمة المرور؟ أرسل رابط إعادة التعيين إلى بريدي</button>
      </form>
      ${registerAvailable?`<form id="register-form" data-auth-form="register" hidden>
        ${registrationFields(safeRole)}
        <label>البريد الإلكتروني<input name="email" type="email" autocomplete="email" required maxlength="254"></label>
        <label>كلمة المرور (8 أحرف على الأقل)<input name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label>
        <label>تأكيد كلمة المرور<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label>
        <button class="button" type="submit">إنشاء الحساب وإرسال طلب ${roleLabel}</button>
        ${safeRole==='teacher'?'<p class="form-note">طلب المدرس يبقى بانتظار اعتماد الإدارة. لا يظهر الاسم أو التخصص قبل الاعتماد وموافقة النشر.</p>':''}
      </form>`:''}
      <p class="form-note auth-status" data-auth-message role="status" aria-live="polite"></p>
    </div>
    <p class="auth-footnote">تأكد من توثيق بريدك الإلكتروني؛ اعتماد حساب المدرس يتطلب بريدًا موثقًا.</p>
  </div></section>`;
}

export function teacherApprovalPage() {
  return `<section class="section page"><div class="admin-shell">${sectionHeading('إدارة المدرسة','طلبات اعتماد المدرسين','تُعرض الطلبات هنا بعد تسجيل الدخول بحساب إدارة مخوّل. الاعتماد لا ينشر الاسم والتخصص إلا بموافقة المدرس.')}
    <p class="form-note" data-admin-message role="status" aria-live="polite">جارٍ التحقق من صلاحية الإدارة…</p>
    <div class="admin-request-list" data-admin-requests aria-live="polite"></div>
    <a class="text-link" href="/login/teacher">دخول مسؤول المدرسة من بوابة المدرس</a>
  </div></section>`;
}
