# دليل النشر خطوة بخطوة (Firebase + GitHub Pages)

الواجهة تُنشر تلقائيًا من GitHub Pages عند الدمج في `main`. الخلفية (القواعد والفهارس والوظائف) تُنشر منك أنت على Firebase. لا أحد غيرك يملك هذا الإذن.

## 0. قبل البدء
- ثبّت Node 22 و Java 21 (للاختبارات فقط) ثم: `npm i -g firebase-tools` ثم `firebase login`.
- ادمج الـ PRs بالترتيب (9، 10، 11، 12، 13 ثم هذا).
- **احذف توكن GitHub الذي أُعطي للمساعد** من Settings > Developer settings > Tokens.

## 1. إنشاء المشروع
1. من https://console.firebase.google.com اضغط Add project واختر اسمًا.
2. اربط تطبيق ويب: Project settings > Your apps > Web. انسخ القيم الأربع: apiKey و authDomain و projectId و appId.
3. حدّث الخطة إلى **Blaze** (دفع حسب الاستخدام). Cloud Functions تتطلبها. ضع **Budget alert** صغيرًا (مثلًا 5 دولار) من Billing > Budgets.

## 2. تفعيل الخدمات
- Authentication > Sign-in method > فعّل Email/Password.
- Authentication > Settings > Authorized domains: أضف `phdgxt4-coder.github.io` (ونطاقك المخصص إن وُجد).
- Firestore Database > Create database > Native mode > اختر منطقة قريبة (مثلًا `europe-west1` أو `me-central1`). **المنطقة لا تتغير بعد الإنشاء.**

## 3. نشر الخلفية
```bash
cd functions && npm install && cd ..
firebase use --add            # اختر مشروعك
firebase deploy --only firestore:rules,firestore:indexes,functions
```
انتظر اكتمال بناء الفهارس (Firestore > Indexes، الحالة Enabled). الاستعلامات تفشل قبل ذلك.
إن اخترت منطقة غير `us-central1` للوظائف فاضبط `VITE_FIREBASE_FUNCTIONS_REGION` بنفس المنطقة.

## 4. ربط الواجهة
في GitHub: Settings > Secrets and variables > Actions > **Variables** أضف:
`VITE_FIREBASE_API_KEY` و `VITE_FIREBASE_AUTH_DOMAIN` و `VITE_FIREBASE_PROJECT_ID` و `VITE_FIREBASE_APP_ID` و `VITE_FIREBASE_FUNCTIONS_REGION`.
(هذه القيم عامة وليست أسرارًا.) ثم شغّل workflow النشر من Actions أو ادفع أي تعديل إلى main.
للتشغيل المحلي انسخ `.env.example` إلى `.env.local` واملأه.

## 4ب. الإشعارات اللحظية (اختياري لكن موصى به)
1. Project settings > Cloud Messaging > Web configuration > Generate key pair. انسخ المفتاح العام.
2. أضفه كمتغير GitHub باسم `VITE_FIREBASE_VAPID_KEY`، ثم أضف سطرًا واحدًا إلى `.github/workflows/pages.yml` بجانب باقي متغيرات VITE (لا أستطيع تعديل ملفات workflow من حساب المساعد):
   `VITE_FIREBASE_VAPID_KEY: ${{ vars.VITE_FIREBASE_VAPID_KEY }}`
3. الإشعارات داخل المنصة (الجرس) تعمل بدونه. على الآيفون: iOS 16.4 أو أحدث، ويجب إضافة الموقع للشاشة الرئيسية وفتحه من الأيقونة ثم تفعيل الإشعارات.

## 5. أول حساب إدارة (الأدمن الافتراضي، مرة واحدة فقط)
هذا هو الأدمن الوحيد الذي يُنشأ يدويًا. أي أدمن آخر يُنشأ من داخل لوحة الإدارة بدعوة (القسم 5ب).
1. Firebase Console > Authentication > Users > Add user: اكتب بريد الأدمن وكلمة مرور **قوية يعرفها هو فقط**. لا تكتبها في أي ملف أو PR أو محادثة.
2. انسخ الـ UID من نفس الصفحة.
3. Firestore Database > Start collection `admins` > Document ID = الـ UID، وأضف الحقول:
   - `active` (boolean) = `true`
   - `email` (string) = بريد الأدمن
   - `displayName` (string) = اسمه
   - `phone` (string) = رقم هاتفه (اختياري، للعرض فقط)
   - `createdBy` (string) = `console`
4. سجّل الدخول من `/login/teacher` (بوابة المدرس تفتح للأدمن لوحة الإدارة). حسابات الأدمن لا تحتاج توثيق البريد، لكن يُفضل توثيقه.

