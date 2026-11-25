// شهادة درجات وتقرير حضور قابل للطباعة أو الحفظ كـ PDF من المتصفح (طباعة > حفظ كـ PDF). بدون خدمات خارجية.
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { esc } from './dashboards/common.js';

/** يحسب متوسط كل مادة والمتوسط العام ونسبة الحضور من صفوف الدرجات والحضور. */
export function buildReport(grades, attendance) {
  const bySubject = new Map();
  for (const item of grades) {
    const max = Number(item.max), score = Number(item.score);
    if (!(max > 0) || !Number.isFinite(score)) continue;
    const key = String(item.subjectName || item.subjectId || 'مادة');
    const entry = bySubject.get(key) ?? { subject: key, sum: 0, count: 0 };
    entry.sum += Math.min(score, max) / max * 100; entry.count += 1;
    bySubject.set(key, entry);
  }
  const subjects = [...bySubject.values()].map(entry => ({ subject: entry.subject, percent: Math.round(entry.sum / entry.count), count: entry.count })).sort((a, b) => a.subject.localeCompare(b.subject, 'ar'));
  const overall = subjects.length ? Math.round(subjects.reduce((sum, item) => sum + item.percent, 0) / subjects.length) : null;
  const present = attendance.filter(row => row.present === true).length;
  return { subjects, overall, attendance: { total: attendance.length, present, absent: attendance.length - present, rate: attendance.length ? Math.round(present / attendance.length * 100) : null } };
}

export function chartSvg(subjects) {
  if (!subjects.length) return '';
  const row = 30, width = 520, label = 150, height = subjects.length * row + 10;
  const bars = subjects.map((item, index) => {
    const y = index * row + 5, w = Math.max(2, (width - label - 50) * item.percent / 100);
    return `<text x="${width - 4}" y="${y + 17}" text-anchor="end" font-size="13">${esc(item.subject)}</text><rect x="${width - label - w}" y="${y + 4}" width="${w}" height="16" rx="4" fill="${item.percent >= 50 ? '#b8912f' : '#b3261e'}"/><text x="${width - label - w - 6}" y="${y + 17}" text-anchor="end" font-size="12">${item.percent}%</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="رسم بياني لمتوسط الدرجات حسب المادة" style="width:100%;max-width:560px" direction="rtl">${bars}</svg>`;
}

export function reportHtml(student, report, dateText) {
  const table = report.subjects.length ? `<table class="rc-table"><thead><tr><th>المادة</th><th>عدد التقييمات</th><th>المتوسط</th></tr></thead><tbody>${report.subjects.map(item => `<tr><td>${esc(item.subject)}</td><td>${item.count}</td><td>${item.percent}%</td></tr>`).join('')}</tbody></table>` : '<p>لا توجد درجات مسجلة.</p>';
  const att = report.attendance;
  return `<article class="rc-sheet"><h1>مدرسة التناغة الشرقية الثانوية</h1><h2>شهادة درجات وحضور</h2>
    <p><b>الطالب:</b> ${esc(student.name)} · <b>الفصل:</b> ${esc(student.className || '—')} ${student.gradeLabel ? `· ${esc(student.gradeLabel)}` : ''}</p>
    <p><b>المتوسط العام:</b> ${report.overall == null ? '—' : report.overall + '%'} · <b>الحضور:</b> ${att.rate == null ? '—' : `${att.rate}% (${att.present} حضور، ${att.absent} غياب من ${att.total} يوم)`}</p>
    ${chartSvg(report.subjects)}${table}
    <p class="rc-note">تاريخ الإصدار: ${esc(dateText)}. هذه الشهادة مبنية على الدرجات والحضور المسجلين على المنصة (آخر 200 درجة و400 يوم حضور) وليست وثيقة رسمية بدون ختم المدرسة.</p></article>`;
}

export async function openReportCard(database, student) {
  const [gradeSnap, attSnap] = await Promise.all([
    getDocs(query(collection(database, 'grades'), where('studentUid', '==', student.uid), orderBy('createdAt', 'desc'), limit(200))),
    getDocs(query(collection(database, 'attendance'), where('studentUid', '==', student.uid), orderBy('date', 'desc'), limit(400)))
  ]);
  const report = buildReport(gradeSnap.docs.map(item => item.data()), attSnap.docs.map(item => item.data()));
  document.getElementById('report-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'report-overlay';
  overlay.className = 'report-overlay';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'شهادة الدرجات');
  overlay.innerHTML = `<div class="rc-bar"><button class="button" type="button" data-rc-print>طباعة / حفظ PDF</button><button class="button ghost" type="button" data-rc-close>إغلاق</button></div>${reportHtml(student, report, new Date().toLocaleDateString('ar-EG'))}`;
  document.body.append(overlay);
  document.body.classList.add('rc-open');
  const close = () => { overlay.remove(); document.body.classList.remove('rc-open'); };
  overlay.querySelector('[data-rc-close]').addEventListener('click', close);
  overlay.querySelector('[data-rc-print]').addEventListener('click', () => window.print());
  overlay.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  overlay.querySelector('[data-rc-close]').focus();
}
