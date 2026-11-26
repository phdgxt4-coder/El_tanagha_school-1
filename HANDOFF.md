# HANDOFF: تسليم جلسة 26 نوفمبر 2026

> نقطة الرجوع: **الرجوع لحالة بداية هذه الجلسة = الـ hash الجديد (0e2357a63855390b77ec78dd768616c5886797ed)، وليس 601eb38.**
> الفرع والـ tag: `backup-2026-11-26-start`. النسخة القديمة `backup-before-release` (601eb38) موجودة كما هي ولم تُلمس.

## 0. ترتيب النشر الآمن للقواعد والفهارس (انشر بالترتيب ده بالظبط)

الخطة: Spark (مجانية، بدون Functions). كل الأوامر من فولدر المشروع بعد `firebase login` و `firebase use <project-id>`.

1. **الفهارس أولًا**: `firebase deploy --only firestore:indexes`
2. **انتظر اكتمال البناء**: Firebase Console > Firestore > Indexes. كل فهرس لازم تكون حالته Enabled (ممكن من دقائق لساعة). الاستعلامات اللي محتاجة فهرس بتفشل قبل كده، والموقع هيعرض "هذه الخدمة غير متاحة الآن" بدل صفحة فاضية.
3. **بعدها القواعد**: `firebase deploy --only firestore:rules`
4. **اختبار فوري بحسابات حقيقية** (10 دقايق): سجّل دخول بحساب إدارة، مدرس، طالب، ولي أمر، وافتح كل لوحة. جرّب: ولي الأمر يربط ابنه بكود، المدرس ينشر درس، الطالب يشوفه، رسالة شات طالب لمدرس. لو أي حاجة طلعت "غير متاحة الآن" أو permission-denied ارجع فورًا (الخطوة 5).
5. **أمر الرجوع للقواعد القديمة** (جاهز، اختبرت أن الملف موجود، لكن ما نشرتش حاجة على Firebase):
   ```bash
   git show c0c0ebf:firestore.rules > /tmp/rules.old
   cp firestore.rules /tmp/rules.current && cp /tmp/rules.old firestore.rules
   firebase deploy --only firestore:rules
   cp /tmp/rules.current firestore.rules   # رجّع الملف الحالي في الفولدر
   ```
   `c0c0ebf` هو أقرب commit للقواعد اللي نشرتها مساء 25 نوفمبر (تقدير: ما أعرفش بالظبط إيه اللي اتنشر). نسخ احتياطية من القواعد والفهارس الحالية في `docs/rollback/`.
6. لا تعدّل القواعد لتمرير اختبار. لو سيناريو فشل، الكود لازم يتعدل.

## 1. خطوات يدوية عليك (مرتبة، بالدقايق)

| # | الخطوة | الوقت | الأمر أو المكان |
|---|---|---|---|
| 1 | أول أدمن من الـ Console (مرة واحدة، بكلمة مرور قوية بتعرفها أنت فقط) | 5 د | `docs/ADMIN_BOOTSTRAP.md` و DEPLOY.md القسم 5 |
| 2 | نشر الفهارس ثم القواعد بالترتيب في القسم 0 | 10 د + انتظار البناء | `firebase deploy --only firestore:indexes` ثم `firebase deploy --only firestore:rules` |
| 3 | الفلاجز: الموجود فلاج واحد فقط (`living`، طبقة الشخصيات) وهو مقفول افتراضيًا. **لا شيء مطلوب.** للتجربة على جهازك فقط: `localStorage.setItem('sc.flag.living','1')` | 0 د | `src/config/features.js` |
| 4 | قيّد مفتاح Firebase Web بالـ HTTP referrer: Google Cloud Console > APIs & Services > Credentials > المفتاح > Application restrictions > Websites: `phdgxt4-coder.github.io/*` (وlocalhost للتجريب) | 5 د | Google Cloud Console |
| 5 | App Check (اختياري)، وتأكد من حدود Spark في Console > Usage (50 ألف قراءة و20 ألف كتابة يوميًا حسب علمي، لم أتحقق منها من المصدر) | 10 د | Console |
| 6 | اختبار على موبايلات حقيقية بينها iPhone (دخول، شات، إشعار التحديث، كل لوحة) | 20 د | الأجهزة |
| 7 | تأكد إن رسائل التوثيق وإعادة تعيين كلمة المرور بتوصل (وراجع Spam) بإيميلات حقيقية | 10 د | الإيميل |
| 8 | غيّر كل كلمة مرور لصقتها في المحادثة، واحذف أي توكن GitHub أُعطي للمساعد | 5 د | GitHub / Firebase |
| 9 | قرارات معلّقة وPRs مفتوحة (القسم 3) | حسب قرارك | |

