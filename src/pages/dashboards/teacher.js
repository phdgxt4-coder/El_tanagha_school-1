import { addDoc, collection, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { loadTeacherAssignments } from '../../services/structure-service.js';
import { esc, formatDate, gradeNames, pager, say, shellActions } from './common.js';

const NAV = [['roster', 'طلاب الفصل'], ['content', 'نشر محتوى'], ['grades', 'رصد درجة'], ['mine', 'ما نشرته']];

export function renderTeacher(profile) {
  return `<div class="dash dash-teacher" data-dash="teacher">
    <aside class="tch-side"><div class="tch-id"><span class="tch-avatar" aria-hidden="true">${esc((profile.displayName || 'م').trim().charAt(0))}</span><b>${esc(profile.displayName || 'المدرس')}</b><small>${esc(profile.subjectName || '')}</small></div>
      <h2>فصولي</h2><div class="tch-classes" data-classes><span class="skeleton skeleton-line"></span></div>
      <nav class="tch-nav" aria-label="أدوات المدرس">${NAV.map(([id, label], index) => `<button type="button" data-section="${id}" class="${index === 0 ? 'is-active' : ''}">${label}</button>`).join('')}</nav>${shellActions()}</aside>
    <main class="tch-main">
      <header class="tch-head"><h1 data-title>اختر فصلًا</h1><p class="dash-muted" data-sub></p></header>
      <section data-section-panel="roster"><div class="tch-toolbar"><label>التاريخ<input type="date" data-date></label></div><div data-roster></div><button class="button ghost" type="button" data-more-roster hidden>تحميل المزيد</button><p class="form-note" data-roster-msg role="status"></p></section>
      <section data-section-panel="content" hidden><form class="dashboard-form tch-form" data-content-form>
        <label>النوع<select name="type"><option value="lesson">درس</option><option value="file">ملف</option><option value="video">فيديو</option><option value="assignment">واجب</option></select></label>
        <label>العنوان<input name="title" maxlength="120" required style="direction:rtl;text-align:right"></label>
        <label>الرابط (HTTPS)<input name="url" type="url" pattern="https://.*" placeholder="https://" required></label>
        <button class="button" type="submit">نشر لهذا الفصل</button><p class="form-note" data-content-msg role="status"></p></form></section>
      <section data-section-panel="grades" hidden><form class="dashboard-form tch-form" data-grade-form>
        <label>الطالب<select name="studentUid" required data-student-select><option value="">اختر الطالب</option></select></label>
        <label>اسم التقييم<input name="title" maxlength="80" required style="direction:rtl;text-align:right" placeholder="اختبار شهري"></label>
        <label>الدرجة<input name="score" type="number" min="0" step="0.5" required></label><label>من<input name="max" type="number" min="1" step="0.5" required value="20"></label>
        <button class="button" type="submit">حفظ الدرجة</button><p class="form-note" data-grade-msg role="status"></p></form></section>
      <section data-section-panel="mine" hidden><div data-mine></div><button class="button ghost" type="button" data-more-mine hidden>تحميل المزيد</button></section>
    </main></div>`;
}

export async function mountTeacher(root, { profile, auth, database }) {
  const box = root.querySelector('[data-classes]');
  let assignments = [];
  let current = null;
  let students = [];
  let nextToken = null;
  const msg = (name, text, kind) => say(root.querySelector(`[data-${name}-msg]`), text, kind);

  function showSection(name) {
    root.querySelectorAll('[data-section]').forEach(button => button.classList.toggle('is-active', button.dataset.section === name));
    root.querySelectorAll('[data-section-panel]').forEach(panel => { panel.hidden = panel.dataset.sectionPanel !== name; });
  }
  root.querySelector('.tch-nav').addEventListener('click', event => { const button = event.target.closest('[data-section]'); if (button) showSection(button.dataset.section); });

  const rosterBox = root.querySelector('[data-roster]');
  const dateInput = root.querySelector('[data-date]');
  dateInput.value = new Date().toISOString().slice(0, 10);

  async function loadRoster(reset) {
    if (!current) return;
    if (reset) { students = []; nextToken = null; rosterBox.innerHTML = '<div class="dash-skeleton"><span class="skeleton skeleton-line title"></span><span class="skeleton skeleton-line"></span></div>'; }
    try {
      const result = await auth.listClassStudents(current.classId, nextToken || '');
      students = students.concat(result.students);
      nextToken = result.next;
      rosterBox.innerHTML = students.length ? `<table class="tch-table"><thead><tr><th>الطالب</th><th>الحضور</th></tr></thead><tbody>${students.map(student => `<tr><td>${esc(student.displayName)}</td><td><button class="tch-chip ok" data-att="1" data-uid="${esc(student.uid)}" type="button">حاضر</button><button class="tch-chip bad" data-att="0" data-uid="${esc(student.uid)}" type="button">غائب</button></td></tr>`).join('')}</tbody></table>` : '<p class="dash-empty">لا يوجد طلاب مسجلون في هذا الفصل بعد.</p>';
      root.querySelector('[data-more-roster]').hidden = !nextToken;
      const select = root.querySelector('[data-student-select]');
      select.innerHTML = '<option value="">اختر الطالب</option>' + students.map(student => `<option value="${esc(student.uid)}">${esc(student.displayName)}</option>`).join('');
    } catch { rosterBox.innerHTML = '<p class="dash-empty">تعذر تحميل الطلاب. الفصل غير مسند لك أو انقطع الاتصال.</p>'; }
  }

  function choose(assignment) {
    current = assignment;
    box.querySelectorAll('[data-pick]').forEach(button => button.classList.toggle('is-active', button.dataset.pick === assignment.id));
    root.querySelector('[data-title]').textContent = `${assignment.subjectName} · ${assignment.className}`;
    root.querySelector('[data-sub]').textContent = gradeNames[assignment.grade] || '';
    void loadRoster(true);
  }

  try {
    assignments = await loadTeacherAssignments(profile.uid);
    box.innerHTML = assignments.length
      ? assignments.map(item => `<button type="button" class="tch-class" data-pick="${esc(item.id)}"><b>${esc(item.subjectName)}</b><small>${esc(item.className)}</small></button>`).join('')
      : '<p class="dash-empty">لم تُسند إليك فصول بعد. الإدارة تسند المادة والفصل بعد اعتماد حسابك.</p>';
    if (assignments.length) choose(assignments[0]);
    else root.querySelector('[data-title]').textContent = 'بانتظار إسناد الإدارة';
  } catch { box.innerHTML = '<p class="dash-empty">تعذر تحميل فصولك.</p>'; }
  box.addEventListener('click', event => { const button = event.target.closest('[data-pick]'); if (button) choose(assignments.find(item => item.id === button.dataset.pick)); });
  root.querySelector('[data-more-roster]').addEventListener('click', () => loadRoster(false));

  rosterBox.addEventListener('click', async event => {
    const button = event.target.closest('[data-att]');
    if (!button || !current) return;
    button.disabled = true;
    try {
      await addDoc(collection(database, 'attendance'), { teacherUid: profile.uid, studentUid: button.dataset.uid, grade: current.grade, classId: current.classId, subjectId: current.subjectId, date: dateInput.value, present: button.dataset.att === '1', createdAt: serverTimestamp() });
      msg('roster', 'تم تسجيل الحضور.');
    } catch { msg('roster', 'تعذر تسجيل الحضور لهذا الطالب.', 'error'); }
    finally { button.disabled = false; }
  });

  root.querySelector('[data-content-form]').addEventListener('submit', async event => {
    event.preventDefault();
    if (!current) { msg('content', 'اختر فصلًا أولًا.', 'error'); return; }
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (!/^https:\/\//u.test(values.url)) { msg('content', 'الرابط يجب أن يبدأ بـ https.', 'error'); return; }
    form.querySelector('button').disabled = true;
    try {
      await addDoc(collection(database, 'content'), { teacherUid: profile.uid, grade: current.grade, classId: current.classId, subjectId: current.subjectId, type: values.type, title: values.title, url: values.url, published: true, createdAt: serverTimestamp() });
      msg('content', 'تم النشر لطلاب هذا الفصل.'); form.reset(); mine.reset();
    } catch { msg('content', 'تعذر النشر. تأكد أن الفصل والمادة مسندان لك.', 'error'); }
    finally { form.querySelector('button').disabled = false; }
  });

  root.querySelector('[data-grade-form]').addEventListener('submit', async event => {
    event.preventDefault();
    if (!current) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    form.querySelector('button').disabled = true;
    try {
      await addDoc(collection(database, 'grades'), { teacherUid: profile.uid, studentUid: values.studentUid, grade: current.grade, classId: current.classId, subjectId: current.subjectId, subjectName: current.subjectName, title: values.title, score: Number(values.score), max: Number(values.max), createdAt: serverTimestamp() });
      msg('grade', 'تم حفظ الدرجة.'); form.elements.title.value = ''; form.elements.score.value = '';
    } catch { msg('grade', 'تعذر حفظ الدرجة لهذا الطالب.', 'error'); }
    finally { form.querySelector('button').disabled = false; }
  });

  const mine = pager(database, 'content', [where('teacherUid', '==', profile.uid), orderBy('createdAt', 'desc')], item => `<article class="tch-row"><b>${esc(item.title)}</b><span>${esc(item.type)} · ${formatDate(item.createdAt)}</span></article>`, { target: root.querySelector('[data-mine]'), more: root.querySelector('[data-more-mine]'), empty: 'لم تنشر شيئًا بعد.' });
  root.querySelector('[data-section="mine"]').addEventListener('click', () => mine.load(), { once: true });
}
