import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { esc, formatDate, gradeNames, pager, say, shellActions } from './common.js';
import { createAttemptLimiter } from '../../utils/attempt-limiter.js';
import { mountParentChat, renderParentChat } from '../parent-chat.js';

export function renderParent(profile) {
  return `<div class="dash dash-parent" data-dash="parent">
    <header class="par-top"><div><span class="eyebrow">لوحة ولي الأمر</span><h1>${esc(profile.displayName || 'ولي الأمر')}</h1></div>${shellActions()}</header>
    <div class="par-children" data-children role="tablist" aria-label="الأبناء"><span class="skeleton skeleton-line short"></span></div>
    <section class="par-stats" data-stats hidden>
      <article><span>متوسط الدرجات</span><strong data-avg>—</strong></article>
      <article><span>نسبة الحضور</span><strong data-rate>—</strong></article>
      <article><span>آخر نشاط</span><strong data-last>—</strong></article>
    </section>
    <p class="par-report" data-report-wrap hidden><button class="button ghost" type="button" data-report-card>شهادة الدرجات والحضور (PDF)</button> <span class="form-note" data-report-note role="status"></span></p>
    <div class="par-columns" data-detail hidden>
      <section class="par-card"><h2>الدرجات</h2><div data-list="grades"></div><button class="button ghost" type="button" data-more="grades" hidden>المزيد</button></section>
      <section class="par-card"><h2>امتحانات وواجبات قادمة</h2><div data-par-tasks></div></section>
      <section class="par-card"><h2>جدول الحصص</h2><div data-par-tt></div></section>
      <section class="par-card"><h2>الحضور والغياب</h2><div data-list="attendance"></div><button class="button ghost" type="button" data-more="attendance" hidden>المزيد</button></section>
    </div>
    <section class="par-card" data-par-chat-card><h2>رسائل المدرسين</h2>${renderParentChat(true)}</section>
    <section class="par-card par-link"><h2>ربط ابن جديد</h2>
      <p class="dash-muted">اطلب من ابنك كود الربط من لوحته. يعمل مرة واحدة ويصلح 15 دقيقة.</p>
      <form class="dashboard-form" data-parent-link><label>كود الطالب<input name="code" maxlength="12" placeholder="TNG-K7M2P9XQ" autocomplete="off" required></label>
      <button class="button" type="submit">ربط الطالب</button><p class="form-note" data-link-message role="status" aria-live="polite"></p></form></section>
  </div>`;
}

