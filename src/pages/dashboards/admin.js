import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import * as spark from '../../services/spark-backend.js';
import { invalidateStructure, loadClasses, loadSubjects, loadClassAssignments } from '../../services/structure-service.js';
import { esc, gradeNames, say, shellActions, skeletonRows } from './common.js';

const SECTIONS = [['overview', 'نظرة عامة', '▦'], ['classes', 'الصفوف والفصول', '▤'], ['subjects', 'المواد', '✎'], ['teachers', 'المدرسون والإسناد', '☺'], ['students', 'استيراد الطلاب', '⇪'], ['links', 'ربط أولياء الأمور', '⚭'], ['users', 'إدارة الحسابات', '⚙']];

export function renderAdmin(profile) {
  return `<div class="dash dash-admin" data-dash="admin">
    <aside class="adm-side"><div class="adm-brand"><b>إدارة المدرسة</b><small>${esc(profile.displayName || profile.email || '')}</small></div>
      <nav>${SECTIONS.map(([id, label, icon], index) => `<button type="button" data-section="${id}" class="${index === 0 ? 'is-active' : ''}"><i aria-hidden="true">${icon}</i>${label}</button>`).join('')}</nav>${shellActions()}</aside>
    <main class="adm-main">
      <section data-panel="overview"><h1>نظرة عامة</h1><div class="adm-kpis" data-kpis>${skeletonRows(2)}</div></section>
      <section data-panel="classes" hidden><h1>الصفوف والفصول</h1>
        <form class="adm-inline" data-class-form><select name="grade" required><option value="">الصف</option>${Object.entries(gradeNames).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select><input name="section" required maxlength="20" placeholder="الفصل مثل: أ" style="direction:rtl"><input name="year" maxlength="9" value="2026-2027" dir="ltr"><button class="button" type="submit">إضافة فصل</button></form>
        <p class="form-note" data-msg="class" role="status"></p><table class="adm-table"><tbody data-classes></tbody></table></section>
      <section data-panel="subjects" hidden><h1>المواد</h1>
        <form class="adm-inline" data-subject-form><input name="name" required maxlength="60" placeholder="اسم المادة" style="direction:rtl"><button class="button" type="submit">إضافة مادة</button><button class="button ghost" type="button" data-seed-subjects>إضافة المواد الافتراضية</button></form>
        <p class="form-note" data-msg="subject" role="status"></p><table class="adm-table"><tbody data-subjects></tbody></table></section>
      <section data-panel="teachers" hidden><h1>المدرسون والإسناد</h1>
        <h2>طلبات تنتظر الاعتماد</h2><div data-applications></div>
        <h2>إسناد مدرس إلى مادة وفصل</h2>
        <form class="adm-inline" data-assign-form><select name="teacherUid" required data-teacher-select><option value="">المدرس</option></select><select name="subjectId" required data-assign-subject><option value="">المادة</option></select><select name="classId" required data-assign-class><option value="">الفصل</option></select><button class="button" type="submit">إسناد</button></form>
        <p class="form-note" data-msg="assign" role="status"></p>
        <h2>إسنادات الفصل</h2><div class="adm-inline"><select data-view-class><option value="">اختر فصلًا لعرض إسناداته</option></select></div><table class="adm-table"><tbody data-assignments></tbody></table></section>
      <section data-panel="students" hidden><h1>استيراد الطلاب</h1>
        <p class="dash-muted">الصق سطرًا لكل طالب: الاسم الرباعي، ثم رقم الهاتف. أو ارفع ملف CSV (من Excel: حفظ باسم CSV). الحد 300 طالب في المرة.</p>
        <form class="dashboard-form" data-import-form><label>الفصل<select name="classId" required data-import-class><option value="">اختر الفصل</option></select></label>
        <label>الطلاب<textarea name="rows" rows="8" required placeholder="محمد أحمد علي حسن, 01012345678" style="direction:rtl"></textarea></label><label>أو ملف CSV<input type="file" accept=".csv,text/csv" data-csv></label>
        <button class="button" type="submit">استيراد</button><p class="form-note" data-msg="import" role="status"></p></form></section>
      <section data-panel="links" hidden><h1>ربط أولياء الأمور</h1><p class="dash-muted">الربط يتم بكود الطالب بدون موافقة. هنا تقدر تلغي أي ربط نشط.</p><table class="adm-table"><tbody data-links></tbody></table><button class="button ghost" type="button" data-more-links hidden>تحميل المزيد</button></section>
      <section data-panel="users" hidden><h1>إدارة الحسابات</h1>
        <p class="dash-muted">لا يوجد حذف نهائي. الإيقاف يمنع الدخول والبيانات تبقى محفوظة، والتفعيل يرجعه.</p>
        <form class="adm-inline" data-user-search><select name="role"><option value="student">طلاب</option><option value="parent">أولياء أمور</option><option value="teacher">مدرسون</option></select><input name="q" maxlength="60" placeholder="ابحث بأول الاسم" style="direction:rtl"><button class="button" type="submit">بحث</button></form>
        <p class="form-note" data-msg="users" role="status"></p><table class="adm-table"><tbody data-users></tbody></table>
        <h2>استبدال مدرس</h2><p class="dash-muted">ينقل كل إسنادات المدرس الحالي للمدرس الجديد. الحسابان يبقيان.</p>
        <form class="adm-inline" data-replace-form><select name="oldUid" required data-replace-old><option value="">المدرس الحالي</option></select><select name="newUid" required data-replace-new><option value="">المدرس الجديد</option></select><button class="button" type="submit">استبدال</button></form><p class="form-note" data-msg="replace" role="status"></p>
        <h2>ترقية فصل / تخريج</h2><p class="dash-muted">ينقل كل طلاب الفصل للفصل الجديد، أو يخرّجهم (حسابهم يبقى محفوظًا ولا يدخلون). الحد 400 طالب في المرة.</p>
        <form class="adm-inline" data-promote-form><select name="from" required data-promote-from><option value="">من الفصل</option></select><select name="to" data-promote-to><option value="">تخريج (بدون فصل جديد)</option></select><button class="button" type="submit">تنفيذ</button></form><p class="form-note" data-msg="promote" role="status"></p></section>
    </main></div>`;
}

