// لوحة المالك — مركز التشخيص والأخطاء:
// سجل الأخطاء المجمّعة بالبصمة + تعليقات الصفحات + نتائج مراجعة الكود + تقرير تصدير للذكاء الاصطناعي.
// الحماية الحقيقية في firestore.rules (isOwner). فحص isOwnerUser هنا لتجربة الاستخدام فقط.
// لا يُكتب في Firestore إلا ضمن الحقول التي تسمح بها القواعد، ولا تُعرض أي بيانات غير محفوظة فعلًا.
import { getAuth } from 'firebase/auth';
import {
  getFirestore, collection, doc, getDoc, getDocs, query, orderBy, limit,
  updateDoc, addDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseApp } from '../../config/firebase-app.js';

const STALE_DAYS = 14;
const STATUS_AR = { open: 'مفتوح', likely_fixed: 'يُرجَّح إصلاحه', resolved: 'تم الإصلاح' };
const SEV_AR = { critical: 'حرجة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
const KIND_AR = { error: 'خطأ تشغيل', promise: 'عملية غير متزامنة مرفوضة', resource: 'فشل تحميل مورد', boundary: 'خطأ في عرض الواجهة', manual: 'بلاغ يدوي' };
const REVIEW_SEV_AR = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة', info: 'معلومة' };

// ربط المسار بالميزة والفئة المتأثرة (مطابق لمسارات التطبيق في src/app.js).
const FEATURES = [
  [/^\/$/, 'الصفحة الرئيسية', 'الزوار'],
  [/^\/subjects\//, 'صفحة مادة دراسية', 'الزوار والطلاب'],
  [/^\/subjects/, 'دليل المواد', 'الزوار والطلاب'],
  [/^\/teachers/, 'دليل المدرسين', 'الزوار'],
  [/^\/news/, 'الأخبار', 'الزوار'],
  [/^\/schedule/, 'الجداول الدراسية', 'الطلاب وأولياء الأمور'],
  [/^\/results/, 'نتائج الطلاب', 'الطلاب وأولياء الأمور'],
  [/^\/contact/, 'نموذج التواصل', 'الزوار'],
  [/^\/privacy/, 'سياسة الخصوصية', 'الزوار'],
  [/^\/login\/admin/, 'دخول الإدارة', 'الإدارة'],
  [/^\/login\/teacher/, 'دخول المدرسين', 'المدرسون'],
  [/^\/login\/parent/, 'دخول أولياء الأمور', 'أولياء الأمور'],
  [/^\/login\/student/, 'دخول الطلاب', 'الطلاب'],
  [/^\/login/, 'تسجيل الدخول', 'جميع المستخدمين'],
  [/^\/admin\/join/, 'انضمام مدير جديد', 'الإدارة'],
  [/^\/admin\/teacher-requests/, 'اعتماد المدرسين', 'الإدارة'],
  [/^\/dashboard/, 'لوحة الحساب', 'المستخدمون المسجّلون'],
];

function featureOf(route) {
  const path = String(route || '').split(/[?#]/)[0] || '/';
  for (const [pattern, name, audience] of FEATURES) if (pattern.test(path)) return { name, audience };
  return { name: `المسار ${path}`, audience: 'غير محددة' };
}

// قاعدة المعرفة: [نمط الرسالة، السبب المحتمل، الحل المقترح، إجراء منع التكرار]
// الصياغة عربية فصحى مبسطة، والحلول مرتبطة ببنية المنصة الفعلية (Vite + Firestore + GitHub Pages).
const KNOWLEDGE = [
  [/Cannot read (?:properties|property) of (?:undefined|null)|undefined is not an object|null is not an object/i,
    'حاول الكود قراءة خاصية من قيمة فارغة؛ غالبًا وصلت البيانات متأخرة أو عاد الاستعلام بلا نتائج.',
    'افتح الصفحة المذكورة وراجع الاستعلام الذي يملأ بياناتها، ثم استخدم التصفية الاختيارية (؟.) مع قيمة افتراضية واضحة.',
    'أضف للشاشة حالة تحميل وحالة «لا توجد بيانات»، واختبارًا يغطي الحالة الفارغة.'],
  [/permission-denied|Missing or insufficient permissions/i,
    'العملية رفضتها قواعد Firestore: الحقول المرسلة أو دور المستخدم أو حالته لا تطابق ما تسمح به firestore.rules.',
    'قارن الحقول التي يرسلها الكود بالحقول المسموحة في القاعدة المعنية، وراجع دور المستخدم (role/status)، ثم جرّب العملية نفسها في المحاكي.',
    'أضف اختبار قواعد لهذه العملية (pnpm test:rules) حتى يكشف أي تعديل مستقبلي في القواعد الخطأ قبل النشر.'],
  [/resource-exhausted|quota/i,
    'اقتربت حصة خطة Spark اليومية من نهايتها أو انتهت، فبدأت العمليات تُرفض.',
    'قلّل القراءات: استخدم limit مع التخزين المؤقت (src/services/cache.js)، وتجنّب onSnapshot على المجموعات الكبيرة والكتابة داخل الحلقات.',
    'راجع استهلاك Firebase أسبوعيًا، واجعل كل قائمة مقسّمة إلى صفحات (pagination) بحسب قواعد السرعة في AGENTS.md.'],
  [/dynamically imported module|ChunkLoadError|Loading chunk|Importing a module script failed/i,
    'متصفح المستخدم يحتفظ بنسخة قديمة من التطبيق بعد نشر إصدار جديد، وملف الجزء (chunk) القديم لم يعد موجودًا على الاستضافة.',
    'يحتاج المستخدم إلى تحديث الصفحة؛ تأكد أن إشعار التحديث (update-notice) وعامل الخدمة (service worker) يفرضان التحديث بعد كل نشر.',
    'اختبر سيناريو «نشر جديد أثناء وجود المستخدم داخل التطبيق» بعد كل تعديل في نظام التحديث.'],
  [/requires an index/i,
    'استعلام مركّب يحتاج فهرسًا غير موجود في Firestore.',
    'أضف الفهرس إلى firestore.indexes.json وانشره، أو افتح رابط إنشاء الفهرس الموجود في نص الخطأ الأصلي.',
    'شغّل الاستعلامات الجديدة في المحاكي قبل الدمج؛ المحاكي يعلن عن الفهارس الناقصة فورًا.'],
  [/QuotaExceededError/i,
    'امتلأت مساحة التخزين المحلية في متصفح المستخدم.',
    'قلّل ما يُحفظ في localStorage أو نظّفه دوريًا.',
    'ضع حدًا أقصى لحجم البيانات المخزّنة محليًا، وتجاهل عناصر التخزين المؤقت القديمة تلقائيًا.'],
  [/unavailable|network|Failed to fetch|offline/i,
    'انقطاع الشبكة لدى المستخدم هو السبب الأرجح؛ إن تكرر على صفحة واحدة فقد تكون تطلب بيانات كثيرة دفعة واحدة.',
    'إن كان الخطأ متكررًا على مسار بعينه، راجع حجم الطلبات في تلك الصفحة وقسّمها.',
    'اعرض رسالة «تحقق من الاتصال» مع زر إعادة المحاولة بدلًا من ترك الصفحة فارغة.'],
  [/not-configured/i,
    'إعدادات Firebase غير موجودة في النسخة المنشورة؛ غالبًا فُقد أحد متغيرات VITE_FIREBASE_* أثناء البناء.',
    'راجع متغيرات المستودع في GitHub وأعد النشر.',
    'أضف إلى CI فحصًا يفشل عند غياب أي متغير من متغيرات Firebase في بناء الإنتاج.'],
  [/ResizeObserver loop/i,
    'تحذير متصفح شائع وغير ضار في الغالب.',
    'يمكن تجاهله ما لم يصاحبه خلل ظاهر في الواجهة.',
    'لا يحتاج إجراء.'],
];

function analyze(r) {
  if (r.kind === 'resource') {
    return {
      cause: 'تعذّر تحميل ملف (سكربت أو نمط أو صورة) من الاستضافة.',
      solution: 'راجع مسار المورد (المسار الأساسي لـ GitHub Pages) وتأكد أن الملف نُشر فعلًا ضمن dist.',
      prevention: 'اختبر الروابط المباشرة وإعادة تحميل الصفحات الداخلية بعد كل نشر.',
    };
  }
  for (const [re, cause, solution, prevention] of KNOWLEDGE) if (re.test(r.message || '')) return { cause, solution, prevention };
  return {
    cause: 'سبب غير مصنّف بعد؛ يحدّده فحص الملف والسطر في أثر المكدس (stack).',
    solution: 'افتح الصفحة المذكورة في «المسار» وكرّر الخطوات، ثم راجع الملف والسطر الظاهرين في أثر المكدس.',
    prevention: 'بعد الإصلاح أضف اختبارًا يغطي الحالة نفسها حتى لا تتكرر.',
  };
}

// الخطورة تُستنتج من نوع الخطأ ورسالته ثم تُرفع درجة عند التكرار الكثيف أو العودة بعد الإصلاح.
const SEV_RANK = { low: 0, medium: 1, high: 2, critical: 3 };
const RANK_SEV = ['low', 'medium', 'high', 'critical'];
function severityOf(r) {
  const msg = r.message || '';
  let base;
  if (/resource-exhausted|quota/i.test(msg)) base = 'critical';
  else if (/permission-denied|insufficient permissions|requires an index|not-configured/i.test(msg)) base = 'high';
  else if (r.kind === 'resource' || /ChunkLoadError|Loading chunk|dynamically imported/i.test(msg)) base = 'medium';
  else if (/network|Failed to fetch|offline|unavailable|QuotaExceededError/i.test(msg)) base = 'low';
  else if (r.kind === 'error' || r.kind === 'promise' || r.kind === 'boundary') base = 'high';
  else base = 'medium';
  let rank = SEV_RANK[base];
  if ((r.count || 1) >= 10) rank += 1;
  if ((r.reopenCount || 0) >= 2) rank += 1;
  return RANK_SEV[Math.min(rank, 3)];
}

const ms = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0);
const fakeTs = (t) => ({ toMillis: () => t, toDate: () => new Date(t) });
const fmt = (ts) => {
  const t = ms(ts);
  return t ? new Date(t).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }) : '—';
};

// أولوية منطقية: وزن الخطورة + حجم التكرار + حداثة الظهور + العودة بعد الإصلاح.
function priorityOf(r) {
  const sevW = { critical: 40, high: 25, medium: 15, low: 5 };
  const ageH = (Date.now() - ms(r.lastAt)) / 36e5;
  const recency = ms(r.lastAt) ? (ageH < 24 ? 20 : ageH < 72 ? 10 : 0) : 0;
  return sevW[severityOf(r)] + Math.min(30, (r.count || 1) * 3) + recency + Math.min(15, (r.reopenCount || 0) * 5);
}
function priorityLabel(score) {
  if (score >= 70) return 'قصوى';
  if (score >= 50) return 'مرتفعة';
  if (score >= 30) return 'متوسطة';
  return 'عادية';
}

function impactText(r) {
  const feature = featureOf(r.route);
  const sev = severityOf(r);
  const head = `يظهر في «${feature.name}» ويؤثر على ${feature.audience}.`;
  if (sev === 'critical') return `${head} قد يعطّل ميزة أساسية لدى عدد متزايد من المستخدمين؛ يستحق المعالجة الفورية.`;
  if (sev === 'high') return `${head} يمنع إتمام العملية المتأثرة ويظهر للمستخدم كعطل في المنصة.`;
  if (sev === 'medium') return `${head} قد يمر دون أن يوقف العملية، لكنه يشوّه التجربة ويستحق الإصلاح.`;
  return `${head} أثره محدود وغالبًا مرتبط بظروف جهاز المستخدم أو شبكته.`;
}

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const today = () => new Date().toISOString().slice(0, 10);

function injectStyle() {
  if (document.getElementById('oc-style')) return;
  const css = `
.oc{--oc-bg:var(--bg,#0d1220);--oc-card:var(--card,#141b2d);--oc-line:var(--border,#27324a);--oc-text:var(--text,#e8ecf5);--oc-muted:var(--muted,#9aa6bf);--oc-accent:var(--gold,#d4a94a);--oc-bad:#e5736b;--oc-warn:#ef9a55;--oc-ok:#5fb98a;color:var(--oc-text);font:inherit;max-width:1200px;margin:0 auto;padding:12px}
.oc h2{margin:0 0 4px;font-size:1.3rem}.oc h3{margin:0 0 8px;font-size:1.05rem}
.oc-muted{color:var(--oc-muted);margin:0 0 10px;font-size:.9rem}
.oc-row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;align-items:center}
.oc button,.oc-btn{background:var(--oc-card);color:var(--oc-text);border:1px solid var(--oc-line);border-radius:8px;padding:9px 14px;min-height:40px;cursor:pointer;font:inherit}
.oc button:hover{border-color:var(--oc-accent)}
.oc button.oc-primary{background:var(--oc-accent);color:#1a1405;border-color:var(--oc-accent);font-weight:600}
.oc button[aria-selected="true"],.oc button[aria-pressed="true"]{border-color:var(--oc-accent);color:var(--oc-accent)}
.oc button:focus-visible,.oc input:focus-visible,.oc textarea:focus-visible,.oc select:focus-visible,.oc a:focus-visible{outline:2px solid var(--oc-accent);outline-offset:2px}
.oc-tabs{display:flex;gap:6px;margin:10px 0;overflow-x:auto}
.oc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:10px 0}
.oc-kpi{background:var(--oc-card);border:1px solid var(--oc-line);border-radius:10px;padding:10px;text-align:center}
.oc-kpi strong{display:block;font-size:1.3rem}
.oc-kpi span{color:var(--oc-muted);font-size:.82rem}
.oc-insights{display:flex;flex-direction:column;gap:6px;margin:10px 0}
.oc-insight{background:var(--oc-card);border-inline-start:3px solid var(--oc-accent);border-radius:8px;padding:8px 12px;font-size:.9rem}
.oc-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
@media(min-width:860px){.oc-grid{grid-template-columns:minmax(0,5fr) minmax(0,7fr)}}
.oc-list{display:flex;flex-direction:column;gap:6px;max-height:70vh;overflow:auto}
.oc-item{text-align:right;width:100%;display:grid;grid-template-columns:6px minmax(0,1fr);gap:10px;align-items:start}
.oc-item[aria-current="true"]{border-color:var(--oc-accent)}
.oc-item b{display:block;font-weight:600}
.oc-item small{display:block;color:var(--oc-muted);margin-top:4px}
.oc-dot{width:6px;height:100%;min-height:34px;border-radius:4px;background:var(--oc-muted)}
.oc-dot.critical{background:var(--oc-bad)}.oc-dot.high{background:var(--oc-warn)}.oc-dot.medium{background:var(--oc-accent)}.oc-dot.low{background:var(--oc-muted)}
.oc-panel{background:var(--oc-card);border:1px solid var(--oc-line);border-radius:10px;padding:14px}
.oc-section{margin-top:14px}
.oc-section>h4{margin:0 0 6px;font-size:.95rem;color:var(--oc-accent)}
.oc-kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 14px;font-size:.9rem}
.oc-kv dt{color:var(--oc-muted)}.oc-kv dd{margin:0}
.oc textarea,.oc input[type=text],.oc input[type=search]{width:100%;box-sizing:border-box;background:var(--oc-bg);color:var(--oc-text);border:1px solid var(--oc-line);border-radius:8px;padding:8px;font:inherit}
.oc textarea{min-height:76px;resize:vertical}
.oc label{display:block;margin:10px 0 4px;color:var(--oc-muted);font-size:.9rem}
.oc pre{direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-word;background:var(--oc-bg);border:1px solid var(--oc-line);border-radius:8px;padding:8px;max-height:220px;overflow:auto;font-size:.8rem}
.oc-tag{display:inline-block;border:1px solid var(--oc-line);border-radius:999px;padding:1px 10px;font-size:.8rem;margin-inline-start:6px}
.oc-tag.open{color:var(--oc-bad);border-color:var(--oc-bad)}.oc-tag.resolved{color:var(--oc-ok);border-color:var(--oc-ok)}.oc-tag.likely_fixed{color:var(--oc-accent);border-color:var(--oc-accent)}
.oc-sev{display:inline-block;border-radius:999px;padding:1px 10px;font-size:.8rem;border:1px solid;margin-inline-start:6px}
.oc-sev.critical{color:var(--oc-bad);border-color:var(--oc-bad)}.oc-sev.high{color:var(--oc-warn);border-color:var(--oc-warn)}.oc-sev.medium{color:var(--oc-accent);border-color:var(--oc-accent)}.oc-sev.low{color:var(--oc-muted);border-color:var(--oc-muted)}
.oc-msg{background:var(--oc-card);border:1px solid var(--oc-accent);border-radius:8px;padding:8px 12px}
.oc-empty{text-align:center;padding:36px 12px;border:1px dashed var(--oc-line);border-radius:10px;color:var(--oc-muted)}
.oc-empty b{display:block;font-size:1.05rem;color:var(--oc-text);margin-bottom:6px}
.oc-timeline{margin:0;padding:0;list-style:none}
.oc-timeline li{position:relative;padding-inline-start:18px;margin-bottom:8px;font-size:.9rem}
.oc-timeline li::before{content:"";position:absolute;inset-inline-start:0;top:7px;width:8px;height:8px;border-radius:50%;background:var(--oc-accent)}
.oc-timeline time{color:var(--oc-muted);display:block;font-size:.82rem}
@media(prefers-reduced-motion:reduce){.oc *{transition:none!important;animation:none!important}}`;
  document.head.append(h('style', { id: 'oc-style' }, css));
}

export async function isOwnerUser() {
  try {
    const app = getFirebaseApp();
    const u = getAuth(app).currentUser;
    if (!u) return false;
    const d = (await getDoc(doc(getFirestore(app), 'admins', u.uid))).data();
    return !!d && d.active === true && d.isOwner === true;
  } catch {
    return false;
  }
}

// تحديث تلقائي محدود (20 عنصرًا في المرة): يغلق ما انقطع 14 يومًا أو ما نزلت بعده نسخة جديدة،
// ويعيد فتح ما عاد يتكرر بعد إغلاقه. القرينة ليست تأكيدًا؛ التأكيد بزر «تأكيد الإصلاح».
async function sweep(db, reports, release) {
  const now = Date.now();
  let n = 0;
  for (const r of reports) {
    if (n >= 20) break;
    const last = ms(r.lastAt);
    const res = ms(r.resolvedAt);
    let patch = null;
    if ((r.status === 'resolved' || r.status === 'likely_fixed') && res && last > res) {
      patch = { status: 'open', autoResolved: false, reopenCount: (r.reopenCount || 0) + 1 };
    } else if (r.status === 'open') {
      const age = (now - last) / 864e5;
      const newerRelease = release && r.lastRelease && r.lastRelease !== release && age >= 2;
      if (age >= STALE_DAYS || newerRelease) patch = { status: 'likely_fixed', autoResolved: true, resolvedAt: serverTimestamp() };
    }
    if (!patch) continue;
    try {
      await updateDoc(doc(db, 'errorReports', r.id), patch);
      Object.assign(r, patch, patch.resolvedAt ? { resolvedAt: fakeTs(now) } : {});
      n += 1;
    } catch { /* نكمل الباقي */ }
  }
  return n;
}

// استنتاجات من الأنماط الحالية (تُحسب في كل عرض ولا تُخزَّن):
// أكثر صفحة تتأثرًا، أكثر ملف مصدرًا للأخطاء، أخطاء ظهرت مع النسخة الحالية، وأخطاء عادت بعد إصلاحها.
function insights(reports, release) {
  const open = reports.filter((r) => r.status === 'open');
  const out = [];
  const byRoute = new Map();
  const bySource = new Map();
  for (const r of open) {
    byRoute.set(r.route, (byRoute.get(r.route) || 0) + (r.count || 1));
    if (r.source) bySource.set(r.source, (bySource.get(r.source) || 0) + 1);
  }
  const topRoute = [...byRoute.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topRoute) out.push(`أكثر صفحة تتأثر حاليًا: «${featureOf(topRoute[0]).name}» (${topRoute[0]}) بواقع ${topRoute[1]} تكرارًا للأخطاء المفتوحة.`);
  const topSource = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topSource && topSource[1] >= 2) out.push(`الملف ${topSource[0]} مصدر ${topSource[1]} أخطاء مفتوحة مختلفة؛ فحصه أولًا قد يحل أكثر من مشكلة.`);
  const inRelease = open.filter((r) => release && r.release === release).length;
  if (inRelease) out.push(`${inRelease} خطأ مفتوح ظهر لأول مرة في النسخة الحالية (${release.slice(0, 12)})؛ راجع آخر تغييرات دُمجت قبل النشر.`);
  const chronic = open.filter((r) => (r.reopenCount || 0) > 0).length;
  if (chronic) out.push(`${chronic} خطأ عاد بعد إغلاقه سابقًا؛ هذه تحتاج حلًا جذريًا لا إخفاءً للأعراض.`);
  return out;
}

