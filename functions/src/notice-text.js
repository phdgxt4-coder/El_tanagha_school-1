// نصوص الإشعارات: دوال نقية قابلة للاختبار بدون Firebase.
const clip = (value, max) => String(value ?? '').trim().slice(0, max);

export const NOTICE_TYPES = Object.freeze(['content', 'grade', 'attendance', 'chat']);

export function buildNotice(type, data = {}) {
  switch (type) {
    case 'content':
      return { type, title: 'محتوى جديد', body: clip(data.title, 80) || 'تم نشر محتوى جديد لفصلك.', link: '/dashboard' };
    case 'grade': {
      const score = Number(data.score);
      const max = Number(data.max);
      const mark = Number.isFinite(score) && Number.isFinite(max) && max > 0 ? ` (${score}/${max})` : '';
      return { type, title: 'درجة جديدة', body: `${clip(data.subjectName, 40) || 'مادة'}: ${clip(data.title, 60)}${mark}`, link: '/dashboard' };
    }
    case 'attendance':
      return { type, title: 'تسجيل غياب', body: `تم تسجيل غياب بتاريخ ${clip(data.date, 10)}.`, link: '/dashboard' };
    case 'chat':
      return { type, title: clip(data.fromName, 60) || 'رسالة جديدة', body: clip(data.text, 100), link: '/dashboard' };
    default:
      throw new Error('notice/unknown-type');
  }
}

/** يحذف المكرر ويستبعد صاحب الفعل. */
export function uniqueRecipients(uids, exceptUid = '') {
  return [...new Set(uids.filter(uid => typeof uid === 'string' && uid && uid !== exceptUid))];
}

export function wantsNotice(prefs, type) {
  return !prefs || prefs[type] !== false;
}
