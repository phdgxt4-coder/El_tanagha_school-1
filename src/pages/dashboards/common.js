import { collection, getDocs, limit, query, startAfter } from 'firebase/firestore';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const gradeNames = { '1': 'الأول الثانوي', '2': 'الثاني الثانوي', '3': 'الثالث الثانوي' };
export const PAGE_SIZE = 20;

export function formatDate(value) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
  return date ? date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
}

export function skeletonRows(count = 3) {
  return `<div class="dash-skeleton" aria-hidden="true">${Array.from({ length: count }, () => '<span class="skeleton skeleton-line title"></span><span class="skeleton skeleton-line"></span>').join('')}</div>`;
}

export function emptyNote(text) {
  return `<p class="dash-empty">${esc(text)}</p>`;
}

export function say(target, text, kind = 'status') {
  if (!target) return;
  target.textContent = text;
  target.dataset.kind = kind;
}

/** قائمة مرقّمة بالمؤشر: لا تجلب أكثر من صفحة واحدة في المرة. */
export function pager(database, path, constraints, render, { target, more, size = PAGE_SIZE, empty = 'لا توجد بيانات بعد.' }) {
  let cursor = null;
  let loading = false;
  let first = true;
  async function load() {
    if (loading) return;
    loading = true;
    if (first) target.innerHTML = skeletonRows(3);
    try {
      const parts = [...constraints, limit(size + 1)];
      if (cursor) parts.push(startAfter(cursor));
      const snapshot = await getDocs(query(collection(database, path), ...parts));
      const docs = snapshot.docs.slice(0, size);
      const html = docs.map(item => render({ id: item.id, ...item.data() })).join('');
      if (first) target.innerHTML = docs.length ? html : emptyNote(empty);
      else target.insertAdjacentHTML('beforeend', html);
      first = false;
      cursor = docs[docs.length - 1] ?? cursor;
      if (more) more.hidden = snapshot.docs.length <= size;
    } catch {
      if (first) target.innerHTML = emptyNote('تعذر تحميل البيانات الآن. حاول مرة أخرى.');
    } finally {
      loading = false;
    }
  }
  more?.addEventListener('click', load);
  return { load, reset() { cursor = null; first = true; return load(); } };
}

export function bindTabs(root) {
  const tabs = [...root.querySelectorAll('[data-tab]')];
  const panels = [...root.querySelectorAll('[data-panel]')];
  const loaded = new Set();
  const handlers = new Map();
  function show(name) {
    tabs.forEach(tab => { const on = tab.dataset.tab === name; tab.classList.toggle('is-active', on); tab.setAttribute('aria-selected', String(on)); });
    panels.forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
    if (!loaded.has(name)) { loaded.add(name); handlers.get(name)?.(); }
  }
  tabs.forEach(tab => tab.addEventListener('click', () => show(tab.dataset.tab)));
  return { onFirstShow(name, fn) { handlers.set(name, fn); }, show };
}

export function shellActions() {
  return '<button class="dash-signout" type="button" data-dashboard-sign-out>تسجيل الخروج</button>';
}
