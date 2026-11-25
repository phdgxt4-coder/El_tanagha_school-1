// رسائل ولي الأمر والمدرس. ولي الأمر يبدأ مع مدرس مُسنَد لفصل ابنه فقط (القواعد تتحقق).
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { esc, formatDate } from './dashboards/common.js';
import { MAX_CHAT_TEXT } from './chat.js';

const millis = value => value?.toMillis?.() ?? 0;

export function renderParentChat(isParent) {
  return `<div class="chat" data-pchat>
    <div class="chat-list" data-pc-list>${isParent ? '<div><label>مدرسو فصل ابنك<select data-pc-teachers aria-label="اختر مدرسًا"><option value="">اختر مدرسًا لبدء رسالة</option></select></label></div>' : ''}<div data-pc-convs></div></div>
    <div class="chat-thread" data-pc-thread hidden><header><button type="button" class="text-link" data-pc-back>رجوع</button><b data-pc-title></b></header>
      <div class="chat-msgs" data-pc-msgs aria-live="polite"></div>
      <form data-pc-form><textarea name="text" maxlength="${MAX_CHAT_TEXT}" rows="2" required placeholder="اكتب رسالتك" style="direction:rtl;text-align:right"></textarea><button class="button" type="submit">إرسال</button></form>
      <p class="form-note" data-pc-note role="status"></p></div></div>`;
}

