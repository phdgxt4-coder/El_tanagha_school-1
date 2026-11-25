import { orderBy, where } from 'firebase/firestore';
import { bindTabs, esc, formatDate, gradeNames, pager, shellActions, say } from './common.js';
import { mountChat, renderChatPanel } from '../chat.js';
import { loadClassAssignments } from '../../services/structure-service.js';

const TABS = [['home', 'الرئيسية', '⌂'], ['lessons', 'الدروس', '▤'], ['grades', 'درجاتي', '★'], ['attendance', 'حضوري', '✓'], ['teachers', 'مدرسيني', '☺'], ['timetable', 'الجدول', '▦'], ['tasks', 'امتحانات وواجبات', '✎'], ['images', 'الصور', '▣'], ['chat', 'رسائل', '✉'], ['parent', 'ولي الأمر', '♥']];

function parentCodeErrorMessage(error) {
  const code = String(error?.code ?? '');
  if (code === 'permission-denied' || code === 'firestore/permission-denied') return 'تعذر إصدار الكود: الصلاحيات (قواعد Firestore) لا تسمح الآن. تأكد من توثيق البريد ومن نشر آخر قواعد.';
  if (code === 'failed-precondition') return error.message;
  if (code === 'unavailable' || code === 'firestore/unavailable') return 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.';
  if (code === 'auth/no-current-user') return 'انتهت الجلسة. سجّل الدخول مرة أخرى.';
  return `تعذر إصدار كود جديد الآن (${code || 'خطأ غير معروف'}).`;
}