## 2. نتائج السيناريوهات (آخر تشغيل، كود main الحالي)
تفاصيل الطريقة والثغرات: `docs/SCENARIOS.md`. الجدول: القواعد الجديدة = `firestore.rules` في الريبو، القديمة = commit c0c0ebf.

| # | Step | NEW rules | OLD rules |
|---|---|---|---|
| 1 | admin doc created per ADMIN_BOOTSTRAP steps (console-style write) | PASS | PASS |
| 2 | admin sign in + status=admin | PASS | PASS |
| 3 | admin: seed default subjects | PASS | PASS |
| 4 | admin: create class grade1 section A | PASS | PASS |
| 5 | admin: create class grade2 bac_med | PASS | PASS |
| 6 | admin: create class grade3 science | PASS | PASS |
| 7 | admin: add custom subject | PASS | PASS |
| 8 | student: register (grade1) | PASS | PASS |
| 9 | student: status active after verify | PASS | PASS |
| 10 | student: issue parent code | PASS | PASS |
| 11 | parent: register | PASS | PASS |
| 12 | parent: link with code | PASS | PASS |
| 13 | parent: list linked students | PASS | PASS |
| 14 | parent: code is single use (2nd link fails) | PASS | PASS |
| 15 | teacher: register (pending) | PASS | PASS |
| 16 | teacher: status pending | PASS | PASS |
| 17 | admin: list teacher applications | PASS | PASS |
| 18 | admin: approve teacher | PASS | PASS |
| 19 | admin: assign teacher to subject+class1 | PASS | PASS |
| 20 | admin: import roster rows | PASS | PASS |
| 21 | admin: search users (teacher) | PASS | PASS |
| 22 | admin: invite another admin | PASS | PASS |
| 23 | teacher: signs in and is active teacher | PASS | PASS |
| 24 | teacher: reads own assignments | PASS | PASS |
| 25 | teacher: reads class roster | PASS | PASS |
| 26 | student cannot self-promote (negative) | PASS | PASS |
| 27 | password reset email request | PASS | PASS |
| 28 | chat: student sends first message to teacher | PASS | PASS |
| 29 | chat: student reads own conversation messages | PASS | PASS |
| 30 | chat: student cannot send as someone else (negative) | PASS | PASS |
| 31 | student cannot write grades (negative) | PASS | PASS |
| 32 | student cannot read admins collection (negative) | PASS | PASS |
| 33 | student cannot create a class (negative) | PASS | PASS |
| 34 | chat: teacher replies (after the 2s rate limit) | PASS | PASS |
| 35 | chat: teacher lists own conversations | PASS | PASS |
| 36 | teacher cannot self-assign / approve (negative) | PASS | PASS |

الثغرات بصراحة: رفع الصور لم يُختبر (لا يوجد Storage ولا مسار رفع في الريبو)، وشات ولي الأمر والمدرس مغطى باختبارات القواعد فقط. هذا إيميوليتر وليس Firebase الحقيقي: وصول الإيميل والفهارس الفعلية والحصص لم تُختبر.

## 3. PRs مفتوحة (لم تُدمج لأنها تلمس مناطق حساسة حسب الـ brief)
| PR | الموضوع | ليه مفتوح | قبل الدمج |
|---|---|---|---|
| #64 | إغلاق مستمعي الشات عند تغيير الصفحة وتسجيل الخروج (كان فيه تسريب) | يلمس الشات | جرّب شات طالب-مدرس وولي أمر-مدرس يدويًا |
| #65 | تقوية استيراد Excel: حد 5 ميجا، إزالة = + - @ من بداية الخلايا | يغذّي استيراد الإدارة | جرّب استيراد ملف حقيقي. ناقص: قائمة أخطاء لكل صف |
| #68 | تأخير 60 ثانية بعد 5 أكواد ربط غلط (واجهة فقط) | يلمس ربط ولي الأمر | جرّب الربط بكود غلط 5 مرات |

## 4. قرارات معلّقة (توصية فقط، لم أنفذ شيئًا)
1. إدخال الفصل يدويًا عند التسجيل: توصيتي تحويله لطلب يعتمده الأدمن بدل الإدخال الحر.
2. تفريغ أخبار 2025 التجريبية: توصيتي نعم بعد ما تنشر أخبار حقيقية.
3. مكان فقاعة تسجيل الدخول: قرارك، لا يوجد خطأ وظيفي.
4. تقسيم "علمي" عربيًا (علمي علوم / علمي رياضة): قرار تعليمي، التتبع الحالي في `TRACKS`.
5. يد أليكس عند الرجوع للأعلى: تجميلي، مؤجل.
6. حدود المدخلات: الموجود maxlength في الحقول وحدود في القواعد، راجع القيم مع المدرسة.
7. هل الهاتف والإيميل في صفحة التواصل رسميين؟ لازم تأكيد من المدرسة قبل اعتمادها.
8. صفحة الخصوصية وبيانات القُصّر: لازم مراجعة بشرية أو قانونية. أنا لم أكتب نصًا قانونيًا.
9. robots.txt: لم أضفه (Lighthouse SEO 92 بسببه فقط). قرارك هل الموقع يُفهرس. توصيتي: السماح بالصفحات العامة ومنع /dashboard و /login.