// سجل زمني مشتق من الحقول المحفوظة فقط (لا توجد مجموعة تاريخ منفصلة في خطة Spark).
function timeline(r) {
  const items = [];
  if (ms(r.firstAt)) items.push({ t: r.firstAt, text: 'أول ظهور مسجّل لهذا الخطأ.' });
  if (ms(r.resolvedAt)) items.push({ t: r.resolvedAt, text: r.autoResolved ? `أُغلق تلقائيًا (انقطع ${STALE_DAYS} يومًا أو نزلت نسخة أحدث).` : 'أُغلق يدويًا بتأكيد المالك.' });
  if ((r.reopenCount || 0) > 0) items.push({ t: r.lastAt, text: `عاد للظهور بعد الإغلاق ${r.reopenCount} ${r.reopenCount > 1 ? 'مرات' : 'مرة'}.` });
  if (ms(r.lastAt)) items.push({ t: r.lastAt, text: 'آخر ظهور مسجّل.' });
  return items.sort((a, b) => ms(a.t) - ms(b.t));
}

function buildMarkdown(S, release) {
  const L = [];
  const open = S.reports.filter((r) => r.status === 'open').sort((a, b) => priorityOf(b) - priorityOf(a));
  const likely = S.reports.filter((r) => r.status === 'likely_fixed');
  const done = S.reports.filter((r) => r.status === 'resolved');
  const sevCount = { critical: 0, high: 0, medium: 0, low: 0 };
  open.forEach((r) => { sevCount[severityOf(r)] += 1; });
  const byFeature = new Map();
  open.forEach((r) => { const f = featureOf(r.route).name; byFeature.set(f, (byFeature.get(f) || 0) + 1); });

  L.push('# تقرير تشخيص منصة التناغه الشرقية', '', `تاريخ التقرير: ${today()}`, `نسخة المنصة الحالية: ${release || 'غير محددة'}`, '');

  // ---- ملخص تنفيذي ----
  L.push('## الملخص التنفيذي', '');
  if (!open.length) {
    L.push('لا توجد أخطاء مفتوحة حاليًا. المنصة في حالة مستقرة وفق سجل الأخطاء.', '');
  } else {
    const top = open[0];
    L.push(
      `يوجد ${open.length} خطأ مفتوح: حرجة ${sevCount.critical}، عالية ${sevCount.high}، متوسطة ${sevCount.medium}، منخفضة ${sevCount.low}.`,
      `أعلى أولوية الآن: «${top.message}» في ${featureOf(top.route).name} (تكرر ${top.count} ${top.count > 1 ? 'مرات' : 'مرة'}، خطورة ${SEV_AR[severityOf(top)]}).`,
      `يُنصح بالبدء بالأخطاء الحرجة والعالية ثم الأكثر تكرارًا؛ التفاصيل الكاملة أدناه.`, '');
  }

  // ---- إحصائيات ----
  L.push('## الإحصائيات', '',
    '| البعد | التوزيع |', '| --- | --- |',
    `| الحالة | مفتوح ${open.length} · يُرجَّح إصلاحه ${likely.length} · تم إصلاحه ${done.length} |`,
    `| خطورة المفتوحة | حرجة ${sevCount.critical} · عالية ${sevCount.high} · متوسطة ${sevCount.medium} · منخفضة ${sevCount.low} |`);
  if (byFeature.size) L.push(`| الميزات المتأثرة | ${[...byFeature.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} (${n})`).join(' · ')} |`);
  L.push('');

  // ---- تعليمات للمساعد (AI) ----
  L.push('## تعليمات للمساعد (AI)', '',
    'المنصة: JavaScript (ES modules) مبني بـ Vite، واجهة RTL عربية، استضافة GitHub Pages، وخلفية Firebase على خطة Spark (Auth + Firestore بدون Cloud Functions).',
    'كل خطأ أدناه مرفق بمساره وملفه ووقته وتكراره وأثر المكدس والسبب المحتمل والحل المقترح. المطلوب:',
    '1. ابدأ بقسم الأولويات وحدد السبب الجذري لكل خطأ.',
    '2. اقترح تعديلًا صغيرًا ومحددًا (ملفًا وسطرًا) ولا تغيّر شيئًا غير مرتبط.',
    '3. إن كان سبب الخطأ قواعد Firestore فعدّل القواعد وأضف اختبار قواعد (pnpm test:rules).',
    '4. أضف اختبارًا يمنع تكرار الخطأ، واذكر أثر التعديل على باقي المنصة.',
    '5. تحقق من الكود الفعلي قبل أي تعديل؛ التحليل هنا استنتاج آلي قابل للخطأ.', '');

  // ---- الأولويات ----
  if (open.length) {
    L.push('## الأولويات', '');
    open.slice(0, 5).forEach((r, i) => {
      L.push(`${i + 1}. **[${SEV_AR[severityOf(r)]} / أولوية ${priorityLabel(priorityOf(r))}]** ${r.message} — ${featureOf(r.route).name} (تكرر ${r.count})`);
    });
    L.push('');
  }

  const block = (r) => {
    const s = analyze(r);
    const feature = featureOf(r.route);
    L.push(`### [${STATUS_AR[r.status] || r.status}] ${r.message}`, '',
      '**الموقع والوقت**', '',
      `- المعرّف (البصمة): ${r.id}`, `- النوع: ${KIND_AR[r.kind] || r.kind}`,
      `- الميزة: ${feature.name} — الفئة المتأثرة: ${feature.audience}`,
      `- المسار: ${r.route}`, `- الملف: ${r.source || 'غير معروف'}${r.line ? `:${r.line}` : ''}`,
      `- أول ظهور: ${fmt(r.firstAt)} — آخر ظهور: ${fmt(r.lastAt)} — عدد المرات: ${r.count}`, '',
      '**الخطورة والأولوية**', '',
      `- الخطورة: ${SEV_AR[severityOf(r)]} — الأولوية: ${priorityLabel(priorityOf(r))}`,
      `- النسخة: ${r.release || '—'} (آخر نسخة ظهر فيها: ${r.lastRelease || '—'}) — عاد بعد الإغلاق: ${r.reopenCount || 0}`, '',
      '**الأثر على المنصة وتجربة المستخدم**', '',
      impactText(r), '',
      '**السبب المحتمل**', '',
      r.cause || s.cause, '',
      '**الحل المقترح**', '',
      r.solution || s.solution, '',
      '**إجراءات منع التكرار**', '',
      r.prevention || s.prevention, '');
    const tl = timeline(r);
    if (tl.length) { L.push('**السجل الزمني**', ''); tl.forEach((x) => L.push(`- ${fmt(x.t)}: ${x.text}`)); L.push(''); }
    if (r.ownerNote) L.push(`**ملاحظة المالك:** ${r.ownerNote}`, '');
    if (r.stack) L.push('**أثر المكدس**', '', '```', r.stack, '```', '');
  };

  L.push('## الأخطاء المفتوحة', ''); open.forEach(block);
  L.push('## يُرجَّح إصلاحها (تحتاج تأكيد المالك)', ''); likely.forEach(block);
  L.push('## تم إصلاحها', ''); done.slice(0, 30).forEach(block);
  L.push('## تعليقات الصفحات', '');
  if (!S.notes.length) L.push('لا توجد.', '');
  S.notes.forEach((n) => L.push(`- (${n.route}) ${fmt(n.createdAt)} ${n.done ? '[مغلق]' : '[مفتوح]'}: ${n.text}${n.solution ? ` | الحل: ${n.solution}` : ''}`));
  const run = S.runs[0];
  L.push('', '## آخر مراجعة كود', '');
  if (!run) L.push('لم تُرفع مراجعة بعد.');
  else {
    L.push(`التاريخ: ${run.generatedAtIso} / commit: ${run.commit || '—'}`, '');
    (run.findings || []).filter((f) => f.sev === 'high' || f.sev === 'medium').slice(0, 80).forEach((f) => {
      L.push(`- [${REVIEW_SEV_AR[f.sev]}] ${f.file}:${f.line} (${f.title}) ${f.snippet}`, `  - الأثر: ${f.impact}`, `  - الحل: ${f.fix}`);
    });
  }
  return L.join('\n');
}

