import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { esc, formatDate, gradeNames, pager, say, shellActions } from './common.js';

export function renderParent(profile) {
  return `<div class="dash dash-parent" data-dash="parent">
    <header class="par-top"><div><span class="eyebrow">لوحة ولي الأمر</span><h1>${esc(profile.displayName || 'ولي الأمر')}</h1></div>${shellActions()}</header>
    <div class="par-children" data-children role="tablist" aria-label="الأبناء"><span class="skeleton skeleton-line short"></span></div>
    <section class="par-stats" data-stats hidden>
      <article><span>متوسط الدرجات</span><strong data-avg>—</strong></article>
      <article><span>نسبة الحضور</span><strong data-rate>—</strong></article>
      <article><span>آخر نشاط</span><strong data-last>—</strong></article>
    </section>
    <div class="par-columns" data-detail hidden>
      <section class="par-card"><h2>الدرجات</h2><div data-list="grades"></div><button class="button ghost" type="button" data-more="grades" hidden>المزيد</button></section>
      <section class="par-card"><h2>الحضور والغياب</h2><div data-list="attendance"></div><button class="button ghost" type="button" data-more="attendance" hidden>المزيد</button></section>
    </div>
    <section class="par-card par-link"><h2>ربط ابن جديد</h2>
      <p class="dash-muted">اطلب من ابنك كود الربط من لوحته. يعمل مرة واحدة ويصلح 15 دقيقة.</p>
      <form class="dashboard-form" data-parent-link><label>كود الطالب<input name="code" maxlength="12" placeholder="TNG-K7M2P9XQ" autocomplete="off" required></label>
      <button class="button" type="submit">ربط الطالب</button><p class="form-note" data-link-message role="status" aria-live="polite"></p></form></section>
  </div>`;
}

export function mountParent(root, { auth, database }) {
  const childrenBox = root.querySelector('[data-children]');
  const stats = root.querySelector('[data-stats]');
  const detail = root.querySelector('[data-detail]');
  let students = [];
  let current = null;

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

  function select(uid) {
    current = uid;
    childrenBox.querySelectorAll('[data-child]').forEach(button => button.classList.toggle('is-active', button.dataset.child === uid));
    stats.hidden = false; detail.hidden = false;
    summary(uid).catch(() => {});
    const gradeRow = item => `<div class="par-row"><span>${esc(item.subjectName || item.subjectId || '')} ${esc(item.title || '')}</span><b>${esc(item.score)}${item.max ? '/' + esc(item.max) : ''}</b></div>`;
    const attRow = item => `<div class="par-row"><span>${esc(item.date)}</span><b class="${item.present ? 'ok' : 'bad'}">${item.present ? 'حاضر' : 'غائب'}</b></div>`;
    detail.querySelector('[data-more="grades"]').replaceWith(detail.querySelector('[data-more="grades"]').cloneNode(true));
    detail.querySelector('[data-more="attendance"]').replaceWith(detail.querySelector('[data-more="attendance"]').cloneNode(true));
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
      if (students.length) select(students.some(s => s.uid === current) ? current : students[0].uid);
      else { stats.hidden = true; detail.hidden = true; }
    } catch { childrenBox.innerHTML = '<p class="dash-empty">تعذر تحميل الأبناء الآن.</p>'; }
  }

  childrenBox.addEventListener('click', event => {
    const button = event.target.closest('[data-child]');
    if (button) select(button.dataset.child);
  });
  root.querySelector('[data-parent-link]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    const message = form.querySelector('[data-link-message]');
    button.disabled = true;
    try {
      const result = await auth.linkParentToStudent(new FormData(form).get('code'));
      say(message, `تم ربط ${result.displayName || 'الطالب'} بحسابك.`);
      form.reset();
      await refresh();
    } catch (error) { say(message, auth.friendlyAuthError(error), 'error'); }
    finally { button.disabled = false; }
  });
  void refresh();
}
