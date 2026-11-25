import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { mountChat, renderChatPanel } from '../chat.js';
import { contentLinkError } from '../../utils/links.js';
import { resizeImage } from '../../utils/image-resize.js';
import { loadTeacherAssignments } from '../../services/structure-service.js';
import { esc, formatDate, gradeNames, pager, say, shellActions } from './common.js';

const NAV = [['roster', 'طلاب الفصل'], ['content', 'نشر محتوى'], ['grades', 'رصد درجة'], ['mine', 'ما نشرته'], ['bulk', 'رصد جماعي'], ['tasks', 'امتحانات وواجبات'], ['images', 'رفع صورة'], ['chat', 'الرسائل']];

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
      <section data-section-panel="bulk" hidden><h1>رصد جماعي للفصل المختار</h1>
        <div class="tch-toolbar"><button class="button ghost" type="button" data-bulk-load>تحميل طلاب الفصل</button></div>
        <h2>الحضور</h2><label>التاريخ<input type="date" data-bulk-date></label><div data-bulk-att></div><button class="button" type="button" data-bulk-att-save hidden>حفظ الحضور</button><p class="form-note" data-bulk-att-msg role="status"></p>
        <h2>الدرجات</h2><div class="adm-inline"><input data-bulk-title maxlength="80" placeholder="اسم التقييم" style="direction:rtl"><input data-bulk-max type="number" min="1" step="0.5" value="20" aria-label="الدرجة العظمى"></div><div data-bulk-grades></div><button class="button" type="button" data-bulk-grade-save hidden>حفظ الدرجات</button><p class="form-note" data-bulk-grade-msg role="status"></p></section>
      <section data-section-panel="tasks" hidden><form class="dashboard-form tch-form" data-task-form>
        <label>النوع<select name="kind"><option value="exam">امتحان</option><option value="assignment">واجب</option></select></label>
        <label>العنوان<input name="title" maxlength="120" required style="direction:rtl;text-align:right"></label>
        <label>التاريخ<input name="dueDate" type="date" required></label>
        <label>ملاحظات (اختياري)<textarea name="note" maxlength="500" rows="2" style="direction:rtl"></textarea></label>
        <button class="button" type="submit">نشر لهذا الفصل</button><p class="form-note" data-task-msg role="status"></p></form><div data-task-list></div></section>
      <section data-section-panel="images" hidden><form class="dashboard-form tch-form" data-image-form>
        <label>عنوان الصورة<input name="title" maxlength="120" required style="direction:rtl;text-align:right"></label>
        <label>الصورة<input name="file" type="file" accept="image/*" required></label>
        <p class="dash-muted">تُصغّر الصورة تلقائيًا (حتى 1400 بكسل و700 كيلو) وتظهر لطلاب هذا الفصل فقط. للملفات استخدم رابط جوجل درايف، وللفيديو رابط يوتيوب.</p>
        <button class="button" type="submit">نشر الصورة لهذا الفصل</button><p class="form-note" data-image-msg role="status"></p></form></section>
      <section data-section-panel="chat" hidden>${renderChatPanel()}</section>
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
    const linkError = contentLinkError(values.type, values.url);
    if (linkError) { msg('content', linkError, 'error'); return; }
    form.querySelector('button').disabled = true;
    try {
      await addDoc(collection(database, 'content'), { teacherUid: profile.uid, grade: current.grade, classId: current.classId, subjectId: current.subjectId, type: values.type, title: values.title, url: values.url, published: true, createdAt: serverTimestamp() });
      msg('content', 'تم النشر لطلاب هذا الفصل.'); form.reset(); mine.reset();
    } catch { msg('content', 'تعذر النشر. تأكد أن الفصل والمادة مسندان لك.', 'error'); }
    finally { form.querySelector('button').disabled = false; }
  });

  root.querySelector('[data-image-form]').addEventListener('submit', async event => {
    event.preventDefault();
    if (!current) { msg('image', 'اختر فصلًا أولًا.', 'error'); return; }
    const form = event.currentTarget;
    form.querySelector('button').disabled = true;
    try {
      const data = await resizeImage(form.elements.file.files[0]);
      await addDoc(collection(database, 'images'), { teacherUid: profile.uid, grade: current.grade, classId: current.classId, subjectId: current.subjectId, title: form.elements.title.value.trim(), data, createdAt: serverTimestamp() });
      msg('image', 'تم نشر الصورة لطلاب هذا الفصل.'); form.reset();
    } catch (error) { msg('image', /ليس صورة|كبيرة/u.test(error.message) ? error.message : 'تعذر رفع الصورة. تأكد أن الفصل والمادة مسندان لك.', 'error'); }
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

  /* رصد جماعي: دفعات صغيرة لأن قواعد Firestore تسمح بعدد محدود من قراءات التحقق في الدفعة الواحدة */
  const CHUNK = 8;
  let bulkStudents = [];
  const bulkAtt = root.querySelector('[data-bulk-att]'), bulkGrades = root.querySelector('[data-bulk-grades]');
  root.querySelector('[data-bulk-date]').value = new Date().toISOString().slice(0, 10);
  async function writeChunks(items, write) {
    let done = 0;
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = writeBatch(database);
      items.slice(i, i + CHUNK).forEach(item => write(batch, item));
      try { await batch.commit(); done += Math.min(CHUNK, items.length - i); } catch { return { done, failed: true }; }
    }
    return { done, failed: false };
  }
  root.querySelector('[data-bulk-load]').addEventListener('click', async () => {
    if (!current) return;
    bulkAtt.innerHTML = bulkGrades.innerHTML = '<p class="dash-muted">جارٍ التحميل…</p>';
    try {
      const all = []; let token = '';
      for (let page = 0; page < 10; page += 1) { const result = await auth.listClassStudents(current.classId, token); all.push(...result.students); if (!result.next) break; token = result.next; }
      bulkStudents = all;
      bulkAtt.innerHTML = `<table class="tch-table"><tbody>${all.map(st => `<tr><td>${esc(st.displayName)}</td><td><label><input type="checkbox" data-present="${esc(st.uid)}" checked> حاضر</label></td></tr>`).join('')}</tbody></table>`;
      bulkGrades.innerHTML = `<table class="tch-table"><tbody>${all.map(st => `<tr><td>${esc(st.displayName)}</td><td><input type="number" min="0" step="0.5" data-score="${esc(st.uid)}" style="width:6rem"></td></tr>`).join('')}</tbody></table>`;
      root.querySelector('[data-bulk-att-save]').hidden = root.querySelector('[data-bulk-grade-save]').hidden = !all.length;
      if (!all.length) bulkAtt.innerHTML = bulkGrades.innerHTML = '<p class="dash-empty">لا يوجد طلاب في هذا الفصل.</p>';
    } catch { bulkAtt.innerHTML = bulkGrades.innerHTML = '<p class="dash-empty">تعذر تحميل الطلاب.</p>'; }
  });
  root.querySelector('[data-bulk-att-save]').addEventListener('click', async event => {
    const date = root.querySelector('[data-bulk-date]').value;
    if (!current || !date) return;
    event.currentTarget.disabled = true;
    const rows = bulkStudents.map(st => ({ uid: st.uid, present: root.querySelector(`[data-present="${CSS.escape(st.uid)}"]`).checked }));
    const result = await writeChunks(rows, (batch, row) => batch.set(doc(database, 'attendance', `${current.classId}_${current.subjectId}_${date}_${row.uid}`), { teacherUid: profile.uid, studentUid: row.uid, grade: current.grade, classId: current.classId, subjectId: current.subjectId, date, present: row.present, createdAt: serverTimestamp() }));
    msg('bulk-att', result.failed ? `تم حفظ ${result.done} من ${rows.length} فقط. أعد الحفظ لإكمال الباقي.` : `تم حفظ حضور ${result.done} طالب.`, result.failed ? 'error' : undefined);
    event.currentTarget.disabled = false;
  });
  root.querySelector('[data-bulk-grade-save]').addEventListener('click', async event => {
    const title = root.querySelector('[data-bulk-title]').value.trim(), max = Number(root.querySelector('[data-bulk-max]').value);
    if (!current || !title || !(max > 0)) { msg('bulk-grade', 'اكتب اسم التقييم والدرجة العظمى.', 'error'); return; }
    const rows = bulkStudents.map(st => ({ uid: st.uid, score: root.querySelector(`[data-score="${CSS.escape(st.uid)}"]`).value })).filter(row => row.score !== '');
    if (rows.some(row => !(Number(row.score) >= 0 && Number(row.score) <= max))) { msg('bulk-grade', 'توجد درجة خارج المدى من صفر إلى الدرجة العظمى.', 'error'); return; }
    if (!rows.length) { msg('bulk-grade', 'لم تُدخل أي درجة.', 'error'); return; }
    event.currentTarget.disabled = true;
    const result = await writeChunks(rows, (batch, row) => batch.set(doc(collection(database, 'grades')), { teacherUid: profile.uid, studentUid: row.uid, grade: current.grade, classId: current.classId, subjectId: current.subjectId, subjectName: current.subjectName, title, score: Number(row.score), max, createdAt: serverTimestamp() }));
    if (result.failed) msg('bulk-grade', `تم حفظ ${result.done} من ${rows.length} فقط. لا تعيد الحفظ كاملًا حتى لا تتكرر الدرجات؛ أدخل الباقي فرديًا.`, 'error');
    else { msg('bulk-grade', `تم حفظ ${result.done} درجة.`); bulkGrades.querySelectorAll('[data-score]').forEach(input => { input.value = ''; }); }
    event.currentTarget.disabled = false;
  });

  /* امتحانات وواجبات */
  const taskList = root.querySelector('[data-task-list]');
  async function loadTasks() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const snapshot = await getDocs(query(collection(database, 'tasks'), where('teacherUid', '==', profile.uid), where('dueDate', '>=', today), orderBy('dueDate'), limit(30)));
      taskList.innerHTML = snapshot.docs.length ? snapshot.docs.map(item => { const t = item.data(); return `<article class="tch-row"><b>${t.kind === 'exam' ? 'امتحان' : 'واجب'}: ${esc(t.title)}</b><span>${esc(t.subjectName)} · ${esc(t.dueDate)}</span><button class="text-link" type="button" data-del-task="${esc(item.id)}">حذف</button></article>`; }).join('') : '<p class="dash-empty">لا توجد مهام قادمة.</p>';
    } catch { taskList.innerHTML = '<p class="dash-empty">تعذر تحميل المهام.</p>'; }
  }
  root.querySelector('[data-section="tasks"]').addEventListener('click', loadTasks);
  taskList.addEventListener('click', async event => {
    const button = event.target.closest('[data-del-task]');
    if (button && window.confirm('حذف هذه المهمة؟')) { await deleteDoc(doc(database, 'tasks', button.dataset.delTask)).catch(() => {}); loadTasks(); }
  });
  root.querySelector('[data-task-form]').addEventListener('submit', async event => {
    event.preventDefault();
    if (!current) { msg('task', 'اختر فصلًا أولًا.', 'error'); return; }
    const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
    form.querySelector('button').disabled = true;
    try {
      await addDoc(collection(database, 'tasks'), { teacherUid: profile.uid, grade: current.grade, classId: current.classId, subjectId: current.subjectId, subjectName: current.subjectName, kind: values.kind, title: values.title.trim(), dueDate: values.dueDate, note: String(values.note || '').trim(), createdAt: serverTimestamp() });
      msg('task', 'تم النشر لطلاب هذا الفصل.'); form.reset(); loadTasks();
    } catch { msg('task', 'تعذر النشر. تأكد أن الفصل والمادة مسندان لك.', 'error'); }
    finally { form.querySelector('button').disabled = false; }
  });
  root.querySelector('[data-section="chat"]').addEventListener('click', () => mountChat(root.querySelector('[data-section-panel="chat"]'), { profile, database }), { once: true });
  root.querySelector('[data-section="mine"]').addEventListener('click', () => mine.load(), { once: true });
}
