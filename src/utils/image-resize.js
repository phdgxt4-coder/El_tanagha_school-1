export const MAX_IMAGE_BYTES = 700 * 1024;
export const MAX_IMAGE_SIDE = 1400;
export const IMAGE_PREFIX = 'data:image/jpeg;base64,';

/** يصغّر الصورة في المتصفح لـ 1400 بكسل كحد أقصى ويخفض الجودة حتى يدخل تحت 700 كيلو. */
export async function resizeImage(file) {
  if (!file || !/^image\//u.test(file.type)) throw new Error('الملف ليس صورة.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (let quality = 0.85; quality >= 0.4; quality -= 0.1) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.startsWith(IMAGE_PREFIX) && (url.length - IMAGE_PREFIX.length) * 0.75 <= MAX_IMAGE_BYTES) return url;
  }
  throw new Error('الصورة كبيرة جدًا حتى بعد التصغير.');
}