export function renderStudent(profile) {
  const first = String(profile.displayName || 'طالب').split(' ')[0];
  return `<div class="dash dash-student" data-dash="student">
    <header class="stu-hero"><div><span class="eyebrow">لوحة الطالب</span><h1>أهلًا يا ${esc(first)}</h1>
      <p>${esc(gradeNames[profile.grade] || '')}${profile.className ? ' · ' + esc(profile.className) : ''}</p></div>${shellActions()}</header>
    <nav class="stu-tabs" role="tablist" aria-label="أقسام الطالب">${TABS.map(([id, label, icon], index) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${index === 0}" class="${index === 0 ? 'is-active' : ''}"><i aria-hidden="true">${icon}</i><span>${label}</span></button>`).join('')}</nav>
    <section data-panel="home" class="stu-feed">
      <article class="stu-tile tone-a"><h2>آخر الدروس</h2><div data-home-lessons></div></article>
      <article class="stu-tile tone-b"><h2>آخر درجاتي</h2><div data-home-grades></div></article>
      <article class="stu-tile tone-c"><h2>نسبة حضوري</h2><strong class="stu-big" data-attendance-rate>—</strong><p class="dash-muted">من آخر 20 يوم مسجل</p></article>
    </section>
    <section data-panel="lessons" hidden class="stu-feed"><div class="stu-list" data-list="lessons"></div><button class="button ghost" type="button" data-more="lessons" hidden>تحميل المزيد</button></section>
    <section data-panel="grades" hidden class="stu-feed"><button class="button ghost" type="button" data-report-card>شهادة الدرجات والحضور (PDF)</button><p class="form-note" data-report-note role="status"></p><div class="stu-list" data-list="grades"></div><button class="button ghost" type="button" data-more="grades" hidden>تحميل المزيد</button></section>
    <section data-panel="attendance" hidden class="stu-feed"><div class="stu-list" data-list="attendance"></div><button class="button ghost" type="button" data-more="attendance" hidden>تحميل المزيد</button></section>
    <section data-panel="teachers" hidden class="stu-feed"><div class="stu-list" data-list="teachers"></div></section>
    <section data-panel="timetable" hidden class="stu-feed"><div data-tt></div></section>
    <section data-panel="tasks" hidden class="stu-feed"><div class="stu-list" data-list="tasks"></div></section>
    <section data-panel="images" hidden class="stu-feed"><div class="stu-list" data-list="images"></div><button class="button ghost" type="button" data-more="images" hidden>تحميل المزيد</button></section>
    <section data-panel="chat" hidden class="stu-feed">${renderChatPanel()}</section>
    <section data-panel="parent" hidden class="stu-feed"><article class="stu-tile">
      <h2>كود ربط ولي الأمر</h2><p class="dash-muted">الكود يُستخدم مرة واحدة وينتهي بعد 15 دقيقة. أعطه لولي أمرك فقط.</p>
      <strong class="parent-code" dir="ltr" data-parent-code>${esc(profile.parentCode || '—')}</strong>
      <p class="form-note" data-parent-code-message role="status"></p>
      <button class="button" type="button" data-issue-parent-code>إصدار كود جديد</button>
      <h3>أولياء الأمور المرتبطون</h3><div data-links></div></article></section>
  </div>`;
}

export function mountStudent(root, { profile, auth, database }) {
  const tabs = bindTabs(root);
  const q = (name) => root.querySelector(`[data-list="${name}"]`);
  const more = (name) => root.querySelector(`[data-more="${name}"]`);
  const lessonRow = item => `<article class="stu-row"><b>${esc(item.title)}</b><span>${esc(item.subjectName || item.subjectId || '')} · ${esc(item.type)} · ${formatDate(item.createdAt)}</span>${/^https:\/\//u.test(item.url || '') ? `<a class="button ghost" target="_blank" rel="noopener noreferrer" href="${esc(item.url)}">فتح</a>` : ''}</article>`;
  const gradeRow = item => `<article class="stu-row"><b>${esc(item.title || item.subjectName || 'تقييم')}</b><span>${esc(item.subjectName || item.subjectId || '')} · ${formatDate(item.createdAt)}</span><strong class="stu-score">${esc(item.score)}${item.max ? ' / ' + esc(item.max) : ''}</strong></article>`;
  const attendanceRow = item => `<article class="stu-row"><b>${esc(item.date)}</b><span class="${item.present ? 'ok' : 'bad'}">${item.present ? 'حاضر' : 'غائب'}</span></article>`;
  const classId = profile.classId;
  const lessons = classId ? pager(database, 'content', [where('classId', '==', classId), where('published', '==', true), orderBy('createdAt', 'desc')], lessonRow, { target: q('lessons'), more: more('lessons'), empty: 'لا توجد دروس منشورة لفصلك بعد.' }) : null;
  const grades = pager(database, 'grades', [where('studentUid', '==', profile.uid), orderBy('createdAt', 'desc')], gradeRow, { target: q('grades'), more: more('grades'), empty: 'لا توجد درجات مسجلة بعد.' });
  const attendance = pager(database, 'attendance', [where('studentUid', '==', profile.uid), orderBy('date', 'desc')], attendanceRow, { target: q('attendance'), more: more('attendance'), empty: 'لا يوجد حضور مسجل بعد.' });
  if (!lessons) q('lessons').innerHTML = '<p class="dash-empty">لم يُحدد فصلك بعد. تواصل مع الإدارة.</p>';
  tabs.onFirstShow('lessons', () => lessons?.load());
  const images = classId ? pager(database, 'images', [where('classId', '==', classId), orderBy('createdAt', 'desc')], item => `<article class="stu-row"><b>${esc(item.title)}</b><img loading="lazy" alt="${esc(item.title)}" style="max-width:100%;border-radius:12px" src="${/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/u.test(item.data || '') ? item.data : ''}"><span>${formatDate(item.createdAt)}</span></article>`, { target: q('images'), more: more('images'), size: 5, empty: 'لا توجد صور لفصلك بعد.' }) : null;
  tabs.onFirstShow('timetable', async () => {
    const target = root.querySelector('[data-tt]');
    if (!classId) { target.innerHTML = '<p class="dash-empty">لم يُحدد فصلك بعد.</p>'; return; }
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const snapshot = await getDoc(doc(database, 'timetables', classId));
      if (!snapshot.exists()) { target.innerHTML = '<p class="dash-empty">لم يُنشر جدول فصلك بعد.</p>'; return; }
      const cells = snapshot.data().cells || {};
      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
      const used = Math.max(0, ...Object.keys(cells).map(key => Number(key.split('_')[1]) || 0));
      target.innerHTML = `<div style="overflow:auto"><table class="adm-table"><tbody><tr><th></th>${days.map(day => `<th>${day}</th>`).join('')}</tr>${Array.from({ length: used }, (_, p) => `<tr><th>${p + 1}</th>${days.map((_, d) => `<td>${esc(cells[`${d}_${p + 1}`] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    } catch { target.innerHTML = '<p class="dash-empty">تعذر تحميل الجدول.</p>'; }
  });
  tabs.onFirstShow('tasks', async () => {
    const target = q('tasks');
    if (!classId) { target.innerHTML = '<p class="dash-empty">لم يُحدد فصلك بعد.</p>'; return; }
    try {
      const { collection, getDocs, limit, query } = await import('firebase/firestore');
      const today = new Date().toISOString().slice(0, 10);
      const snapshot = await getDocs(query(collection(database, 'tasks'), where('classId', '==', classId), where('dueDate', '>=', today), orderBy('dueDate'), limit(30)));
      target.innerHTML = snapshot.docs.length ? snapshot.docs.map(item => { const t = item.data(); return `<article class="stu-row"><b>${t.kind === 'exam' ? 'امتحان' : 'واجب'}: ${esc(t.title)}</b><span>${esc(t.subjectName)} · ${esc(t.dueDate)}</span>${t.note ? `<span>${esc(t.note)}</span>` : ''}</article>`; }).join('') : '<p class="dash-empty">لا توجد امتحانات أو واجبات قادمة.</p>';
    } catch { target.innerHTML = '<p class="dash-empty">تعذر تحميل المهام.</p>'; }
  });
  tabs.onFirstShow('images', () => images?.load());
  tabs.onFirstShow('grades', () => grades.load());
  root.querySelector('[data-report-card]').addEventListener('click', async event => {
    const button = event.currentTarget, note = root.querySelector('[data-report-note]');
    button.disabled = true; note.textContent = 'جارٍ تجهيز الشهادة...';
    try { const { openReportCard } = await import('../report-card.js'); await openReportCard(database, { uid: profile.uid, name: profile.displayName, className: profile.className, gradeLabel: gradeNames[profile.grade] || '' }); note.textContent = ''; }
    catch { note.textContent = 'تعذر تجهيز الشهادة الآن.'; }
    finally { button.disabled = false; }
  });
  tabs.onFirstShow('attendance', () => attendance.load());
  tabs.onFirstShow('teachers', async () => {
    const target = q('teachers');
    if (!classId) { target.innerHTML = '<p class="dash-empty">لم يُحدد فصلك بعد.</p>'; return; }
    try {
      const list = await loadClassAssignments(classId);
      target.innerHTML = list.length ? list.map(item => `<article class="stu-row"><b>${esc(item.subjectName)}</b><span>${esc(item.teacherName)}</span></article>`).join('') : '<p class="dash-empty">لم تُسند مواد لفصلك بعد.</p>';
    } catch { target.innerHTML = '<p class="dash-empty">تعذر تحميل المدرسين.</p>'; }
  });
  tabs.onFirstShow('chat', () => mountChat(root.querySelector('[data-panel="chat"]'), { profile, database }));
  tabs.onFirstShow('parent', async () => {
    const target = root.querySelector('[data-links]');
    try {
      const { collection, getDocs, limit, query } = await import('firebase/firestore');
      const snapshot = await getDocs(query(collection(database, 'parentLinks'), where('studentUid', '==', profile.uid), limit(10)));
      const active = snapshot.docs.filter(item => item.data().active === true);
      target.innerHTML = active.length ? active.map(item => `<div class="stu-row"><b>ولي أمر مرتبط</b><button class="text-link" type="button" data-revoke="${esc(item.id)}">إلغاء الربط</button></div>`).join('') : '<p class="dash-empty">لا يوجد ولي أمر مرتبط.</p>';
    } catch { target.innerHTML = '<p class="dash-empty">تعذر تحميل الروابط.</p>'; }
  });
  // الرئيسية: آخر عناصر فقط (صفحة واحدة صغيرة لكل قسم)
  Promise.all([
    lessons ? pager(database, 'content', [where('classId', '==', classId), where('published', '==', true), orderBy('createdAt', 'desc')], lessonRow, { target: root.querySelector('[data-home-lessons]'), size: 3, empty: 'لا توجد دروس بعد.' }).load() : null,
    pager(database, 'grades', [where('studentUid', '==', profile.uid), orderBy('createdAt', 'desc')], gradeRow, { target: root.querySelector('[data-home-grades]'), size: 3, empty: 'لا توجد درجات بعد.' }).load(),
    (async () => {
      const { collection, getDocs, limit, query } = await import('firebase/firestore');
      const snapshot = await getDocs(query(collection(database, 'attendance'), where('studentUid', '==', profile.uid), orderBy('date', 'desc'), limit(20)));
      const rows = snapshot.docs.map(item => item.data());
      root.querySelector('[data-attendance-rate]').textContent = rows.length ? `${Math.round(rows.filter(row => row.present).length / rows.length * 100)}%` : '—';
    })().catch(() => {})
  ]);
  root.addEventListener('click', async event => {
    const issue = event.target.closest('[data-issue-parent-code]');
    const revoke = event.target.closest('[data-revoke]');
    const message = root.querySelector('[data-parent-code-message]');
    if (issue) {
      issue.disabled = true;
      try { const result = await auth.issueParentCode(); root.querySelector('[data-parent-code]').textContent = result.code; say(message, 'تم إصدار كود جديد صالح 15 دقيقة. الكود القديم أُلغي.'); }
      catch (error) { say(message, parentCodeErrorMessage(error), 'error'); }
      finally { issue.disabled = false; }
    }
    if (revoke && window.confirm('سيُلغى وصول ولي الأمر لبياناتك. متأكد؟')) {
      revoke.disabled = true;
      try { await auth.revokeParentLink(revoke.dataset.revoke); revoke.closest('.stu-row').remove(); }
      catch { revoke.disabled = false; say(message, 'تعذر إلغاء الربط.', 'error'); }
    }
  });
}