/** يركّب الرسائل داخل root. للأهل: يستدعي api.setChild({classId, studentName}) عند تغيير الابن المحدد. */
export function mountParentChat(root, { profile, database }) {
  const isParent = profile.role === 'parent';
  const $ = selector => root.querySelector(selector);
  const listBox = $('[data-pc-list]'), thread = $('[data-pc-thread]'), msgs = $('[data-pc-msgs]'), note = $('[data-pc-note]'), convBox = $('[data-pc-convs]');
  const myRead = isParent ? 'parentReadAt' : 'teacherReadAt', otherRead = isParent ? 'teacherReadAt' : 'parentReadAt';
  let active = null, stopThread = () => {}, child = null, assignments = [];
  const convs = new Map();

  const renderConvs = () => {
    const rows = [...convs.values()].sort((a, b) => millis(b.lastAt) - millis(a.lastAt));
    convBox.innerHTML = rows.length ? rows.map(item => `<button type="button" class="stu-row chat-conv" data-pc-conv="${esc(item.id)}"><b>${esc(isParent ? item.teacherName : `${item.parentName} (ولي ${item.studentName})`)}</b><span>${esc(item.lastText)}</span>${item.lastBy !== profile.uid && millis(item[myRead]) < millis(item.lastAt) ? '<mark>جديدة</mark>' : ''}</button>`).join('') : '<p class="dash-empty">لا توجد رسائل بعد.</p>';
  };
  const field = isParent ? 'parentUid' : 'teacherUid';
  const stopList = onSnapshot(query(collection(database, 'parentConversations'), where(field, '==', profile.uid), orderBy('lastAt', 'desc'), limit(30)), snapshot => {
    convs.clear(); snapshot.docs.forEach(item => convs.set(item.id, { id: item.id, ...item.data() })); renderConvs();
  }, () => { convBox.innerHTML = '<p class="dash-empty">تعذر تحميل الرسائل.</p>'; });

  const openThread = info => {
    stopThread();
    active = info;
    $('[data-pc-title]').textContent = isParent ? info.teacherName : `${info.parentName} (ولي ${info.studentName})`;
    listBox.hidden = true; thread.hidden = false; msgs.innerHTML = ''; note.textContent = '';
    const cid = info.id ?? `${profile.uid}_${info.teacherUid}`;
    let items = [], conv = {}, marking = false;
    const paint = () => {
      const seen = millis(conv[otherRead]);
      msgs.innerHTML = items.map(item => {
        const mine = item.senderUid === profile.uid, read = seen && seen >= millis(item.createdAt);
        return `<p class="chat-msg ${mine ? 'mine' : 'theirs'}">${esc(item.text)}<time>${formatDate(item.createdAt)}</time>${mine ? `<span class="chat-tick" aria-label="${read ? 'تمت القراءة' : 'تم الإرسال'}">${read ? '✓✓' : '✓'}</span>` : ''}</p>`;
      }).join('');
      msgs.scrollTop = msgs.scrollHeight;
    };
    const markRead = () => {
      const latest = items[items.length - 1];
      if (marking || !latest || latest.senderUid === profile.uid || active?.isNew) return;
      if (conv[myRead] && millis(conv[myRead]) >= millis(latest.createdAt)) return;
      marking = true;
      updateDoc(doc(database, 'parentConversations', cid), { [myRead]: serverTimestamp() }).catch(() => {}).finally(() => { marking = false; });
    };
    const stopMsgs = onSnapshot(query(collection(database, 'parentConversations', cid, 'messages'), orderBy('createdAt', 'desc'), limit(50)), snapshot => {
      active.isNew = false; items = snapshot.docs.map(item => item.data()).reverse(); paint(); markRead();
    }, () => { if (!active.isNew) note.textContent = 'تعذر تحميل الرسائل.'; });
    const stopConv = onSnapshot(doc(database, 'parentConversations', cid), snapshot => { conv = snapshot.data() ?? {}; paint(); markRead(); }, () => {});
    stopThread = () => { stopMsgs(); stopConv(); };
  };

  $('[data-pc-back]').addEventListener('click', () => { stopThread(); thread.hidden = true; listBox.hidden = false; });
  $('[data-pc-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('button');
    const text = String(form.elements.text.value ?? '').trim();
    if (!text || text.length > MAX_CHAT_TEXT) { note.textContent = 'الرسالة فارغة أو أطول من 1000 حرف.'; return; }
    button.disabled = true; note.textContent = '';
    try {
      const cid = active.id ?? `${profile.uid}_${active.teacherUid}`;
      const batch = writeBatch(database);
      const last = { lastAt: serverTimestamp(), lastText: text.slice(0, 80), lastBy: profile.uid };
      const ref = doc(database, 'parentConversations', cid);
      if (active.isNew) batch.set(ref, { parentUid: profile.uid, teacherUid: active.teacherUid, parentName: String(profile.displayName ?? '').slice(0, 80), teacherName: active.teacherName.slice(0, 80), studentName: active.studentName.slice(0, 80), classId: active.classId, subjectId: active.subjectId, ...last });
      else batch.update(ref, last);
      batch.set(doc(collection(database, 'parentConversations', cid, 'messages')), { senderUid: profile.uid, text, createdAt: serverTimestamp() });
      await batch.commit();
      form.reset();
      if (active.isNew) openThread({ ...active, id: cid, isNew: false });
    } catch { note.textContent = 'تعذر الإرسال. انتظر ثانيتين وحاول مرة أخرى، وتأكد أن الابن ما زال مرتبطًا.'; }
    finally { button.disabled = false; }
  });
  convBox.addEventListener('click', event => {
    const row = event.target.closest('[data-pc-conv]'); if (!row) return;
    openThread({ ...convs.get(row.dataset.pcConv), isNew: false });
  });

  const select = $('[data-pc-teachers]');
  async function setChild(next) {
    child = next; assignments = [];
    if (!select) return;
    select.innerHTML = '<option value="">اختر مدرسًا لبدء رسالة</option>';
    if (!child?.classId) return;
    try {
      const snapshot = await getDocs(query(collection(database, 'teacherAssignments'), where('classId', '==', child.classId), limit(40)));
      assignments = snapshot.docs.map(item => item.data());
      select.innerHTML += assignments.map((item, index) => `<option value="${index}">${esc(item.teacherName)} · ${esc(item.subjectName)}</option>`).join('');
    } catch { select.innerHTML = '<option value="">تعذر تحميل المدرسين</option>'; }
  }
  select?.addEventListener('change', () => {
    const item = assignments[Number(select.value)];
    if (!item || select.value === '') return;
    const id = `${profile.uid}_${item.teacherUid}`;
    openThread(convs.has(id) ? { ...convs.get(id), isNew: false } : { teacherUid: item.teacherUid, teacherName: item.teacherName, studentName: child.studentName, classId: child.classId, subjectId: item.subjectId, isNew: true });
    select.value = '';
  });
  return { setChild, stop: () => { stopThread(); stopList(); } };
}
