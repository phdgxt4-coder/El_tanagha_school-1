#!/usr/bin/env node
// مراجعة كود المنصة: 30 مرورًا كاملًا، كل مرور يقرأ كل الملفات سطرًا سطرًا.
// فحص ثابت (بدون ذكاء اصطناعي ولا إنترنت): قواعد محددة، سريعة، وتتكرر بنفس النتيجة.
// الناتج: reports/code-review/review-latest.{json,md} + ledger.json لتتبع الجديد والمتصلّح.
// الاستخدام: node scripts/code-review.mjs [--fail-on-high]
// لتجاهل سطر بعينه عن قصد: اكتب في نفس السطر  review-ignore
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const OUT = join(ROOT, 'reports', 'code-review');
const FAIL_ON_HIGH = process.argv.includes('--fail-on-high');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'archive', 'reports', 'coverage', '.firebase', '.vite']);
const EXTS = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.rules']);
const SELF = 'scripts/code-review.mjs';

// ---------- تحميل الملفات ----------
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (!SKIP_DIRS.has(name)) walk(p); continue; }
    const rel = relative(ROOT, p).split('\\').join('/');
    if (!EXTS.has(extname(name)) || st.size > 1_000_000 || /\.min\./.test(name) || rel === SELF) continue;
    const text = readFileSync(p, 'utf8');
    files.push({
      path: rel, ext: extname(name), text, lines: text.split('\n'),
      isTest: /(^|\/)(tests?|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel),
      isScript: rel.startsWith('scripts/'),
    });
  }
}(ROOT));

