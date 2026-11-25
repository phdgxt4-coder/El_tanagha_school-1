/** نظام الرسائل اللحظي بين الطالب والمدرس */
import { DB, pushNotif } from './storage.js';
import { uid, now, fmt, fmtTime, esc, toast, card, empty } from './utils.js';
import { ROLE } from './config.js';

/** محادثة بين طالب ومدرس */
export function getThread(uid1, uid2) {
  const chats = DB.chats();
  return chats
    .filter(c => (c.from === uid1 && c.to === uid2) || (c.from === uid2 && c.to === uid1))
    .sort((a, b) => a.at - b.at);
}

export function sendMessage(from, to, text) {
  const t = (text || '').trim();
  if (!t) return false;
  if (t.length > 2000) { toast('الرسالة طويلة جداً'); return false; }
  const chats = DB.chats();
  chats.push({ id: uid(), from: from.uid, fromName: from.name, to: to.uid, toName: to.name, text: t, at: now(), read: false });
  DB.saveChats(chats);
  pushNotif(to.uid, 'رسالة جديدة', `${from.name}: ${t.slice(0, 60)}${t.length > 60 ? '…' : ''}`, 'chat');
  return true;
}

export function markRead(readerUid, otherUid) {
  const chats = DB.chats();
  let changed = false;
  chats.forEach(c => {
    if (c.to === readerUid && c.from === otherUid && !c.read) { c.read = true; changed = true; }
  });
  if (changed) DB.saveChats(chats);
}

export function unreadCount(uid) {
  return DB.chats().filter(c => c.to === uid && !c.read).length;
}

export function conversationsFor(user) {
  const chats = DB.chats();
  const map = new Map();
  chats.forEach(c => {
    const other = c.from === user.uid ? c.to : (c.to === user.uid ? c.from : null);
    if (!other) return;
    const otherName = c.from === user.uid ? c.toName : c.fromName;
    if (!map.has(other) || map.get(other).at < c.at) {
      map.set(other, { uid: other, name: otherName, last: c.text, at: c.at, unread: 0 });
    }
  });
  // count unread
  chats.forEach(c => {
    if (c.to === user.uid && !c.read && map.has(c.from)) map.get(c.from).unread++;
  });
  return [...map.values()].sort((a, b) => b.at - a.at);
}

/** واجهة الرسائل داخل الداشبورد */
export function renderChatPanel(cur, targetUid = null) {
  const users = DB.users();
  const convs = conversationsFor(cur);

  // قائمة المدرسين للطالب / قائمة الطلاب للمدرس
  let contacts = [];
  if (cur.role === 'student') {
    contacts = users.filter(u => u.role === 'teacher' && u.status !== 'blocked');
  } else if (cur.role === 'teacher') {
    contacts = users.filter(u => u.role === 'student' && u.status !== 'blocked');
  } else if (cur.role === 'admin') {
    contacts = users.filter(u => u.uid !== cur.uid && u.status !== 'blocked');
  }

  if (!targetUid && convs.length) targetUid = convs[0].uid;
  const target = users.find(u => u.uid === targetUid);

  const thread = target ? getThread(cur.uid, target.uid) : [];
  if (target) markRead(cur.uid, target.uid);

  return `
    <div class="chat-layout">
      <div class="chat-sidebar glass">
        <h5>المحادثات</h5>
        <div class="chat-list" id="chatList">
          ${convs.length ? convs.map(c => `
            <button class="chat-item ${c.uid === targetUid ? 'on' : ''}" data-chat="${c.uid}">
              <div class="chat-av">${esc((c.name || '?')[0])}</div>
              <div class="chat-meta">
                <b>${esc(c.name)}</b>
                <span>${esc((c.last || '').slice(0, 40))}</span>
              </div>
              ${c.unread ? `<span class="badge">${c.unread}</span>` : ''}
            </button>`).join('') : empty('لا محادثات بعد')}
        </div>
        <div class="chat-new">
          <label>بدء محادثة جديدة</label>
          <select id="chatPick">
            <option value="">— اختر —</option>
            ${contacts.map(u => `<option value="${u.uid}">${esc(u.name)} (${ROLE[u.role]})</option>`).join('')}
          </select>
          <button class="btn sm gold full" id="chatStart" style="margin-top:8px">بدء</button>
        </div>
      </div>
      <div class="chat-main glass">
        ${target ? `
          <div class="chat-head">
            <div class="chat-av">${esc(target.name[0])}</div>
            <div><b>${esc(target.name)}</b><span style="font-size:12px;color:var(--mu)">${ROLE[target.role]}</span></div>
          </div>
          <div class="chat-msgs" id="chatMsgs">
            ${thread.map(m => `
              <div class="bubble ${m.from === cur.uid ? 'me' : 'them'}">
                <p>${esc(m.text)}</p>
                <time>${fmtTime(m.at)}</time>
              </div>`).join('') || '<div class="empty-chat">ابدأ المحادثة بكتابة رسالة</div>'}
          </div>
          <form class="chat-input" id="chatForm">
            <input id="chatText" placeholder="اكتب رسالتك..." maxlength="2000" autocomplete="off">
            <button type="submit" class="btn gold">إرسال</button>
          </form>
        ` : `<div class="empty-chat">اختر محادثة أو ابدأ محادثة جديدة مع ${cur.role === 'student' ? 'مدرس' : 'طالب'}</div>`}
      </div>
    </div>`;
}

export function bindChatEvents(cur, rerender) {
  document.getElementById('chatStart')?.addEventListener('click', () => {
    const id = document.getElementById('chatPick')?.value;
    if (!id) return toast('اختر مستخدماً');
    rerender(id);
  });
  document.querySelectorAll('[data-chat]').forEach(b => {
    b.onclick = () => rerender(b.dataset.chat);
  });
  const form = document.getElementById('chatForm');
  if (form) {
    form.onsubmit = e => {
      e.preventDefault();
      const text = document.getElementById('chatText')?.value;
      const targetUid = document.querySelector('.chat-item.on')?.dataset.chat || document.getElementById('chatPick')?.value;
      const target = DB.users().find(u => u.uid === targetUid);
      if (!target) return toast('اختر مستلماً');
      if (sendMessage(cur, target, text)) {
        document.getElementById('chatText').value = '';
        rerender(target.uid);
        // scroll to bottom
        const box = document.getElementById('chatMsgs');
        if (box) box.scrollTop = box.scrollHeight;
      }
    };
  }
  // auto scroll
  const box = document.getElementById('chatMsgs');
  if (box) box.scrollTop = box.scrollHeight;
}
