// تتبع أخطاء المتصفح وتسجيلها في errorReports (وضع Spark: بدون Functions).
// - بصمة ثابتة لكل خطأ، فالتكرار يزيد عدّادًا بدل ما يعمل مستند جديد.
// - حد للجلسة وفاصل زمني لكل خطأ لحماية حصة الكتابة اليومية.
// - لا يقرأ من Firestore أبدًا (القراءة للمالك فقط في القواعد).
// - يقنّع البريد والهاتف وأكواد الربط بنفس scrubMessage الموجودة في error-boundary.js.
import { firebaseConfigured } from '../config/firebase-env.js';
import { isNoise, scrubMessage } from '../ui/error-boundary.js';

/* Firebase (auth + Firestore, مئات الكيلوبايت) لا يُحمَّل مع أول صفحة: يُجلَب كسولًا عند أول خطأ
   فعلي فقط. الزائر بلا أخطاء لا يدفع ثمن تتبع الأخطاء أبدًا. */
const loadAuth = () => Promise.all([import('firebase/auth'), import('../config/firebase-app.js')]);
const loadFirestore = () => Promise.all([import('firebase/firestore'), import('../config/firebase-app.js')]);

const MAX_PER_SESSION = 15;
const MIN_GAP_MS = 60_000;
const RELEASE = String(import.meta.env?.VITE_RELEASE || 'dev').slice(0, 40);

const lastSent = new Map();
const queue = [];
let total = 0;
let uid = null;
let installed = false;
let busy = false;

const cut = (v, n) => String(v ?? '').slice(0, n);

export function fingerprint(kind, message, frame) {
  const s = `${kind}|${String(message).replace(/\d+/g, '#').slice(0, 200)}|${frame}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9747b28c;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
    h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

// اسم الملف فقط (بدون رقم السطر وبدون هاش البناء) حتى تثبت البصمة بين النسخ.
function frameOf(stack) {
  const m = /([^/\s()@]+\.(?:js|mjs))(?::\d+)/.exec(String(stack || ''));
  return m ? m[1].replace(/-[\w-]{6,12}(?=\.m?js$)/, '') : '';
}

function routeNow() {
  if (typeof location === 'undefined') return '';
  return cut(location.pathname + (location.hash || ''), 120);
}

function build(kind, message, stack, line) {
  const msg = scrubMessage(message, 300) || 'خطأ بدون رسالة';
  const frame = frameOf(stack);
  const fp = fingerprint(kind, msg, frame);
  return {
    fp,
    route: routeNow(),
    data: {
      fingerprint: fp,
      kind,
      message: msg,
      source: cut(frame, 120),
      route: routeNow(),
      line: Number.isInteger(line) ? line : 0,
      stack: scrubMessage(stack, 1500),
      agent: cut(typeof navigator !== 'undefined' ? navigator.userAgent : '', 150),
      release: RELEASE,
      lastRoute: routeNow(),
      lastRelease: RELEASE,
      clientAtIso: new Date().toISOString(),
    },
  };
}

async function send(item) {
  const [{ getFirestore, doc, setDoc, updateDoc, increment, serverTimestamp }, { getFirebaseApp }] = await loadFirestore();
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, 'errorReports', item.fp);
  try {
    // الخطأ موجود: زوّد العدّاد (القواعد تقبل +1 كل 30 ثانية فقط).
    await updateDoc(ref, {
      count: increment(1),
      lastAt: serverTimestamp(),
      lastRoute: item.data.lastRoute,
      lastRelease: item.data.lastRelease,
    });
  } catch {
    try {
      // مش موجود (أو متقيّد بالفاصل): جرّب الإنشاء، ولو فشل نتجاهل بهدوء.
      await setDoc(ref, { ...item.data, uid, status: 'open', count: 1, firstAt: serverTimestamp(), lastAt: serverTimestamp() });
    } catch { /* لا نكرر الخطأ على المستخدم أبدًا */ }
  }
}

let authWatchStarted = false;
/* يبدأ مراقبة الجلسة عند أول خطأ مقابل (وليس عند فتح الموقع) حتى يظل مسار الدخول خفيفًا. */
function ensureAuthWatch() {
  if (authWatchStarted) return;
  authWatchStarted = true;
  loadAuth().then(([{ getAuth, onAuthStateChanged }, { getFirebaseApp }]) => {
    onAuthStateChanged(getAuth(getFirebaseApp()), (user) => {
      uid = user ? user.uid : null;
      if (uid) flush();
    });
  }).catch(() => { authWatchStarted = false; });
}

async function flush() {
  if (busy || !uid) return;
  busy = true;
  try {
    while (queue.length) await send(queue.shift());
  } finally {
    busy = false;
  }
}

export function reportError(err, kind = 'manual', line = 0) {
  try {
    if (!firebaseConfigured || total >= MAX_PER_SESSION) return;
    const message = err?.message ?? String(err);
    if (isNoise(message)) return;
    const item = build(kind, message, err?.stack, line);
    const now = Date.now();
    if (now - (lastSent.get(item.fp) || 0) < MIN_GAP_MS) return;
    lastSent.set(item.fp, now);
    total += 1;
    queue.push(item);
    ensureAuthWatch();
    flush();
  } catch { /* المتتبع لا يكسر التطبيق */ }
}

export function installErrorTracker() {
  if (installed || typeof window === 'undefined' || !firebaseConfigured) return;
  installed = true;

  window.addEventListener('error', (ev) => {
    const t = ev.target;
    if (t && t !== window && (t.src || t.href)) {
      const url = String(t.src || t.href).replace(/[?#].*$/, '');
      reportError(new Error(`فشل تحميل مورد: <${String(t.tagName).toLowerCase()}> ${url}`), 'resource');
      return;
    }
    if (ev.message === 'Script error.') return;
    reportError(ev.error || new Error(ev.message), 'error', ev.lineno);
  }, true);

  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason;
    reportError(r instanceof Error ? r : new Error(typeof r === 'string' ? r : 'Promise rejected'), 'promise');
  });
}
