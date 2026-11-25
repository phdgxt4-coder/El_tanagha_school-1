const DRIVE = /^https:\/\/(drive|docs)\.google\.com\/[^\s]+$/u;
const YOUTUBE = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/[^\s]+$/u;
export const isDriveUrl = value => DRIVE.test(String(value ?? ''));
export const isYouTubeUrl = value => YOUTUBE.test(String(value ?? ''));
/** يرجع رسالة خطأ بالعربية أو '' إن كان الرابط مناسبًا لنوع المحتوى. */
export function contentLinkError(type, url) {
  if (type === 'video' && !isYouTubeUrl(url)) return 'رابط الفيديو لازم يكون من يوتيوب.';
  if ((type === 'file' || type === 'assignment') && !isDriveUrl(url)) return 'رابط الملف لازم يكون من جوجل درايف.';
  return '';
}