const rulesFile = files.find((f) => f.path === 'firestore.rules');
const ruleCollections = new Set();
if (rulesFile) for (const m of rulesFile.text.matchAll(/match\s+\/(\w+)\/\{/g)) ruleCollections.add(m[1]);
const testsText = files.filter((f) => f.isTest).map((f) => f.text).join('\n');

// ---------- مساعدات ----------
const isJs = (f) => ['.js', '.mjs', '.cjs'].includes(f.ext);
const appJs = (f) => isJs(f) && !f.isTest && !f.isScript;
const srcJs = (f) => appJs(f) && f.path.startsWith('src/');
const isComment = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);
const win = (f, i, before, after = 0) => f.lines.slice(Math.max(0, i - before), i + after + 1).join('\n');
const LOOP = /\b(for\s*\(|for\s+(?:const|let)\b|forEach\(|\.map\(|while\s*\()/;

// كل مرور: { id, title, sev, impact, fix, prevent, applies(f), line(l,i,f) | file(f) }
// line/file يرجع false أو true أو { sev, note }.
const P = [
  { id: 'P01', title: 'استخدام eval أو new Function', sev: 'high', applies: appJs,
    line: (l) => !isComment(l) && /\b(eval\s*\(|new Function\s*\()/.test(l),
    impact: 'ينفّذ نصوصًا كأكواد: ثغرة تنفيذ كود لو دخله أي مُدخل من مستخدم.', fix: 'استبدله بدالة عادية أو JSON.parse.', prevent: 'امنعه في ESLint (no-eval, no-new-func).' },
  { id: 'P02', title: 'innerHTML مع نص متغيّر (XSS)', sev: 'high', applies: appJs,
    line: (l) => !isComment(l) && /\.(innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML\(/.test(l) && (/\$\{|['"`]\s*\+|\+\s*['"`\w]/.test(l)),
    impact: 'لو المتغيّر فيه اسم طالب أو رسالة محادثة فيها HTML، يتنفذ عند باقي المستخدمين.', fix: 'استخدم textContent أو أنشئ العناصر بـ createElement، أو نظّف النص بدالة escape.', prevent: 'اعتمد دالة واحدة آمنة لبناء الواجهة وامنع innerHTML بمتغيرات.' },
  { id: 'P03', title: 'document.write', sev: 'medium', applies: appJs,
    line: (l) => !isComment(l) && /document\.write(ln)?\(/.test(l),
    impact: 'يبطّئ التحميل ويفتح باب حقن.', fix: 'استخدم DOM APIs.', prevent: 'امنعه في ESLint.' },
  { id: 'P04', title: 'سر أو مفتاح خاص داخل الكود', sev: 'high', applies: (f) => !f.isTest,
    line: (l) => !isComment(l) && !/example|placeholder|your[_-]/i.test(l) && /-----BEGIN [A-Z ]*PRIVATE KEY-----|"private_key"|(password|secret|api_?key|token)\s*[:=]\s*['"][^'"\s]{12,}['"]/i.test(l),
    impact: 'تسريب مفتاح خاص يعني أخذ صلاحيات على Firebase كلها. (مفاتيح Firebase Web نفسها عامة بطبيعتها.)', fix: 'ارجع المفتاح فورًا من Console وانقله لمتغيرات GitHub Secrets.', prevent: 'فعّل Secret Scanning في GitHub.' },
  { id: 'P05', title: 'target=_blank بدون rel=noopener', sev: 'medium', applies: (f) => appJs(f) || f.ext === '.html',
    line: (l, i, f) => /target\s*=\s*["']_blank["']/.test(l) && !/noopener/.test(win(f, i, 1, 2)),
    impact: 'الصفحة المفتوحة تقدر تتحكم في صفحتك الأصلية.', fix: 'أضف rel="noopener noreferrer".', prevent: 'استخدم دالة واحدة لبناء الروابط الخارجية (مثل src/utils/links.js).' },
  { id: 'P06', title: 'رابط http غير آمن أو javascript:', sev: 'medium', applies: (f) => appJs(f) || f.ext === '.html',
    line: (l) => !isComment(l) && (/['"`]http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)/.test(l) || /['"`]javascript:/.test(l)),
    impact: 'تحذيرات محتوى مختلط على HTTPS أو تنفيذ كود من رابط.', fix: 'استخدم https:// وامنع javascript:.', prevent: 'تحقق من الروابط بدالة allow-list.' },
  { id: 'P07', title: 'تخزين سر في localStorage/sessionStorage', sev: 'high', applies: appJs,
    line: (l) => /(localStorage|sessionStorage)\.setItem\([^)]*(token|password|pass|secret)/i.test(l),
    impact: 'أي حقن JavaScript يسرق الجلسة.', fix: 'اعتمد على Firebase Auth persistence ولا تخزّن الأسرار.', prevent: 'مراجعة أي setItem جديد.' },
  { id: 'P08', title: 'postMessage بوجهة *', sev: 'medium', applies: appJs,
    line: (l) => /postMessage\([^)]*['"]\*['"]/.test(l),
    impact: 'أي موقع يستقبل الرسالة.', fix: 'حدّد origin صريح.', prevent: 'مراجعة.' },
  { id: 'P09', title: 'getDocs بدون limit', sev: 'medium', applies: srcJs,
    line: (l, i, f) => !isComment(l) && /\bgetDocs\(/.test(l) && !/limit\(|startAfter\(/.test(win(f, i, 12, 1)),
    impact: 'قراءة كل المستندات في كل فتح للصفحة تستهلك حصة Spark (50 ألف قراءة يوميًا) وتبطّئ الموبايل.', fix: 'أضف limit(n) وpagination بـ startAfter.', prevent: 'قاعدة فريق: لا استعلام بدون limit.' },
  { id: 'P10', title: 'onSnapshot بدون حفظ دالة الإلغاء', sev: 'medium', applies: srcJs,
    line: (l) => /^\s*(await\s+)?onSnapshot\(/.test(l),
    impact: 'المستمع يفضل شغال بعد مغادرة الصفحة: قراءات زيادة وتسريب ذاكرة.', fix: 'خزّن الناتج في متغير وسجّله في src/ui/cleanups.js.', prevent: 'لف onSnapshot في دالة مساعدة بتسجل الإلغاء تلقائيًا.' },
  { id: 'P11', title: 'كتابة Firestore داخل حلقة', sev: 'medium', applies: srcJs,
    line: (l, i, f) => /\b(setDoc|updateDoc|addDoc|deleteDoc)\(/.test(l) && LOOP.test(win(f, i, 4)) && !/writeBatch|runTransaction/.test(win(f, i, 12)),
    impact: 'كتابات كتير منفصلة: بطء وتخطي حصة الكتابة اليومية (20 ألف) وفشل جزئي.', fix: 'استخدم writeBatch (حتى 500 عملية).', prevent: 'دالة مساعدة للدفعات.' },
  { id: 'P12', title: 'قراءة Firestore داخل حلقة (N+1)', sev: 'medium', applies: srcJs,
    line: (l, i, f) => /\b(getDoc|getDocs)\(/.test(l) && LOOP.test(win(f, i, 4)),
    impact: 'عدد القراءات يكبر مع عدد العناصر.', fix: 'اقرأ بالـ where in (حتى 30 قيمة) أو خزّن النتيجة في cache.', prevent: 'مراجعة أي getDoc داخل map.' },
  { id: 'P13', title: 'توقيت من جهاز المستخدم بدل serverTimestamp', sev: 'high', applies: srcJs,
    line: (l) => !isComment(l) && /\b(createdAt|updatedAt|submittedAt|lastAt|usedAt|consentAt|firstAt)\s*:\s*(new Date\(|Date\.now\(|Timestamp\.now\()/.test(l),
    impact: 'قواعدك تشترط createdAt == request.time في أغلب المجموعات، فالكتابة ترفض بـ permission-denied.', fix: 'استخدم serverTimestamp().', prevent: 'اختبار قواعد لكل عملية كتابة.' },
  { id: 'P14', title: 'مجموعة مستخدمة في الكود وغير معرّفة في القواعد', sev: 'high', applies: srcJs,
    line: (l) => {
      if (isComment(l) || !rulesFile) return false;
      for (const m of l.matchAll(/\b(?:collection|collectionGroup|doc)\(\s*\w+\s*,\s*['"`]([A-Za-z_]+)['"`]/g)) if (!ruleCollections.has(m[1])) return { note: `المجموعة ${m[1]}` };
      return false;
    },
    impact: 'القواعد تمنع أي مجموعة غير مذكورة، فالعملية دي هترفض دايمًا.', fix: 'أضف match للمجموعة في firestore.rules أو صحّح الاسم.', prevent: 'اختبار يقارن أسماء المجموعات في الكود بالقواعد.' },
  { id: 'P15', title: 'قاعدة مفتوحة (allow if true)', sev: 'high', applies: (f) => f.ext === '.rules',
    line: (l) => {
      if (isComment(l)) return false;
      if (/allow\s+[a-z, ]*(create|update|delete|write)[^:]*:\s*if\s+true/.test(l)) return true;
      if (/allow\s+[a-z, ]*(get|list|read)[^:]*:\s*if\s+true/.test(l)) return { sev: 'low', note: 'قراءة عامة، تأكد إنها مقصودة' };
      return false;
    },
    impact: 'كتابة مفتوحة تعني أي شخص يغيّر بياناتك. القراءة العامة تعني إن كل الناس تشوف المستند.', fix: 'قيّدها بالدور أو بالحقول.', prevent: 'اختبار قواعد لكل مجموعة.' },
  { id: 'P16', title: 'create في القواعد بدون تحديد الحقول (hasOnly)', sev: 'medium', applies: (f) => f.ext === '.rules',
    line: (l, i, f) => {
      if (!/allow\s+[a-z, ]*create/.test(l)) return false;
      let j = i; const seg = [l];
      while (++j < f.lines.length && j < i + 30 && !/allow\s|^\s*match\s/.test(f.lines[j])) seg.push(f.lines[j]);
      return !/hasOnly\(|if\s+false|validContent|validSelfProfile|validTeacherNotification|validCodeLink|validChatText/.test(seg.join('\n'));
    },
    impact: 'المستخدم يقدر يضيف حقول زيادة أو بأحجام كبيرة (استهلاك مساحة).', fix: 'أضف keys().hasOnly([...]) وحدود الأحجام.', prevent: 'قالب موحد لقواعد الإنشاء.' },
  { id: 'P17', title: 'نص في القواعد بدون حد للحجم', sev: 'low', applies: (f) => f.ext === '.rules',
    line: (l, i, f) => /\bis string\b/.test(l) && !/size\(\)|matches\(/.test(win(f, i, 0, 1)),
    impact: 'نص طويل جدًا يمكن كتابته.', fix: 'أضف .size() <= حد.', prevent: 'قالب موحد.' },
  { id: 'P18', title: 'catch فارغ', sev: 'medium', applies: appJs,
    line: (l) => /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(l),
    impact: 'الأخطاء بتختفي وما حدش يعرف إن حاجة وقعت.', fix: 'سجّل الخطأ عبر reportError أو اكتب تعليقًا يشرح لماذا يُتجاهل.', prevent: 'امنع catch الفارغ في ESLint (no-empty).' },
  { id: 'P19', title: 'دالة async داخل forEach', sev: 'medium', applies: appJs,
    line: (l) => /\.forEach\(\s*async\b/.test(l),
    impact: 'forEach لا ينتظر الـ await، فالأخطاء والترتيب بيضيعوا.', fix: 'استخدم for...of أو Promise.all.', prevent: 'ESLint no-await-in-loop أو قاعدة مماثلة.' },
  { id: 'P20', title: 'Promise بدون معالجة خطأ', sev: 'low', applies: srcJs,
    line: (l, i, f) => /\.then\(/.test(l) && !/\bawait\b|\breturn\b/.test(l) && !/\.catch\(|\.finally\(/.test(win(f, i, 0, 5)),
    impact: 'رفض Promise غير معالج (unhandledrejection).', fix: 'أضف .catch أو استخدم try/await.', prevent: 'ESLint promise/catch-or-return.' },
  { id: 'P21', title: 'addEventListener بدون إزالة', sev: 'low', applies: srcJs,
    file: (f) => {
      const adds = f.lines.map((l, i) => (/\.addEventListener\(/.test(l) && !isComment(l) ? i : -1)).filter((i) => i >= 0);
      if (!adds.length || /removeEventListener|AbortController|signal\s*:|cleanups/.test(f.text)) return [];
      return [{ line: adds[0] + 1, snippet: f.lines[adds[0]], note: `${adds.length} مستمع` }];
    },
    impact: 'تراكم مستمعين مع كل تنقل بين الصفحات.', fix: 'سجّل الإزالة في cleanups.js أو استخدم AbortController.', prevent: 'دالة مساعدة للمستمعين.' },
  { id: 'P22', title: 'setInterval بدون clearInterval', sev: 'low', applies: srcJs,
    file: (f) => {
      const i = f.lines.findIndex((l) => /setInterval\(/.test(l) && !isComment(l));
      return i >= 0 && !/clearInterval|cleanups/.test(f.text) ? [{ line: i + 1, snippet: f.lines[i] }] : [];
    },
    impact: 'مؤقت يفضل شغال ويستهلك بطارية الموبايل.', fix: 'احفظ المعرّف وامسحه عند مغادرة الصفحة.', prevent: 'تسجيل المؤقتات في cleanups.' },
  { id: 'P23', title: 'console.log متروك', sev: 'low', applies: (f) => srcJs(f) && !/logger\.js$/.test(f.path),
    line: (l) => !isComment(l) && /\bconsole\.(log|debug)\(/.test(l),
    impact: 'ضوضاء وقد يكشف بيانات.', fix: 'احذفه أو استخدم logger.', prevent: 'ESLint no-console.' },
  { id: 'P24', title: 'TODO / FIXME / HACK', sev: 'info', applies: (f) => f.ext !== '.rules' || true,
    line: (l) => /(\/\/|\/\*|\*|#)\s*(TODO|FIXME|HACK|XXX)\b/.test(l),
    impact: 'عمل ناقص معروف.', fix: 'حوّله لـ issue أو أنهِه.', prevent: 'مراجعة دورية.' },
  { id: 'P25', title: 'debugger متروك', sev: 'medium', applies: appJs,
    line: (l) => /^\s*debugger\b/.test(l),
    impact: 'يوقف التنفيذ لمن يفتح أدوات المطور.', fix: 'احذفه.', prevent: 'ESLint no-debugger.' },
  { id: 'P26', title: 'خصائص CSS فيزيائية (يمين/شمال) في واجهة RTL', sev: 'low', applies: (f) => f.ext === '.css',
    line: (l) => !isComment(l) && /(margin|padding)-(left|right)\s*:|text-align\s*:\s*(left|right)|float\s*:\s*(left|right)|border-(left|right)\s*:/.test(l),
    impact: 'ممكن الاتجاه ينعكس غلط لو استُخدمت الصفحة بالاتجاه المعاكس.', fix: 'استخدم margin-inline-start/end وpadding-inline وtext-align: start.', prevent: 'استخدم الخصائص المنطقية دائمًا.' },
  { id: 'P27', title: 'صورة بدون alt', sev: 'medium', applies: (f) => appJs(f) || f.ext === '.html',
    line: (l, i, f) => /<img\b/.test(l) && !/\balt\s*=/.test(win(f, i, 0, 3)),
    impact: 'قارئات الشاشة لا تقدر تصف الصورة، وSEO أضعف.', fix: 'أضف alt مناسب أو alt="" للزخرفة.', prevent: 'دالة موحدة لبناء الصور.' },
  { id: 'P28', title: 'معالج حدث داخل HTML (onclick=)', sev: 'medium', applies: (f) => appJs(f) || f.ext === '.html',
    line: (l) => /\son(click|change|submit|input|load|error)\s*=\s*["']/.test(l),
    impact: 'يمنع تفعيل Content-Security-Policy صارمة ويسهّل XSS.', fix: 'استخدم addEventListener.', prevent: 'ESLint/HTML lint.' },
  { id: 'P29', title: 'ملف كبير جدًا (أكثر من 900 سطر)', sev: 'low', applies: srcJs,
    file: (f) => (f.lines.length > 900 ? [{ line: 1, snippet: `${f.lines.length} سطر` }] : []),
    impact: 'صعب الفهم والاختبار، ويرفع احتمال الأخطاء عند التعديل.', fix: 'قسّمه لوحدات.', prevent: 'حد أقصى للحجم في المراجعة.' },
  { id: 'P30', title: 'وحدة بدون أي ذكر في الاختبارات', sev: 'info', applies: (f) => srcJs(f) && !f.path.startsWith('src/studycrew/') && !/(index|manifest|registry)\.js$/.test(f.path),
    file: (f) => (testsText.includes(basename(f.path, '.js')) ? [] : [{ line: 1, snippet: f.path }]),
    impact: 'أي تعديل فيها بلا شبكة أمان.', fix: 'أضف اختبارًا على الأقل لمنطقها الأساسي.', prevent: 'اشترط اختبارًا لكل وحدة جديدة.' },
];

// ---------- التشغيل ----------
const SEV_W = { high: 0, medium: 1, low: 2, info: 3 };
const norm = (s) => String(s).trim().replace(/\s+/g, ' ').slice(0, 160);
const fpOf = (pass, file, snippet) => createHash('sha1').update(`${pass}|${file}|${norm(snippet)}`).digest('hex').slice(0, 12);
const found = [];
const perPass = [];

P.forEach((p, n) => {
  let count = 0;
  for (const f of files) {
    if (!p.applies(f)) continue;
    const hits = [];
    if (p.file) hits.push(...p.file(f));
    else {
      f.lines.forEach((l, i) => {
        if (l.includes('review-ignore')) return;
        const r = p.line(l, i, f);
        if (r) hits.push({ line: i + 1, snippet: l, ...(typeof r === 'object' ? r : {}) });
      });
    }
    for (const h of hits) {
      count += 1;
      found.push({
        id: fpOf(p.id, f.path, h.snippet), pass: p.id, title: p.title + (h.note ? ` (${h.note})` : ''),
        sev: h.sev || p.sev, file: f.path, line: h.line, snippet: norm(h.snippet),
        impact: p.impact, fix: p.fix, prevent: p.prevent,
      });
    }
  }
  perPass.push({ id: p.id, title: p.title, count });
  console.log(`مراجعة ${n + 1}/30  ${p.id}  ${p.title}: ${count}`);
});

// ---------- الدفتر: جديد / مستمر / اتصلح ----------
mkdirSync(OUT, { recursive: true });
const ledgerPath = join(OUT, 'ledger.json');
const prev = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};
const nowIso = new Date().toISOString();
const ledger = {};
const seen = new Set();
for (const x of found) {
  if (seen.has(x.id)) continue;
  seen.add(x.id);
  const old = prev[x.id];
  x.status = old && old.status === 'open' ? 'persisting' : 'new';
  ledger[x.id] = { status: 'open', firstSeen: old?.firstSeen || nowIso, lastSeen: nowIso, pass: x.pass, file: x.file, line: x.line, snippet: x.snippet, title: x.title, sev: x.sev };
}
const fixed = [];
for (const [id, old] of Object.entries(prev)) {
  if (seen.has(id)) continue;
  const rec = { ...old, status: 'fixed', fixedAt: old.fixedAt || nowIso };
  ledger[id] = rec;
  if (old.status === 'open') fixed.push({ id, ...rec });
}
const unique = found.filter((x, i) => found.findIndex((y) => y.id === x.id) === i).sort((a, b) => SEV_W[a.sev] - SEV_W[b.sev] || a.file.localeCompare(b.file) || a.line - b.line);
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));

const bySeverity = { high: 0, medium: 0, low: 0, info: 0 };
unique.forEach((x) => { bySeverity[x.sev] += 1; });
const summary = {
  files: files.length, lines: files.reduce((s, f) => s + f.lines.length, 0), passes: P.length,
  total: unique.length, bySeverity, new: unique.filter((x) => x.status === 'new').length,
  persisting: unique.filter((x) => x.status === 'persisting').length, fixed: fixed.length,
};
const report = { schema: 'tanagha-review/1', generatedAt: nowIso, commit: String(process.env.GITHUB_SHA || '').slice(0, 12), summary, passes: perPass, findings: unique, fixed };
writeFileSync(join(OUT, 'review-latest.json'), JSON.stringify(report, null, 1));

// ---------- تقرير Markdown مناسب للذكاء الاصطناعي ----------
const SEV_AR = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة', info: 'معلومة' };
const M = [
  '# مراجعة كود منصة التناغه الشرقيه', '', `التاريخ: ${nowIso}`, `commit: ${report.commit || '—'}`, '',
  '## تعليمات للمساعد (AI)', '',
  'المنصة: JavaScript (ES modules) + Vite، RTL عربي، GitHub Pages، Firebase Spark (Auth + Firestore بدون Functions).',
  'النتائج من فحص ثابت (قواعد نمطية)، فقد تحتوي على إنذارات كاذبة. لكل ملاحظة: تحقق من الكود الفعلي أولًا، ثم عدّل بأصغر تغيير، ثم اذكر أثره على باقي المنصة وأضف اختبارًا.',
  'ابدأ بالأعلى خطورة. لا تعدّل شيئًا غير مرتبط بالملاحظة.', '',
  '## الملخص', '',
  `- ملفات: ${summary.files}، أسطر: ${summary.lines}، مرورات: ${summary.passes}`,
  `- الإجمالي ${summary.total}: عالية ${bySeverity.high}، متوسطة ${bySeverity.medium}، منخفضة ${bySeverity.low}، معلومة ${bySeverity.info}`,
  `- جديدة منذ آخر مراجعة: ${summary.new}، مستمرة: ${summary.persisting}، اتصلحت: ${summary.fixed}`, '',
  '## نتائج كل مرور', '', ...perPass.map((p) => `- ${p.id} ${p.title}: ${p.count}`), '',
];
for (const sev of ['high', 'medium']) {
  M.push(`## ملاحظات ${SEV_AR[sev]}`, '');
  const list = unique.filter((x) => x.sev === sev);
  if (!list.length) M.push('لا يوجد.', '');
  list.slice(0, 150).forEach((x) => M.push(`- [${x.status === 'new' ? 'جديد' : 'مستمر'}] ${x.file}:${x.line} (${x.pass}) ${x.title}`, `  - السطر: \`${x.snippet.replace(/`/g, "'")}\``, `  - الأثر: ${x.impact}`, `  - الحل: ${x.fix}`, `  - المنع: ${x.prevent}`));
  if (list.length > 150) M.push(`- ... و${list.length - 150} ملاحظة إضافية في review-latest.json`);
  M.push('');
}
M.push('## منخفضة ومعلومات (أمثلة)', '');
for (const p of perPass) {
  const list = unique.filter((x) => x.pass === p.id && (x.sev === 'low' || x.sev === 'info'));
  if (list.length) M.push(`- ${p.id} ${p.title}: ${list.length} (مثال: ${list[0].file}:${list[0].line})`);
}
M.push('', '## اتصلحت منذ آخر مراجعة', '');
if (!fixed.length) M.push('لا يوجد.');
fixed.slice(0, 100).forEach((x) => M.push(`- ${x.file} (${x.pass}) ${x.title}`));
writeFileSync(join(OUT, 'review-latest.md'), M.join('\n'));

console.log(`\nالإجمالي ${summary.total} | عالية ${bySeverity.high} | جديدة ${summary.new} | اتصلحت ${summary.fixed}`);
console.log(`التقارير في ${relative(ROOT, OUT)}`);
if (FAIL_ON_HIGH && bySeverity.high > 0) process.exit(1);
