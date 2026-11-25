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
  return '<span data-bell-slot></span><button class="dash-signout" type="button" data-dashboard-sign-out>تسجيل الخروج</button>';
}

const NOTICE_ICONS = { content: '📚', grade: '📝', attendance: '📍', chat: '💬' };

/** جرس الإشعارات: عدّاد غير المقروء، قائمة آخر 20، تفضيلات، وتفعيل الإشعارات اللحظية. */
export async function mountBell(root, { profile, database }) {
  const slot = root.querySelector('[data-bell-slot]');
  if (!slot) return () => {};
  const service = await import('../../services/notifications-service.js');
  slot.innerHTML = `<div class="bell"><button class="bell-btn" type="button" aria-label="الإشعارات" aria-expanded="false" data-bell-btn>🔔<b class="bell-count" data-bell-count hidden>0</b></button>
    <div class="bell-panel" data-bell-panel hidden role="dialog" aria-label="الإشعارات">
      <div class="bell-head"><b>الإشعارات</b><button type="button" class="bell-link" data-bell-all>تعليم الكل كمقروء</button></div>
      <div class="bell-list" data-bell-list><p class="dash-empty">لا توجد إشعارات.</p></div>
      <details class="bell-prefs"><summary>إعدادات الإشعارات</summary>
        <div data-bell-prefs></div>
        <button type="button" class="bell-link" data-bell-push>تفعيل إشعارات الجهاز</button>
        <p class="form-note" data-bell-note role="status"></p></details></div></div>`;
  const button = slot.querySelector('[data-bell-btn]');
  const panel = slot.querySelector('[data-bell-panel]');
  const count = slot.querySelector('[data-bell-count]');
  const list = slot.querySelector('[data-bell-list]');
  const note = slot.querySelector('[data-bell-note]');
  let current = [];
  const render = (items, unread) => {
    current = items;
    count.hidden = unread === 0;
    count.textContent = unread > 99 ? '99+' : String(unread);
    button.classList.toggle('has-unread', unread > 0);
    list.innerHTML = items.length ? items.map(item => `<button type="button" class="bell-item ${item.read ? '' : 'is-unread'}" data-id="${esc(item.id)}"><span aria-hidden="true">${NOTICE_ICONS[item.type] || '🔔'}</span><span><b>${esc(item.title)}</b><small>${esc(item.body)}</small><time>${formatDate(item.createdAt)}</time></span></button>`).join('') : '<p class="dash-empty">لا توجد إشعارات.</p>';
  };
  let stop = () => {};
  if (service.sparkMode) {
    const lastSeen = await service.loadLastSeen(database, profile.uid).catch(() => new Date());
    let childUids = [];
    if (profile.role === 'parent') {
      const auth = await import('../../auth/auth-service.js');
      childUids = (await auth.listLinkedStudents().catch(() => ({ students: [] }))).students.map(student => student.uid);
    }
    stop = service.watchDerived(database, profile, lastSeen, childUids, render);
  } else {
    stop = service.watchNotifications(database, profile.uid, render);
  }
  button.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
  });
  document.addEventListener('click', event => { if (!slot.contains(event.target)) { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); } });
  list.addEventListener('click', event => {
    const item = event.target.closest('[data-id]');
    if (item && !service.sparkMode) service.markRead(database, item.dataset.id).catch(() => {});
  });
  slot.querySelector('[data-bell-all]').addEventListener('click', () => {
    if (service.sparkMode) service.saveLastSeen(database, profile.uid).then(() => { stop(); stop = service.watchDerived(database, profile, new Date(), [], render); render([], 0); }).catch(() => {});
    else service.markAllRead(database, current).catch(() => {});
  });
  if (service.sparkMode) slot.querySelector('[data-bell-push]').hidden = true;
  const prefsBox = slot.querySelector('[data-bell-prefs]');
  const prefs = await service.loadPrefs(database, profile.uid).catch(() => ({}));
  prefsBox.innerHTML = service.PREF_KEYS.map(([key, label]) => `<label class="bell-pref"><input type="checkbox" data-pref="${key}" ${prefs[key] === false ? '' : 'checked'}> ${label}</label>`).join('');
  prefsBox.addEventListener('change', async () => {
    const next = {};
    prefsBox.querySelectorAll('[data-pref]').forEach(box => { next[box.dataset.pref] = box.checked; });
    try { await service.savePrefs(database, profile.uid, next); say(note, 'تم حفظ الإعدادات.'); } catch { say(note, 'تعذر الحفظ.', 'error'); }
  });
  slot.querySelector('[data-bell-push]').addEventListener('click', async () => {
    const result = await service.enablePush(database, profile.uid).catch(() => ({ ok: false, reason: 'error' }));
    const texts = {
      '': 'تم تفعيل إشعارات هذا الجهاز.',
      'ios-install': 'على الآيفون: أضف الموقع إلى الشاشة الرئيسية ثم افتحه من الأيقونة وفعّل الإشعارات (iOS 16.4 أو أحدث).',
      unsupported: 'هذا المتصفح لا يدعم الإشعارات اللحظية. ستظهر الإشعارات داخل المنصة.',
      denied: 'تم رفض الإذن. يمكنك تغييره من إعدادات المتصفح.',
      'no-vapid': 'الإشعارات اللحظية غير مفعّلة بعد من إعدادات المدرسة.'
    };
    say(note, texts[result.reason] ?? 'تعذر تفعيل الإشعارات.', result.ok ? 'status' : 'error');
  });
  return stop;
}
