/** طبقة التخزين المحلي — بيانات حية ومستمرة */
const PREFIX = 'tg2_';

function get(k, d) {
  try { const v = localStorage.getItem(PREFIX + k); return v ? JSON.parse(v) : d; } catch { return d; }
}
function set(k, v) {
  try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { console.warn('storage', e); }
}

export const DB = {
  users: () => get('users', []),
  saveUsers: u => set('users', u),
  content: () => get('content', []),
  saveContent: c => set('content', c),
  homework: () => get('homework', []),
  saveHomework: h => set('homework', h),
  hwSubs: () => get('hwSubs', []),
  saveHwSubs: s => set('hwSubs', s),
  quizzes: () => get('quizzes', []),
  saveQuizzes: q => set('quizzes', q),
  quizSubs: () => get('quizSubs', []),
  saveQuizSubs: s => set('quizSubs', s),
  exams: () => get('exams', []),
  saveExams: e => set('exams', e),
  examSubs: () => get('examSubs', []),
  saveExamSubs: s => set('examSubs', s),
  att: () => get('att', []),
  saveAtt: a => set('att', a),
  msgs: () => get('msgs', []),
  saveMsgs: m => set('msgs', m),
  notifs: () => get('notifs', []),
  saveNotifs: n => set('notifs', n),
  chats: () => get('chats', []),
  saveChats: c => set('chats', c),
  links: () => get('links', []),
  saveLinks: l => set('links', l),
  kids: () => get('kids', []),
  saveKids: k => set('kids', k),
  contact: () => get('contact', []),
  saveContact: c => set('contact', c),
  session() {
    try { return JSON.parse(sessionStorage.getItem(PREFIX + 'sess') || 'null'); } catch { return null; }
  },
  setSession(u) {
    if (u) sessionStorage.setItem(PREFIX + 'sess', JSON.stringify({ uid: u.uid }));
    else sessionStorage.removeItem(PREFIX + 'sess');
  }
};

export function pushNotif(toUid, title, body, type = 'info') {
  const list = DB.notifs();
  list.push({ id: 'n' + Date.now().toString(36), to: toUid, title, body, type, read: false, at: Date.now() });
  DB.saveNotifs(list);
}