export async function mountOwnerConsole(host, { release = String(import.meta.env?.VITE_RELEASE || '') } = {}) {
  injectStyle();
  host.dir = 'rtl';
  host.classList.add('oc');
  host.replaceChildren(h('p', { class: 'oc-muted' }, 'جارٍ التحقق من الصلاحية…'));
  if (!(await isOwnerUser())) {
    host.replaceChildren(h('div', { class: 'oc-empty' }, h('b', {}, 'هذه الصفحة خاصة بمالك المنصة'), 'مركز التشخيص والأخطاء متاح للمالك فقط. إن كنت مديرًا وتحتاج صلاحية المالك، تواصل معه.'));
    return;
  }
  const app = getFirebaseApp();
  const db = getFirestore(app);
  const uid = getAuth(app).currentUser.uid;
  const S = { tab: 'errors', filter: 'open', sev: 'all', q: '', sel: null, reports: [], notes: [], runs: [], msg: '' };

  const say = (m) => { S.msg = m; render(); };

  async function load() {
    const get = async (name, field, n) => {
      try {
        const snap = await getDocs(query(collection(db, name), orderBy(field, 'desc'), limit(n)));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) {
        S.msg = `تعذر تحميل ${name}: ${e.code || e.message}`;
        return [];
      }
    };
    [S.reports, S.notes, S.runs] = await Promise.all([get('errorReports', 'lastAt', 200), get('errorNotes', 'createdAt', 200), get('reviewRuns', 'createdAt', 10)]);
  }

  async function reload(withSweep = false) {
    await load();
    if (withSweep) {
      const n = await sweep(db, S.reports, release);
      if (n) S.msg = `تحديث تلقائي: تغيّرت حالة ${n} سجلًا وفق قواعد الإغلاق التلقائي.`;
    }
    render();
  }

  const btn = (label, fn, cls = '') => h('button', { type: 'button', class: cls, onclick: fn }, label);
  const sevTag = (sev) => h('span', { class: `oc-sev ${sev}` }, `خطورة ${SEV_AR[sev]}`);

  function visibleReports() {
    const q = S.q.trim().toLowerCase();
    return S.reports
      .filter((r) => S.filter === 'all' || r.status === S.filter)
      .filter((r) => S.sev === 'all' || severityOf(r) === S.sev)
      .filter((r) => !q || [r.message, r.route, r.source, r.kind].some((x) => String(x || '').toLowerCase().includes(q)))
      .sort((a, b) => priorityOf(b) - priorityOf(a));
  }

  function viewErrors() {
    const list = visibleReports();
    const r = S.reports.find((x) => x.id === S.sel);
    const chips = ['open', 'likely_fixed', 'resolved', 'all'].map((f) =>
      h('button', { type: 'button', 'aria-pressed': S.filter === f ? 'true' : 'false', onclick: () => { S.filter = f; S.sel = null; render(); } }, f === 'all' ? 'كل الحالات' : STATUS_AR[f]));
    const sevChips = ['all', 'critical', 'high', 'medium', 'low'].map((f) =>
      h('button', { type: 'button', 'aria-pressed': S.sev === f ? 'true' : 'false', onclick: () => { S.sev = f; S.sel = null; render(); } }, f === 'all' ? 'كل الخطورات' : SEV_AR[f]));
    const search = h('input', { type: 'search', placeholder: 'ابحث في نص الخطأ أو المسار أو الملف…', value: S.q, 'aria-label': 'بحث في الأخطاء' });
    search.addEventListener('input', () => { S.q = search.value; S.sel = null; render(); const el = document.querySelector('.oc input[type=search]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
    const items = list.length
      ? list.map((x) => h('button', { type: 'button', class: 'oc-item', 'aria-current': x.id === S.sel ? 'true' : 'false', onclick: () => { S.sel = x.id; render(); } },
        h('span', { class: `oc-dot ${severityOf(x)}`, 'aria-hidden': 'true' }),
        h('span', {},
          h('b', {}, x.message.slice(0, 90)),
          h('span', { class: `oc-tag ${x.status}` }, STATUS_AR[x.status]),
          sevTag(severityOf(x)),
          (x.reopenCount || 0) > 0 ? h('span', { class: 'oc-tag open' }, `عاد ${x.reopenCount}×`) : null,
          h('small', {}, `${featureOf(x.route).name} — تكرر ${x.count} — آخر ظهور ${fmt(x.lastAt)}`))))
      : [h('div', { class: 'oc-empty' },
          h('b', {}, S.filter === 'open' ? 'لا توجد أخطاء مفتوحة' : 'لا توجد نتائج مطابقة'),
          S.filter === 'open' && !S.q ? 'سجل الأخطاء نظيف وفق هذا الفلتر. عمل ممتاز.' : 'جرّب تعديل الفلتر أو كلمة البحث.')];
    return h('div', { class: 'oc-grid' },
      h('div', {}, h('div', { class: 'oc-row' }, chips), h('div', { class: 'oc-row' }, sevChips), search, h('div', { class: 'oc-list', style: 'margin-top:8px' }, items)),
      r ? detail(r) : h('div', { class: 'oc-panel' }, h('div', { class: 'oc-empty' }, h('b', {}, 'اختر خطأً من القائمة'), 'ستظهر هنا التفاصيل الكاملة: الموقع، الخطورة، السبب المحتمل، الحل المقترح، والسجل الزمني.')));
  }

  function detailSection(title, ...kids) {
    return h('div', { class: 'oc-section' }, h('h4', {}, title), ...kids);
  }

  function detail(r) {
    const s = analyze(r);
    const feature = featureOf(r.route);
    const sev = severityOf(r);
    const score = priorityOf(r);
    const sol = h('textarea', { id: 'oc-sol', value: r.solution || s.solution, maxlength: '2000' });
    const prev = h('textarea', { id: 'oc-prev', value: r.prevention || s.prevention, maxlength: '2000' });
    const note = h('textarea', { id: 'oc-note', value: r.ownerNote || '', maxlength: '2000', placeholder: 'ملاحظة خاصة بك تظهر في التقرير المصدَّر' });
    const related = S.notes.filter((n) => n.route && r.route && (r.route === n.route || r.route.startsWith(n.route) || n.route.startsWith(r.route)));
    const save = async (extra = {}, text = 'تم الحفظ') => {
      const patch = { solution: sol.value.trim().slice(0, 2000), prevention: prev.value.trim().slice(0, 2000), ownerNote: note.value.trim().slice(0, 2000), ...extra };
      try {
        await updateDoc(doc(db, 'errorReports', r.id), patch);
        Object.assign(r, patch, patch.resolvedAt ? { resolvedAt: fakeTs(Date.now()) } : {});
        say(text);
      } catch (e) { say(`تعذر الحفظ: ${e.code || e.message}`); }
    };
    return h('div', { class: 'oc-panel' },
      h('h3', {}, r.message, h('span', { class: `oc-tag ${r.status}` }, STATUS_AR[r.status])),
      detailSection('الموقع والوقت',
        h('dl', { class: 'oc-kv' },
          h('dt', {}, 'الميزة'), h('dd', {}, `${feature.name} — الفئة المتأثرة: ${feature.audience}`),
          h('dt', {}, 'المسار'), h('dd', {}, r.route || '—'),
          h('dt', {}, 'الملف'), h('dd', {}, `${r.source || 'غير معروف'}${r.line ? ` (سطر ${r.line})` : ''}`),
          h('dt', {}, 'النوع'), h('dd', {}, KIND_AR[r.kind] || r.kind),
          h('dt', {}, 'أول ظهور'), h('dd', {}, fmt(r.firstAt)),
          h('dt', {}, 'آخر ظهور'), h('dd', {}, fmt(r.lastAt)),
          h('dt', {}, 'التكرار'), h('dd', {}, `${r.count} ${r.count > 2 ? 'مرات' : 'مرة'}`))),
      detailSection('الخطورة والأولوية',
        h('p', {}, sevTag(sev), h('span', { class: 'oc-tag' }, `أولوية ${priorityLabel(score)} (${score})`)),
        h('p', { class: 'oc-muted' }, `النسخة: ${r.release || '—'} | آخر نسخة ظهر فيها: ${r.lastRelease || '—'}${r.autoResolved ? ' | أُغلق تلقائيًا سابقًا' : ''}${(r.reopenCount || 0) > 0 ? ` | عاد بعد الإغلاق ${r.reopenCount}×` : ''}`)),
      detailSection('الأثر على المنصة وتجربة المستخدم', h('p', {}, impactText(r))),
      detailSection('السبب المحتمل', h('p', {}, r.cause || s.cause)),
      detailSection('الحل المقترح (قابل للتعديل)', h('label', { for: 'oc-sol' }, 'الحل'), sol),
      detailSection('إجراءات منع التكرار (قابلة للتعديل)', h('label', { for: 'oc-prev' }, 'المنع'), prev),
      detailSection('ملاحظات المالك', h('label', { for: 'oc-note' }, 'ملاحظة'), note),
      related.length ? detailSection('ملاحظات سابقة على الصفحة نفسها',
        h('ul', { class: 'oc-timeline' }, related.slice(0, 5).map((n) => h('li', {}, `${n.done ? '[مغلق] ' : ''}${n.text}${n.solution ? ` — الحل: ${n.solution}` : ''}`, h('time', {}, fmt(n.createdAt)))))) : null,
      detailSection('السجل الزمني',
        h('ul', { class: 'oc-timeline' }, timeline(r).map((x) => h('li', {}, x.text, h('time', {}, fmt(x.t)))))),
      r.stack ? detailSection('أثر المكدس (تقني)', h('pre', {}, r.stack)) : null,
      h('div', { class: 'oc-row' },
        btn('حفظ', () => save()),
        btn('تأكيد الإصلاح', async () => { await save({ status: 'resolved', resolvedAt: serverTimestamp(), resolvedBy: uid, autoResolved: false }, 'سُجّل كمُصلَح. إن عاد سيُفتح تلقائيًا.'); render(); }, 'oc-primary'),
        btn('إعادة الفتح', async () => { await save({ status: 'open', autoResolved: false }, 'أُعيد فتحه'); render(); }),
        btn('حذف السجل', async () => {
          if (!confirm('حذف هذا السجل نهائيًا؟ لا يمكن التراجع.')) return;
          try { await deleteDoc(doc(db, 'errorReports', r.id)); S.reports = S.reports.filter((x) => x.id !== r.id); S.sel = null; say('تم الحذف'); } catch (e) { say(`تعذر الحذف: ${e.code || e.message}`); }
        })));
  }

  function viewNotes() {
    const route = h('input', { type: 'text', id: 'oc-nr', placeholder: '/admin أو /subjects', maxlength: '120', dir: 'ltr' });
    const text = h('textarea', { id: 'oc-nt', maxlength: '2000' });
    const add = async () => {
      const t = text.value.trim();
      if (!t) return;
      try {
        await addDoc(collection(db, 'errorNotes'), { route: route.value.trim().slice(0, 120) || '/', text: t.slice(0, 2000), solution: '', done: false, createdAt: serverTimestamp(), createdBy: uid });
        await reload();
        say('أُضيف التعليق');
      } catch (e) { say(`تعذر: ${e.code || e.message}`); }
    };
    const rows = S.notes.map((n) => {
      const sol = h('input', { type: 'text', value: n.solution || '', placeholder: 'الحل', 'aria-label': 'الحل' });
      const done = h('input', { type: 'checkbox', 'aria-label': 'مغلق' });
      done.checked = !!n.done;
      return h('div', { class: 'oc-panel' },
        h('p', {}, h('strong', {}, n.route), `  ${fmt(n.createdAt)}`), h('p', {}, n.text), sol,
        h('div', { class: 'oc-row' }, h('label', {}, done, ' مغلق'),
          btn('حفظ', async () => { try { await updateDoc(doc(db, 'errorNotes', n.id), { route: n.route, text: n.text, solution: sol.value.trim().slice(0, 2000), done: done.checked, createdAt: n.createdAt, createdBy: n.createdBy, updatedAt: serverTimestamp() }); n.solution = sol.value.trim(); n.done = done.checked; say('تم الحفظ'); } catch (e) { say(`تعذر: ${e.code || e.message}`); } }),
          btn('حذف', async () => { try { await deleteDoc(doc(db, 'errorNotes', n.id)); S.notes = S.notes.filter((x) => x.id !== n.id); say('تم الحذف'); } catch (e) { say(`تعذر: ${e.code || e.message}`); } })));
    });
    return h('div', {}, h('div', { class: 'oc-panel' }, h('h3', {}, 'تعليق على صفحة'),
      h('p', { class: 'oc-muted' }, 'التعليقات المرتبطة بمسار صفحة تظهر تلقائيًا في تفاصيل أي خطأ على الصفحة نفسها، فتتراكم المعرفة مع الوقت.'),
      h('label', { for: 'oc-nr' }, 'الصفحة'), route, h('label', { for: 'oc-nt' }, 'التعليق'), text, h('div', { class: 'oc-row' }, btn('إضافة', add, 'oc-primary'))),
    h('div', { class: 'oc-list' }, rows.length ? rows : [h('div', { class: 'oc-empty' }, h('b', {}, 'لا توجد تعليقات بعد'), 'دوّن هنا ما تتعلمه عن صفحات المنصة: أعطال متكررة، حلول مجربة، قرارات تصميم.')]));
  }

  function viewReviews() {
    const file = h('input', { type: 'file', accept: 'application/json', id: 'oc-file', 'aria-label': 'ملف المراجعة' });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        if (j.schema !== 'tanagha-review/1' || !Array.isArray(j.findings)) throw new Error('ملف مراجعة غير صالح');
        const rank = { high: 0, medium: 1, low: 2, info: 3 };
        const findings = j.findings.slice().sort((a, b) => rank[a.sev] - rank[b.sev]).slice(0, 400)
          .map((x) => ({ sev: x.sev, file: x.file, line: x.line, title: x.title, snippet: String(x.snippet).slice(0, 160), impact: x.impact, fix: x.fix, prevent: x.prevent, status: x.status }));
        await addDoc(collection(db, 'reviewRuns'), { schema: j.schema, generatedAtIso: String(j.generatedAt).slice(0, 40), commit: String(j.commit || '').slice(0, 40), summary: j.summary, findings, createdAt: serverTimestamp(), createdBy: uid });
        await reload();
        say('رُفعت المراجعة');
      } catch (e) { say(`تعذر الرفع: ${e.message}`); }
    });
    const rows = S.runs.map((run) => h('div', { class: 'oc-panel' },
      h('p', {}, h('strong', {}, run.generatedAtIso), `  commit ${run.commit || '—'}`),
      h('p', { class: 'oc-muted' }, `عالية ${run.summary?.bySeverity?.high ?? 0}، متوسطة ${run.summary?.bySeverity?.medium ?? 0}، منخفضة ${run.summary?.bySeverity?.low ?? 0}. جديدة ${run.summary?.new ?? 0}، أُصلحت ${run.summary?.fixed ?? 0}`),
      btn('تنزيل النتائج (JSON)', () => download(`review-${run.generatedAtIso.slice(0, 10)}.json`, JSON.stringify(run, null, 2), 'application/json'))));
    return h('div', {}, h('div', { class: 'oc-panel' }, h('h3', {}, 'رفع نتيجة مراجعة الكود'),
      h('p', { class: 'oc-muted' }, 'نزّل ملف review-latest.json من نتيجة GitHub Actions (سير عمل code-review) وارفعه هنا ليُضمَّن في التقرير.'), file),
    h('div', { class: 'oc-list' }, rows.length ? rows : [h('div', { class: 'oc-empty' }, h('b', {}, 'لم تُرفع مراجعة بعد'), 'تعمل مراجعة الكود تلقائيًا كل أحد، وعند كل دمج إلى main.')]));
  }

  function render() {
    const c = { open: 0, likely_fixed: 0, resolved: 0 };
    S.reports.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    const notes = insights(S.reports, release);
    const tab = (id, label) => h('button', { type: 'button', role: 'tab', 'aria-selected': S.tab === id ? 'true' : 'false', onclick: () => { S.tab = id; S.msg = ''; render(); } }, label);
    host.replaceChildren(
      h('header', {}, h('h2', {}, 'مركز التشخيص والأخطاء'),
        h('p', { class: 'oc-muted' }, `خاص بالمالك — نسخة المنصة: ${release || 'غير محددة'}`),
        h('div', { class: 'oc-kpis' },
          h('div', { class: 'oc-kpi' }, h('strong', {}, String(c.open)), h('span', {}, 'أخطاء مفتوحة')),
          h('div', { class: 'oc-kpi' }, h('strong', {}, String(c.likely_fixed)), h('span', {}, 'يُرجَّح إصلاحها')),
          h('div', { class: 'oc-kpi' }, h('strong', {}, String(c.resolved)), h('span', {}, 'تم إصلاحها')),
          h('div', { class: 'oc-kpi' }, h('strong', {}, String(S.notes.length)), h('span', {}, 'تعليقات صفحات')),
          h('div', { class: 'oc-kpi' }, h('strong', {}, String(S.runs.length)), h('span', {}, 'مراجعات كود'))),
        notes.length ? h('div', { class: 'oc-insights' }, notes.map((t) => h('div', { class: 'oc-insight' }, t))) : null,
        h('div', { class: 'oc-row' },
          btn('تنزيل تقرير للذكاء الاصطناعي (.md)', () => download(`errors-report-${today()}.md`, buildMarkdown(S, release), 'text/markdown'), 'oc-primary'),
          btn('تنزيل JSON', () => download(`errors-report-${today()}.json`, JSON.stringify({ schema: 'tanagha-errors/1', generatedAt: new Date().toISOString(), release, reports: S.reports.map(({ stack, ...r }) => ({ ...r, stack, firstAt: fmt(r.firstAt), lastAt: fmt(r.lastAt), resolvedAt: fmt(r.resolvedAt) })), notes: S.notes.map((n) => ({ ...n, createdAt: fmt(n.createdAt) })) }, null, 2), 'application/json')),
          btn('تحديث', () => reload(true)))),
      S.msg ? h('p', { class: 'oc-msg', role: 'status' }, S.msg) : null,
      h('nav', { class: 'oc-tabs', role: 'tablist' }, tab('errors', 'الأخطاء'), tab('notes', 'تعليقات الصفحات'), tab('reviews', 'مراجعة الكود')),
      S.tab === 'errors' ? viewErrors() : S.tab === 'notes' ? viewNotes() : viewReviews());
  }

  await reload(true);
}