## 5. نقاط Firebase والأمان (الموقع، المشكلة، الإصلاح، الأولوية، النوع)
| الموقع | المشكلة | الإصلاح | الأولوية | النوع |
|---|---|---|---|---|
| `pages/chat.js`, `parent-chat.js` | المستمعون لا يُغلقون عند الخروج | PR #64 | عالية | كود فقط |
| ربط ولي الأمر (Spark) | `linkAttempts` مقفول في القواعد، فلا يوجد حد محاولات على السيرفر. الكود أحادي الاستخدام وصلاحيته 15 دقيقة وطوله كبير، فالتخمين غير عملي، لكن لا يوجد قفل | حد على السيرفر يحتاج Cloud Function (Blaze) أو تصميم قواعد مختلف. الواجهة فيها تأخير في PR #68 | متوسطة | Rules/Functions (لم أعدّلها) |
| فحوص الأدمن في الواجهة | الواجهة تخفي أقسام الأدمن لكن الحماية الحقيقية في القواعد (`isActiveAdmin`) | لا تعتمد على إخفاء الواجهة أبدًا. السيناريوهات السلبية نجحت | معلومة | كود فقط |
| مفتاح Firebase Web | ظاهر في bundle قديم في git (مفتاح عام بطبيعته) | قيّده بالـ referrer (الخطوة 4) | عالية | Console |
| `pnpm audit` | 1 high + 4 moderate + 1 low، كلها في grpc (Node فقط) وأدوات التطوير، لا تُشحن للمتصفح | تحديث firebase / firebase-tools (ترقية رئيسية، مؤجلة) | منخفضة | كود فقط |
| CSP والـ headers | GitHub Pages لا يسمح بـ headers | اقتراح في `docs/SECURITY-AUDIT.md`. الاستضافة على Firebase Hosting (موجودة في DEPLOY.md) تسمح بها | متوسطة | استضافة |
| صفحات ثابتة متداخلة | روابط `./` غلط قبل تشغيل JS (390 رابط في 29 صفحة): تؤثر على من لا يشغّل JS ومحركات البحث | تعديل `scripts/create-static-routes.mjs` ليكتب المسار الصحيح | منخفضة | كود فقط |
| خط Google Fonts | يكشف IP الزائر لجوجل | استضافة الخط محليًا | منخفضة | كود فقط |
| `icon-512.png` | 424KB | ضغط الصورة | منخفضة | كود فقط |

## 6. التزامن والقراءات والكتابات (تقديرات، غير مقاسة على Firebase الحقيقي)
- كل قائمة تحمّل حتى 21 مستندًا لكل ضغطة "المزيد" (PAGE_SIZE=20 + 1). الشات: آخر 50 رسالة و30 محادثة بمستمع لحظي.
- مستمعو onSnapshot في الكود: شات 3، شات ولي الأمر 3، الإشعارات 2، المحتوى 1 (القياس في `docs/MEASUREMENTS.md`). تقدير عملي: جلسة طالب عادية بين 50 و150 قراءة، وهذا **تقدير** وليس قياسًا. مع 50 ألف قراءة يوميًا في Spark، مئات الطلاب النشطين يوميًا قد يقتربوا من الحد: راقب Console > Usage.
- حد معدل الشات: القواعد ترفض رسالتين خلال ثانيتين (تأكدت منه في الاختبار).
- كود ولي الأمر أحادي الاستخدام: المحاولة الثانية بنفس الكود فشلت في الاختبار.
- التزامن بين أكثر من مستخدم على نفس المستند (مثل حضور من مدرسين) لم أراجعه بعمق، غير مغطى.
- الأداء تحت الحمل **غير مقاس**.

## 7. أمان: مفاتيح وتوكنات في git
مسحت كل التاريخ: لا يوجد غير مفتاح Firebase Web العام. تفاصيل في `docs/SECURITY-AUDIT.md`.

## 8. ما يحتاج هيدرز أو استضافة مختلفة
CSP وHSTS وX-Frame-Options وReferrer-Policy: غير ممكنة على GitHub Pages. الحل: Firebase Hosting (الخطوات في DEPLOY.md) مع `firebase.json` headers. لم أفعل ذلك لأنه تعديل نشر.
