// يسجل أخطاء المتصفح لمستخدم مسجل الدخول في Firestore ليراها المدير. حد 5 أخطاء لكل جلسة، بدون بيانات شخصية.
import { firebaseConfigured } from '../config/firebase-env.js';
import { scrubMessage } from '../ui/error-boundary.js';

const seen = new Set();
let sent = 0;

async function report(message, source) {
  const text = scrubMessage(message);
  if (!firebaseConfigured || !text || sent >= 5 || seen.has(text)) return;
  seen.add(text);
  try {
    const [{ getAuth }, { addDoc, collection, getFirestore, serverTimestamp }, { getFirebaseApp }] = await Promise.all([
      import('firebase/auth'), import('firebase/firestore'), import('../config/firebase-app.js')
    ]);
    const app = getFirebaseApp();
    const user = getAuth(app).currentUser;
    if (!user) return;
    sent += 1;
    await addDoc(collection(getFirestore(app), 'clientErrors'), {
      uid: user.uid, message: text, source: String(source || '').slice(0, 120), route: location.pathname.slice(0, 120),
      agent: navigator.userAgent.slice(0, 150), at: serverTimestamp()
    });
  } catch { /* لا نكرر الأخطاء من مسجل الأخطاء */ }
}

export function initErrorReporter() {
  window.addEventListener('error', event => { void report(event.message, event.filename); });
  window.addEventListener('unhandledrejection', event => { void report(event.reason?.message || String(event.reason), 'promise'); });
}