export function mountParent(root, { auth, database, profile }) {
  const childrenBox = root.querySelector('[data-children]');
  const stats = root.querySelector('[data-stats]');
  const detail = root.querySelector('[data-detail]');
  let students = [];
  let current = null;
  const pchat = mountParentChat(root.querySelector('[data-par-chat-card]'), { profile: { uid: profile.uid, role: 'parent', displayName: profile.displayName || '' }, database });

  async function summary(uid) {
    const [gradeSnap, attSnap] = await Promise.all([
      getDocs(query(collection(database, 'grades'), where('studentUid', '==', uid), orderBy('createdAt', 'desc'), limit(20))),
      getDocs(query(collection(database, 'attendance'), where('studentUid', '==', uid), orderBy('date', 'desc'), limit(20)))
    ]);
    const grades = gradeSnap.docs.map(item => item.data()).filter(item => Number(item.max) > 0);
    const avg = grades.length ? Math.round(grades.reduce((sum, item) => sum + Number(item.score) / Number(item.max) * 100, 0) / grades.length) : null;
    const rows = attSnap.docs.map(item => item.data());
    root.querySelector('[data-avg]').textContent = avg == null ? '—' : `${avg}%`;
    root.querySelector('[data-rate]').textContent = rows.length ? `${Math.round(rows.filter(row => row.present).length / rows.length * 100)}%` : '—';
    root.querySelector('[data-last]').textContent = formatDate(gradeSnap.docs[0]?.data().createdAt) || '—';
  }

  async function classInfo(uid) {
    const student = students.find(item => item.uid === uid);
    const tasksBox = detail.querySelector('[data-par-tasks]'), ttBox = detail.querySelector('[data-par-tt]');
    tasksBox.innerHTML = ttBox.innerHTML = '';
    if (!student?.classId) { tasksBox.innerHTML = ttBox.innerHTML = '<p class="dash-empty">لم يُحدد فصل ابنك بعد.</p>'; return; }
    try {
      const { doc, getDoc, setDoc, limit } = await import('firebase/firestore');
      await setDoc(doc(database, 'parentClassAccess', `${auth.getCurrentUser().uid}_${student.classId}`), { parentUid: auth.getCurrentUser().uid, classId: student.classId, studentUid: uid });
      const today = new Date().toISOString().slice(0, 10);
      const tasks = await getDocs(query(collection(database, 'tasks'), where('classId', '==', student.classId), where('dueDate', '>=', today), orderBy('dueDate'), limit(20)));
      tasksBox.innerHTML = tasks.docs.length ? tasks.docs.map(item => { const t = item.data(); return `<div class="par-row"><span>${t.kind === 'exam' ? 'امتحان' : 'واجب'}: ${esc(t.title)} · ${esc(t.subjectName)}</span><b>${esc(t.dueDate)}</b></div>`; }).join('') : '<p class="dash-empty">لا توجد مهام قادمة.</p>';
      const tt = await getDoc(doc(database, 'timetables', student.classId));
      if (!tt.exists()) { ttBox.innerHTML = '<p class="dash-empty">لم يُنشر الجدول بعد.</p>'; return; }
      const cells = tt.data().cells || {}, days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
      const used = Math.max(0, ...Object.keys(cells).map(key => Number(key.split('_')[1]) || 0));
      ttBox.innerHTML = `<div style="overflow:auto"><table class="adm-table"><tbody><tr><th></th>${days.map(day => `<th>${day}</th>`).join('')}</tr>${Array.from({ length: used }, (_, p) => `<tr><th>${p + 1}</th>${days.map((_, d) => `<td>${esc(cells[`${d}_${p + 1}`] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    } catch { tasksBox.innerHTML = ttBox.innerHTML = '<p class="dash-empty">تعذر تحميل البيانات.</p>'; }
  }

  function select(uid) {
    current = uid;
    childrenBox.querySelectorAll('[data-child]').forEach(button => button.classList.toggle('is-active', button.dataset.child === uid));
    stats.hidden = false; detail.hidden = false; root.querySelector('[data-report-wrap]').hidden = false;
    summary(uid).catch(() => {});
    void classInfo(uid);
    { const st = students.find(item => item.uid === uid); void pchat.setChild(st ? { classId: st.classId, studentName: st.displayName } : null); }
    const gradeRow = item => `<div class="par-row"><span>${esc(item.subjectName || item.subjectId || '')} ${esc(item.title || '')}</span><b>${esc(item.score)}${item.max ? '/' + esc(item.max) : ''}</b></div>`;
    const attRow = item => `<div class="par-row"><span>${esc(item.date)}</span><b class="${item.present ? 'ok' : 'bad'}">${item.present ? 'حاضر' : 'غائب'}</b></div>`;
    // Fresh nodes for every child switch: each pager attaches click handlers to its list and its
    // "more" button, so reusing the old nodes would stack one handler set per switch and a retry
    // would fire stale loads for previously selected children.
    for (const name of ['grades', 'attendance']) {
      const list = detail.querySelector(`[data-list="${name}"]`);
      const more = detail.querySelector(`[data-more="${name}"]`);
      list.replaceWith(list.cloneNode(false));
      more.replaceWith(more.cloneNode(true));
    }
    pager(database, 'grades', [where('studentUid', '==', uid), orderBy('createdAt', 'desc')], gradeRow, { target: detail.querySelector('[data-list="grades"]'), more: detail.querySelector('[data-more="grades"]'), empty: 'لا توجد درجات بعد.' }).load();
    pager(database, 'attendance', [where('studentUid', '==', uid), orderBy('date', 'desc')], attRow, { target: detail.querySelector('[data-list="attendance"]'), more: detail.querySelector('[data-more="attendance"]'), empty: 'لا يوجد حضور مسجل بعد.' }).load();
  }

  async function refresh() {
    try {
      const result = await auth.listLinkedStudents();
      students = Array.isArray(result.students) ? result.students : [];
      childrenBox.innerHTML = students.length
        ? students.map(student => `<button type="button" class="par-child" data-child="${esc(student.uid)}"><b>${esc(student.displayName)}</b><small>${esc(gradeNames[student.grade] || '')} ${esc(student.className || '')}</small></button>`).join('') + ''
        : '<p class="dash-empty">لم تربط أي ابن بعد. استخدم كود الربط بالأسفل.</p>';
      unlink.hidden = !students.length;
      if (students.length) select(students.some(s => s.uid === current) ? current : students[0].uid);
      else { stats.hidden = true; detail.hidden = true; }
    } catch { childrenBox.innerHTML = '<p class="dash-empty">تعذر تحميل الأبناء الآن.</p>'; }
  }

  childrenBox.addEventListener('click', event => {
    const button = event.target.closest('[data-child]');
    if (button) select(button.dataset.child);
  });
  root.querySelector('[data-parent-link]').insertAdjacentHTML('beforebegin', '<button type="button" class="text-link" data-unlink hidden>إلغاء ربط الابن المحدد</button>');
  const unlink = root.querySelector('[data-unlink]');
  const linkLimiter = createAttemptLimiter();
  unlink.addEventListener('click', async () => {
    const student = students.find(item => item.uid === current);
    if (!student || !window.confirm(`إلغاء ربط ${student.displayName}؟ لن تستطيع رؤية بياناته إلا بكود جديد.`)) return;
    unlink.disabled = true;
    try { await auth.unlinkParentFromStudent(student.uid); current = null; await refresh(); }
    catch { window.alert('تعذر إلغاء الربط الآن. حاول مرة أخرى.'); }
    finally { unlink.disabled = false; }
  });
  root.querySelector('[data-parent-link]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    const message = form.querySelector('[data-link-message]');
    const wait = linkLimiter.remainingMs();
    if (wait > 0) { say(message, `محاولات كثيرة غير صحيحة. انتظر ${Math.ceil(wait / 1000)} ثانية ثم حاول مرة أخرى.`, 'error'); return; }
    button.disabled = true;
    try {
      const result = await auth.linkParentToStudent(new FormData(form).get('code'));
      linkLimiter.succeed();
      say(message, `تم ربط ${result.displayName || 'الطالب'} بحسابك.`);
      form.reset();
      await refresh();
    } catch (error) { linkLimiter.fail(); say(message, auth.friendlyAuthError(error), 'error'); }
    finally { button.disabled = false; }
  });
  root.querySelector('[data-report-card]').addEventListener('click', async event => {
    const student = students.find(item => item.uid === current);
    if (!student) return;
    const button = event.currentTarget, note = root.querySelector('[data-report-note]');
    button.disabled = true; note.textContent = 'جارٍ تجهيز الشهادة...';
    try { const { openReportCard } = await import('../report-card.js'); await openReportCard(database, { uid: student.uid, name: student.displayName, className: student.className, gradeLabel: gradeNames[student.grade] || '' }); note.textContent = ''; }
    catch { note.textContent = 'تعذر تجهيز الشهادة الآن.'; }
    finally { button.disabled = false; }
  });
  void refresh();
}
