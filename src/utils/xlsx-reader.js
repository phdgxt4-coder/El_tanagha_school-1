// قارئ بسيط لملفات Excel (.xlsx) بدون مكتبات خارجية: يقرأ أول ورقة فقط ويرجع الصفوف كنصوص.
// يستخدم DecompressionStream المتاح في المتصفحات الحديثة. لا يدعم الصيغ المعقدة ولا الملفات المشفرة.
const decoder = new TextDecoder('utf-8');
const MAX_BYTES = 2_000_000;

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readZipEntries(buffer) {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ملف Excel غير صالح.');
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map();
  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('ملف Excel غير صالح.');
    const method = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLen));
    entries.set(name, { method, size, local });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return { view, entries };
}

async function readEntry(buffer, zip, name) {
  const entry = zip.entries.get(name);
  if (!entry) return null;
  const { view } = zip;
  const nameLen = view.getUint16(entry.local + 26, true);
  const extraLen = view.getUint16(entry.local + 28, true);
  const start = entry.local + 30 + nameLen + extraLen;
  const data = new Uint8Array(buffer, start, entry.size);
  if (entry.method === 0) return decoder.decode(data);
  if (entry.method !== 8) throw new Error('ملف Excel غير مدعوم.');
  return decoder.decode(await inflateRaw(data));
}

const unescapeXml = text => text.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/giu, (_, code) => {
  if (code === 'lt') return '<';
  if (code === 'gt') return '>';
  if (code === 'amp') return '&';
  if (code === 'quot') return '"';
  if (code === 'apos') return "'";
  return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
});

const textOf = xml => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gu)].map(match => unescapeXml(match[1])).join('');
const columnIndex = ref => [...ref.replace(/\d+/gu, '')].reduce((sum, ch) => sum * 26 + ch.charCodeAt(0) - 64, 0) - 1;

export const MAX_XLSX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 2000;

export async function readXlsxRows(buffer) {
  if (buffer.byteLength > MAX_XLSX_BYTES) throw new Error('الملف أكبر من 5 ميجا. قسّمه إلى ملفات أصغر.');
  if (buffer.byteLength > MAX_BYTES) throw new Error('الملف كبير. الحد 2 ميجابايت.');
  const zip = readZipEntries(buffer);
  const shared = await readEntry(buffer, zip, 'xl/sharedStrings.xml');
  const strings = shared ? [...shared.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/gu)].map(match => textOf(match[1])) : [];
  const sheetName = [...zip.entries.keys()].filter(key => /^xl\/worksheets\/sheet\d+\.xml$/u.test(key)).sort()[0];
  const sheet = sheetName && await readEntry(buffer, zip, sheetName);
  if (!sheet) throw new Error('لا توجد ورقة في الملف.');
  const rows = [];
  for (const rowMatch of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/gu)) {
    const cells = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu)) {
      const attrs = cell[1], body = cell[2] ?? '';
      const ref = /r="([A-Z]+\d+)"/u.exec(attrs)?.[1];
      const type = /t="([^"]+)"/u.exec(attrs)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/u.exec(body)?.[1];
      let value = '';
      if (type === 's') value = strings[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (raw !== undefined) value = /e/iu.test(raw) && Number.isFinite(Number(raw)) ? Number(raw).toFixed(0) : unescapeXml(raw);
      cells[ref ? columnIndex(ref) : cells.length] = value.trim();
    }
    rows.push(Array.from(cells, value => value ?? ''));
    if (rows.length > MAX_ROWS) break;
  }
  return rows;
}

/** يمنع حقن الصيغ: خلية تبدأ بـ = + - @ تفقد هذه الأحرف حتى لا تُنفذ كصيغة عند فتح الملف المصدّر لاحقًا. */
export function sanitizeCell(value) {
  return String(value ?? '').replace(/^[\s=+\-@\t\r]+/u, '').trim();
}

/** يحوّل صفوف Excel إلى أسطر "الاسم, الهاتف" ويعيد الصفر الأول المفقود في أرقام الموبايل المصرية. */
export function rosterLinesFromRows(rows) {
  return rows
    .filter(row => sanitizeCell(row[0]) && /\d{7,}/u.test(row[1] ?? ''))
    .map(row => {
      let phone = String(row[1]).replace(/\s+/gu, '');
      if (/^1\d{9}$/u.test(phone)) phone = `0${phone}`;
      return `${sanitizeCell(row[0])}, ${phone}`;
    });
}
