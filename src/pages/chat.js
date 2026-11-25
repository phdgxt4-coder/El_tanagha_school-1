import {
  addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch
} from 'firebase/firestore';
import { esc, formatDate } from './dashboards/common.js';

export const MAX_CHAT_TEXT = 1000;

export const conversationId = (studentUid, teacherUid) => `${studentUid}_${teacherUid}`;

/** يرسل رسالة (ويُنشئ المحادثة إن كانت أول رسالة) في عملية واحدة. */
export async function sendMessage(database, { profile, teacher, studentUid, studentName, teacherUid, teacherName, text, isNew }) {
  const clean = String(text ?? '').trim();
  if (!clean || clean.length > MAX_CHAT_TEXT) throw new Error('الرسالة فارغة أو أطول من 1000 حرف.');
  const cid = conversationId(studentUid, teacherUid);
  const conv = doc(database, 'conversations', cid);
  const batch = writeBatch(database);
  const last = { lastAt: serverTimestamp(), lastText: clean.slice(0, 80), lastBy: profile.uid };
  if (isNew) batch.set(conv, { studentUid, teacherUid, studentName: String(studentName ?? '').slice(0, 80), teacherName: String(teacherName ?? '').slice(0, 80), ...last });
  else batch.update(conv, last);
  batch.set(doc(collection(database, 'conversations', cid, 'messages')), { senderUid: profile.uid, text: clean, createdAt: serverTimestamp() });
  await batch.commit();
  return cid;
}

export function renderChatPanel() {
  return `<div class="chat" data-chat>
    <div class="chat-list" data-chat-list><div data-chat-search-box><input type="search" data-chat-search placeholder="ابحث عن مدرس" aria-label="ابحث عن مدرس" style="direction:rtl;text-align:right"></div><div data-chat-results></div><div data-chat-convs></div></div>
    <div class="chat-thread" data-chat-thread hidden><header><button type="button" class="text-link" data-chat-back>رجوع</button><b data-chat-title></b></header>
      <div class="chat-msgs" data-chat-msgs aria-live="polite"></div>
      <form data-chat-form><textarea name="text" maxlength="${MAX_CHAT_TEXT}" rows="2" required placeholder="اكتب رسالتك" style="direction:rtl;text-align:right"></textarea><button class="button" type="submit">إرسال</button></form>
      <p class="form-note" data-chat-note role="status"></p></div></div>`;
}

export function mountChat(root, { profile, database }) {
  const isStudent = profile.role === 'student';
  const $ = selector => root.querySelector(selector);
  const listBox = $('[data-chat-list]'), thread = $('[data-chat-thread]'), msgs = $('[data-chat-msgs]'), note = $('[data-chat-note]');
  if (!isStudent) $('[data-chat-search-box]').hidden = true;
  let teachers = null, stopThread = () => {}, stopList = () => {}, active = null;

  const openThread = ({ studentUid, teacherUid, studentName, teacherName, isNew }) => {
    stopThread();
    active = { studentUid, teacherUid, studentName, teacherName, isNew };
    $('[data-chat-title]').textContent = isStudent ? teacherName : studentName;
    listBox.hidden = true; thread.hidden = false; msgs.innerHTML = ''; note.textContent = '';
    const q = query(collection(database, 'conversations', conversationId(studentUid, teacherUid), 'messages'), orderBy('createdAt', 'desc'), limit(50));
    stopThread = onSnapshot(q, snapshot => {
      active.isNew = false;
      const items = snapshot.docs.map(item => item.data()).reverse();
      msgs.innerHTML = items.map(item => `<p class="chat-msg ${item.senderUid === profile.uid ? 'mine' : 'theirs'}">${esc(item.text)}<time>${formatDate(item.createdAt)}</time></p>`).join('');
      msgs.scrollTop = msgs.scrollHeight;
    }, () => { if (!active.isNew) note.textContent = 'تعذر تحميل الرسائل.'; });
  };

  $('[data-chat-back]').addEventListener('click', () => { stopThread(); thread.hidden = true; listBox.hidden = false; });
  $('[data-chat-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('button');
    button.disabled = true; note.textContent = '';
    try { await sendMessage(database, { profile, ...active, text: form.elements.text.value }); form.reset(); if (active.isNew) openThread({ ...active, isNew: false }); }
    catch (error) { note.textContent = /1000|فارغة/u.test(error.message) ? error.message : 'تعذر الإرسال. انتظر ثانيتين وحاول مرة أخرى.'; }
    finally { button.disabled = false; }
  });

  const convBox = $('[data-chat-convs]');
  const convs = new Map();
  const renderConvs = () => {
    const rows = [...convs.values()].sort((a, b) => (b.lastAt?.toMillis?.() ?? 0) - (a.lastAt?.toMillis?.() ?? 0));
    convBox.innerHTML = rows.length ? rows.map(item => `<button type="button" class="stu-row chat-conv" data-conv="${esc(item.id)}"><b>${esc(isStudent ? item.teacherName : item.studentName)}</b><span>${esc(item.lastText)}</span></button>`).join('') : '<p class="dash-empty">لا توجد محادثات بعد.</p>';
  };
  const field = isStudent ? 'studentUid' : 'teacherUid';
  stopList = onSnapshot(query(collection(database, 'conversations'), where(field, '==', profile.uid), orderBy('lastAt', 'desc'), limit(30)), snapshot => {
    convs.clear(); snapshot.docs.forEach(item => convs.set(item.id, { id: item.id, ...item.data() })); renderConvs();
  }, () => { convBox.innerHTML = '<p class="dash-empty">تعذر تحميل المحادثات.</p>'; });
  convBox.addEventListener('click', event => {
    const row = event.target.closest('[data-conv]'); if (!row) return;
    openThread({ ...convs.get(row.dataset.conv), isNew: false });
  });

  const results = $('[data-chat-results]');
  const showTeachers = text => {
    const needle = text.trim();
    const found = needle ? teachers.filter(item => item.displayName.includes(needle)).slice(0, 8) : [];
    results.innerHTML = found.map(item => `<button type="button" class="stu-row" data-teacher="${esc(item.uid)}"><b>${esc(item.displayName)}</b><span>بدء محادثة</span></button>`).join('');
  };
  if (isStudent) {
    $('[data-chat-search]').addEventListener('input', async event => {
      if (!teachers) {
        try { teachers = (await getDocs(query(collection(database, 'profiles'), where('role', '==', 'teacher'), where('status', '==', 'active'), limit(200)))).docs.map(item => ({ uid: item.id, displayName: String(item.data().displayName ?? '') })); }
        catch { results.innerHTML = '<p class="dash-empty">تعذر تحميل المدرسين.</p>'; return; }
      }
      showTeachers(event.target.value);
    });
    results.addEventListener('click', event => {
      const row = event.target.closest('[data-teacher]'); if (!row) return;
      const teacher = teachers.find(item => item.uid === row.dataset.teacher);
      const existing = convs.get(conversationId(profile.uid, teacher.uid));
      openThread({ studentUid: profile.uid, studentName: profile.displayName, teacherUid: teacher.uid, teacherName: teacher.displayName, isNew: !existing });
    });
  }
  return () => { stopThread(); stopList(); };
}