export function mountAdmin(root, { auth, database }) {
  const loaded = new Set();
  const confirmAsk = text => window.confirm(text);
  const m = name => root.querySelector(`[data-msg="${name}"]`);
  async function guard(task, message, okText, ok) {
    try { await task(); if (ok) say(message, okText); } catch (error) { say(message, auth.friendlyAuthError(error), 'error'); }
  }
  const fill = (select, items, label) => { select.innerHTML = `<option value="">${label}</option>` + items.map(item => `<option value="${esc(item.value)}">${esc(item.text)}</option>`).join(''); };

  async function overview() {
    const counts = await Promise.allSettled([
      getCountFromServer(query(collection(database, 'profiles'), where('role', '==', 'student'))),
      getCountFromServer(query(collection(database, 'profiles'), where('role', '==', 'teacher'))),
      getCountFromServer(query(collection(database, 'profiles'), where('role', '==', 'parent'))),
      getCountFromServer(collection(database, 'classes'))
    ]);
    const labels = ['طلاب', 'مدرسون', 'أولياء أمور', 'فصول'];
    root.querySelector('[data-kpis]').innerHTML = counts.map((item, index) => `<article class="adm-kpi"><strong>${item.status === 'fulfilled' ? item.value.data().count : '—'}</strong><span>${labels[index]}</span></article>`).join('');
  }
  async function classes() {
    invalidateStructure();
    const list = await loadClasses();
    root.querySelector('[data-classes]').innerHTML = list.length ? list.map(item => `<tr><td>${esc(item.name)}</td><td dir="ltr">${esc(item.year)}</td><td><button class="text-link" data-del-class="${esc(item.id)}" type="button">حذف</button></td></tr>`).join('') : '<tr><td>لم تُنشأ فصول بعد.</td></tr>';
    const options = list.map(item => ({ value: item.id, text: item.name }));
    ['[data-assign-class]', '[data-import-class]', '[data-view-class]'].forEach(selector => fill(root.querySelector(selector), options, 'الفصل'));
  }
  async function subjects() {
    invalidateStructure();
    const list = await loadSubjects();
    root.querySelector('[data-subjects]').innerHTML = list.map(item => `<tr><td>${esc(item.name)}</td><td><button class="text-link" data-del-subject="${esc(item.id)}" type="button">حذف</button></td></tr>`).join('');
    fill(root.querySelector('[data-assign-subject]'), list.map(item => ({ value: item.id, text: item.name })), 'المادة');
  }
  async function teachers() {
    await Promise.all([classes(), subjects()]);
    const snapshot = await getDocs(query(collection(database, 'profiles'), where('role', '==', 'teacher'), where('status', '==', 'active'), orderBy('displayName'), limit(100)));
    fill(root.querySelector('[data-teacher-select]'), snapshot.docs.map(item => ({ value: item.id, text: `${item.data().displayName} (${item.data().subjectName || ''})` })), 'المدرس');
    await applications();
  }
  async function applications() {
    const box = root.querySelector('[data-applications]');
    try {
      const { applications: list } = await auth.listTeacherApplications();
      box.innerHTML = list.length ? list.map(item => `<article class="adm-app"><b>${esc(item.displayName)}</b><span>${esc(item.subjectName)} · ${item.emailVerified ? 'البريد موثق' : 'البريد غير موثق'}</span><span><button class="button" data-approve="${esc(item.uid)}" type="button">اعتماد</button> <button class="button ghost" data-reject="${esc(item.uid)}" type="button">رفض</button></span></article>`).join('') : '<p class="dash-empty">لا توجد طلبات معلقة.</p>';
    } catch { box.innerHTML = '<p class="dash-empty">تعذر تحميل الطلبات.</p>'; }
  }
  let linkCursor = null;
  async function links(reset) {
    const { startAfter } = await import('firebase/firestore');
    if (reset) linkCursor = null;
    const parts = [where('active', '==', true), orderBy('createdAt', 'desc'), limit(21)];
    if (linkCursor) parts.push(startAfter(linkCursor));
    const snapshot = await getDocs(query(collection(database, 'parentLinks'), ...parts));
    const docs = snapshot.docs.slice(0, 20);
    linkCursor = docs[docs.length - 1] ?? linkCursor;
    const body = root.querySelector('[data-links]');
    const html = docs.map(item => `<tr><td dir="ltr">${esc(item.data().parentUid.slice(0, 8))}…</td><td dir="ltr">${esc(item.data().studentId || item.data().studentUid.slice(0, 8))}</td><td><button class="text-link" data-revoke="${esc(item.id)}" type="button">إلغاء الربط</button></td></tr>`).join('');
    if (reset) body.innerHTML = html || '<tr><td>لا توجد روابط نشطة.</td></tr>'; else body.insertAdjacentHTML('beforeend', html);
    root.querySelector('[data-more-links]').hidden = snapshot.docs.length <= 20;
  }
  async function usersPanel() {
    const [classList, teacherSnap] = await Promise.all([loadClasses(), getDocs(query(collection(database, 'profiles'), where('role', '==', 'teacher'), where('status', '==', 'active'), orderBy('displayName'), limit(100)))]);
    const teacherOptions = teacherSnap.docs.map(item => ({ value: item.id, text: item.data().displayName }));
    fill(root.querySelector('[data-replace-old]'), teacherOptions, 'المدرس الحالي');
    fill(root.querySelector('[data-replace-new]'), teacherOptions, 'المدرس الجديد');
    const classOptions = classList.map(item => ({ value: item.id, text: item.name }));
    fill(root.querySelector('[data-promote-from]'), classOptions, 'من الفصل');
    root.querySelector('[data-promote-to]').innerHTML = '<option value="">تخريج (بدون فصل جديد)</option>' + classOptions.map(item => `<option value="${esc(item.value)}">${esc(item.text)}</option>`).join('');
    root.dataset.classOptions = JSON.stringify(classOptions);
  }
  async function searchUsers(form) {
    const box = root.querySelector('[data-users]');
    box.innerHTML = '<tr><td>جارٍ البحث…</td></tr>';
    const list = await spark.adminSearchUsers(form.elements.role.value, form.elements.q.value);
    const options = JSON.parse(root.dataset.classOptions || '[]');
    box.innerHTML = list.length ? list.map(user => `<tr data-user="${esc(user.uid)}"><td><b>${esc(user.displayName)}</b><br><small dir="ltr">${esc(user.phone)}</small>${user.className ? `<br><small>${esc(user.className)}</small>` : ''}</td><td>${user.status === 'active' ? 'نشط' : user.status === 'disabled' ? 'موقوف' : esc(user.status)}</td><td>
      <button class="text-link" type="button" data-toggle-status="${user.status === 'active' ? 'disabled' : 'active'}">${user.status === 'active' ? 'إيقاف' : 'تفعيل'}</button>
      ${user.role !== 'teacher' ? '<button class="text-link" type="button" data-edit-user>تعديل</button>' : ''}
      ${user.role === 'student' ? `<select data-move-class><option value="">نقل إلى…</option>${options.map(item => `<option value="${esc(item.value)}">${esc(item.text)}</option>`).join('')}</select>` : ''}</td></tr>`).join('') : '<tr><td>لا توجد نتائج.</td></tr>';
    box.__list = list;
  }
  root.querySelector('[data-user-search]').addEventListener('submit', event => { event.preventDefault(); guard(() => searchUsers(event.currentTarget), m('users'), '', false); });
  root.querySelector('[data-users]').addEventListener('click', event => {
    const row = event.target.closest('[data-user]'); if (!row) return;
    const user = root.querySelector('[data-users]').__list?.find(item => item.uid === row.dataset.user); if (!user) return;
    const again = () => searchUsers(root.querySelector('[data-user-search]'));
    const toggle = event.target.closest('[data-toggle-status]');
    if (toggle && confirmAsk(`${toggle.dataset.toggleStatus === 'disabled' ? 'إيقاف' : 'تفعيل'} حساب ${user.displayName}؟`)) guard(async () => { await spark.adminSetUserStatus(user.uid, toggle.dataset.toggleStatus); await again(); }, m('users'), 'تم.', true);
    if (event.target.closest('[data-edit-user]')) {
      const name = window.prompt('الاسم', user.displayName); if (name === null) return;
      const phone = window.prompt('رقم الهاتف', user.phone); if (phone === null) return;
      guard(async () => { await spark.adminUpdateUser(user.uid, { displayName: name, phone }); await again(); }, m('users'), 'تم التعديل.', true);
    }
  });
  root.querySelector('[data-users]').addEventListener('change', event => {
    const select = event.target.closest('[data-move-class]'); if (!select || !select.value) return;
    const row = select.closest('[data-user]');
    const user = root.querySelector('[data-users]').__list?.find(item => item.uid === row.dataset.user);
    if (!user || !confirmAsk(`نقل ${user.displayName} إلى الفصل المختار؟`)) { select.value = ''; return; }
    guard(async () => { await spark.adminMoveStudent(user.uid, select.value); await searchUsers(root.querySelector('[data-user-search]')); }, m('users'), 'تم النقل.', true);
  });
  root.querySelector('[data-replace-form]').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget;
    if (!confirmAsk('نقل كل إسنادات المدرس الحالي للمدرس الجديد؟')) return;
    guard(async () => { const result = await spark.adminReplaceTeacher(form.elements.oldUid.value, form.elements.newUid.value); say(m('replace'), `تم نقل ${result.moved} إسناد.`); await usersPanel(); }, m('replace'), '', false);
  });
  root.querySelector('[data-promote-form]').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget;
    if (!confirmAsk(form.elements.to.value ? 'نقل كل طلاب الفصل للفصل الجديد؟' : 'تخريج كل طلاب هذا الفصل؟ لن يستطيعوا الدخول.')) return;
    guard(async () => { const result = await spark.adminPromoteClass(form.elements.from.value, form.elements.to.value); say(m('promote'), `تم لـ ${result.count} طالب.${result.more ? ' يوجد طلاب آخرون، نفّذ مرة أخرى.' : ''}`); }, m('promote'), '', false);
  });
  const loaders = { users: usersPanel, overview, classes, subjects, teachers, links: () => links(true) };

  root.querySelector('.adm-side nav').addEventListener('click', event => {
    const button = event.target.closest('[data-section]');
    if (!button) return;
    const name = button.dataset.section;
    root.querySelectorAll('[data-section]').forEach(item => item.classList.toggle('is-active', item === button));
    root.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
    if (name === 'students') { classes().catch(() => {}); return; }
    if (!loaded.has(name)) { loaded.add(name); loaders[name]?.().catch(() => {}); }
  });
  loaded.add('overview'); void overview();
  root.querySelector('[data-more-links]').addEventListener('click', () => links(false));

  root.querySelector('[data-class-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    await guard(async () => { await auth.adminSaveClass(Object.fromEntries(new FormData(form))); invalidateStructure(); form.elements.section.value = ''; await classes(); }, m('class'), 'تمت إضافة الفصل.', true);
  });
  root.querySelector('[data-subject-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    await guard(async () => { await auth.adminSaveSubject(form.elements.name.value); form.reset(); await subjects(); }, m('subject'), 'تمت إضافة المادة.', true);
  });
  root.querySelector('[data-seed-subjects]').addEventListener('click', () => guard(async () => { await auth.adminSeedDefaultSubjects(); await subjects(); }, m('subject'), 'أُضيفت المواد الافتراضية.', true));
  root.querySelector('[data-assign-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await guard(() => auth.adminAssignTeacher(values.teacherUid, values.subjectId, values.classId), m('assign'), 'تم الإسناد. المدرس يرى الفصل في لوحته.', true);
  });
  root.querySelector('[data-view-class]').addEventListener('change', async event => {
    const body = root.querySelector('[data-assignments]');
    if (!event.target.value) { body.innerHTML = ''; return; }
    try {
      const list = await loadClassAssignments(event.target.value);
      body.innerHTML = list.length ? list.map(item => `<tr><td>${esc(item.subjectName)}</td><td>${esc(item.teacherName)}</td><td><button class="text-link" data-unassign="${esc(item.id)}" type="button">إزالة</button></td></tr>`).join('') : '<tr><td>لا إسنادات لهذا الفصل.</td></tr>';
    } catch { body.innerHTML = '<tr><td>تعذر التحميل.</td></tr>'; }
  });
  root.querySelector('[data-csv]').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (file && file.size < 200000) root.querySelector('[data-import-form] textarea').value = await file.text();
  });
  root.querySelector('[data-import-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const rows = String(values.rows).split(/\r?\n/u).map(line => line.trim()).filter(Boolean).map(line => {
      const parts = line.split(/[,;\t،]/u).map(part => part.trim().replace(/^"|"$/gu, ''));
      return { fullName: parts[0], phone: parts[1], classId: values.classId };
    });
    await guard(async () => { const result = await auth.adminImportRoster(rows); say(m('import'), `تم استيراد ${result.imported} طالب. عند تسجيلهم بنفس الاسم والهاتف يُربطون بالفصل تلقائيًا.`); }, m('import'), '', false);
  });

  root.addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target) return;
    const ds = target.dataset;
    const confirmAsk = text => window.confirm(text);
    if (ds.delClass && confirmAsk('حذف هذا الفصل؟')) await guard(async () => { await auth.adminDeleteClass(ds.delClass); await classes(); }, m('class'), 'تم الحذف.', true);
    if (ds.delSubject && confirmAsk('حذف هذه المادة؟')) await guard(async () => { await auth.adminDeleteSubject(ds.delSubject); await subjects(); }, m('subject'), 'تم الحذف.', true);
    if (ds.unassign && confirmAsk('إزالة هذا الإسناد؟')) await guard(async () => { await auth.adminRemoveAssignment(ds.unassign); target.closest('tr').remove(); }, m('assign'), 'تمت الإزالة.', true);
    if (ds.approve) { target.disabled = true; await guard(async () => { await auth.approveTeacher(ds.approve); await teachers(); }, m('assign'), 'تم اعتماد المدرس. أسند له مادة وفصلًا.', true); }
    if (ds.reject) { target.disabled = true; await guard(async () => { await auth.rejectTeacher(ds.reject, ''); await applications(); }, m('assign'), 'تم الرفض.', true); }
    if (ds.revoke && confirmAsk('إلغاء هذا الربط؟')) await guard(async () => { await auth.revokeParentLink(ds.revoke); target.closest('tr').remove(); }, null, '', false);
  });
}
