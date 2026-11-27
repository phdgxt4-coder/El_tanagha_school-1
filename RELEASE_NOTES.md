# Release notes (26 Nov 2026 session)

Code on main at **7e314cd**. Start of session: `backup-2026-11-26-start` = 0e2357a63855390b77ec78dd768616c5886797ed. Rolling back to the session start means that hash, not 601eb38 (`backup-before-release`, untouched).

## Merged to main (one at a time; tests, rules emulator and build green; CI deploy success; live check after each)
| PR | Merge | What |
|---|---|---|
| #61 | 5d4c0ee | Alex v7 to v10 (were stuck in stacked branches) |
| #60 | f242107 | /login/admin shows the admin login |
| #62 | 0e2357a | earlier release notes |
| #63 | b34d76c | Arabic error boundary, render fallback, PII scrub, rollback copies |
| #66 | 3f78086 | favicon + OG meta |
| #67 | 57cd01d | update notice: small in-flow bar at the top, hidden while typing |
| #69 | b9eb8fa | link checker `scripts/check-links.mjs` |
| #70 | 7bfefeb | load states: 15s pager timeout, retry, "هذه الخدمة غير متاحة الآن" on permission-denied or failed-precondition |
| #71 | 9c3dcc5 | touch targets (CSS only) |
| #72 | 499ddf0 | dates shown in Africa/Cairo |
| #73 | 7e314cd | .nvmrc + engines (Node 22), same as CI |

## جلسة 27 نوفمبر 2026 — كل الـPRs اتدمجت

| PR | merge | المحتوى |
|---|---|---|
| #83 | 2c242ba | زر العين لكلمة المرور (بدون تميمة؛ #44 اتقفل) |
| #78 | 114419d | ظهور الشخصيات الخمس في اللحظات (Oscar/Chloe/Leo/Arthur) |
| #64 | 25b6bbe | قفل مستمعين الشات عند تغيير الصفحة |
| #49 | 248caec | تحصين قوائم التسجيل (صف/مسار/فصل) |
| #65 | abfd651 | تحصين استيراد الإكسل (حد 5 ميجا واحد بعد إصلاح كود ميت) |
| #68 | 2cb5b89 | مهلة 60 ثانية بعد 5 محاولات ربط خاطئة لولي الأمر |
| #81 | a0a81da | إنهاء تعليق التوثيق اللانهائي (مهل 15/10 ثواني + إعادة محاولة) |
| #82 | cc8cbfc | dist خارج التتبع (CI يبنيه) — نهاية تعارضات dist |

وقبلهم في نفس الليلة: #76 (Living افتراضيًا)، #77 (قفل الجلسة)، #79 (موبايل)، #80 (الفوتر).

### تحقق هذه الجلسة (مقاس)
- 137 اختبار ناجح / 0 فاشل على main النهائي (cc8cbfc)، وبناء نظيف.
- لايف بعد النشر: قاعدة قفل الفوتر في الـCSS المنشور، الخمس شخصيات في حزمة wire المنشورة (alex/arthur/oscar/leo/chloe كلهم موجودين)، زر العين وعبارات load-timeout و"اختر الفصل" ورسالة 5 ميجا في الحزم المنشورة.
- صفر PRs مفتوحة.

### لم يُختبر (كما هو)
- موبايلات حقيقية، Firebase حقيقي، وصول إيميلات التوثيق، حمل فعلي.

## Verified (measured)
- Tests: 140/140 (rules emulator) at 7e314cd. Build OK.
- Scenarios (`docs/SCENARIOS.md`): 40/40 on the NEW rules and 40/40 on the OLD rules (c0c0ebf), client code of 7e314cd. Open PRs are not in this run.
- Live smoke at the final main: 16 routes x 360 and 390, no JS errors, no horizontal overflow, no broken images (`scripts/live-smoke.mjs`).
- Size (gzip): Firebase SDK chunk 170,608 B, app JS 18,035 B, CSS 14,499 B. Lighthouse mobile on a local preview: home perf 96, a11y 100, best-practices 100, SEO 92. LCP 1.4 to 1.5 s.
- No "before" run exists, so there are no before/after numbers. None are claimed.

## Not tested
- Real phones, a real Firebase project, real email delivery, push with the app closed.
- Performance under load is NOT measured. Slow-4G run not done.
- Parent dashboard touch targets not measured.

## Not done
Phase 2 (timeouts on non-list screens), code splitting and WebP (phases 4/5), a11y beyond Lighthouse, messages catalogue (item 19), Slow-4G (item 22), Oscar first version PR, Leo and Chloe (plan only in `docs/CHARACTERS.md`).

## Not done on purpose
No rules weakened, no secrets in code, no default admin, no data deleted, nothing deployed to Firebase.