## 5ب. إضافة أدمن جديد (من داخل لوحة الإدارة)
1. لوحة الإدارة > المدراء > اكتب بريد الأدمن الجديد > دعوة.
2. الأدمن الجديد يفتح `/admin/join`، ينشئ حسابًا بنفس البريد، يضغط رابط التوثيق في بريده، ثم يرجع ويكتب اسمه ويضغط "تفعيل الدعوة".
3. بعدها يدخل من `/login/teacher`. أي مدير نشط يقدر يوقف مديرًا آخر (لا يوقف نفسه). الدعوة تُستخدم مرة واحدة ويمكن إلغاؤها قبل استخدامها.
4. لا يوجد طريق آخر لإنشاء أدمن: القواعد ترفض أي كتابة في `admins` بدون دعوة من أدمن نشط.

## 5ج. توثيق البريد وApp Check
- توثيق البريد مطلوب الآن لكل الأدوار (طالب، ولي أمر، مدرس) قبل فتح أي بيانات، والقواعد تفرضه أيضًا.
- App Check (اختياري، مفتاح مجاني بحد علمنا لكن حدود الاستخدام لم تُتحقق منها بالكامل): Firebase Console > App Check > تسجيل تطبيق الويب بمزود reCAPTCHA v3 > انسخ مفتاح الموقع (عام) وضعه في المتغير `VITE_APPCHECK_SITE_KEY` أو في `src/config/app-check.js`. ابدأ بوضع المراقبة (بدون إلزام) وراقب الطلبات المرفوضة أسبوعًا قبل تفعيل الإلزام، لأن الإلزام الخاطئ يمنع المستخدمين.
- الإقرار على الخصوصية يُسجل الآن على حساب كل مستخدم (`consentAt`).

## 6. إعداد المدرسة (من لوحة الإدارة)
1. الصفوف والفصول، ثم المواد (يوجد زر المواد الافتراضية).
2. استيراد الطلاب من CSV/لصق (اسم رباعي، هاتف، فصل).
3. اعتماد المدرسين، ثم ربط كل مدرس بمادة وفصل.

## 7. اختبار أولي ببيانات وهمية فقط
- طالب: تسجيل ثم دخول مباشر، يفتح لوحته، يبقى مسجلًا بعد إغلاق المتصفح.
- ولي أمر: تسجيل، الطالب يولّد كود، ولي الأمر يربط، يرى الدرجات. الكود صالح 15 دقيقة ولمرة واحدة.
- مدرس: يسجل ويظهر "بانتظار الاعتماد"، الإدارة تعتمده وتربطه، ينشر محتوى ويسجل حضورًا.
- طالب من فصل آخر لا يرى محتوى فصلك.

## 8. نسخ احتياطي (قبل أي بيانات حقيقية)
فعّل تصدير Firestore المجدول إلى Cloud Storage (يومي) وراجع https://firebase.google.com/docs/firestore/solutions/schedule-export . هذا لم يُضبط تلقائيًا.

## استكشاف الأخطاء
- "failed-precondition: index": الفهرس لم يكتمل بعد، انتظر.
- "permission-denied" للإدارة: تأكد أن مستند `admins/{uid}` موجود و `active` true.
- وظيفة تفشل بخطأ 403: تأكد من خطة Blaze.

## وضع Spark (الخطة المجانية، بدون كارت)

- النشر بدون Functions: `firebase deploy --only firestore:rules,firestore:indexes`
- لا تحتاج Blaze. الإشعارات داخل الموقع فقط (الجرس) بدون إشعارات الجهاز.
- للترقية لاحقًا لـ Blaze: ضع `VITE_BACKEND_MODE=blaze` وانشر الـ functions.
- حدود الخطة المجانية: 50 ألف قراءة يوميًا. الأمان أضعف قليلًا لأن بعض العمليات تتم من المتصفح.

## ملخص التشغيل الكامل (Spark)

1. اعمل merge للـ PRs بالترتيب: 19، 20، 21، 22، 23 (كل واحد يحتوي اللي قبله إن لم يُدمج).
2. انشر القواعد والفهارس: `firebase deploy --only firestore:rules,firestore:indexes` (انتظر اكتمال بناء الفهارس في Firebase Console > Firestore > Indexes قبل التجربة).
3. سطر الـ workflow (`VITE_FIREBASE_VAPID_KEY`) غير مطلوب في Spark لأن إشعارات الجهاز غير مفعلة.
4. أول حساب إدارة: القسم 5 أعلاه (مستند `admins/{uid}` فيه `active: true`).
5. من لوحة الإدارة: الفصول، المواد، المدرسون والإسناد، استيراد الطلاب، جدول الحصص.
6. جرب بحسابات تجريبية (طالب، ولي أمر، مدرس، إدارة): تسجيل، ربط ولي الأمر بكود، نشر محتوى، رصد جماعي، رسائل، صور، جدول، ترقية السنة على فصل تجريبي.
7. النسخ الاحتياطي: لوحة الإدارة > النسخ والأخطاء > تنزيل نسخة (يدوي، يُحسب من حد القراءات). النسخ التلقائي المجدول من Google يحتاج Blaze.
8. مراقبة الأخطاء: نفس التبويب يعرض آخر 30 خطأ مسجلًا من متصفحات المستخدمين المسجلين.
