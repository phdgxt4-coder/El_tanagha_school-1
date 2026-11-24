# منصة التناغه الشرقيه الثانويه المشتركه

منصة عربية RTL لمدرسة التناغه الشرقيه الثانويه المشتركه. تحتفظ بالهوية الداكنة/الذهبية المأخوذة من مرجع الهاتف، وتستخدم بنية ES modules. الواجهة العامة تُبنى بواسطة Vite، والمصادقة والطلبات الخاصة تعتمد Firebase Authentication وCloud Functions وFirestore Rules. لا يستخدم المشروع قاعدة بيانات أو خادم Manus.

## التشغيل المحلي

```bash
pnpm install --frozen-lockfile
pnpm dev
```

يعمل Vite على المنفذ 3000. إعداد Firebase Web موجود في قيم المشروع المحمية، ويستخدمه المتصفح عند بناء الواجهة؛ القيم الموجودة على الويب (بما فيها Firebase Web API key) تعريفات عميل عامة وليست أسرار خدمة. لا تضف service-account JSON أو مفاتيح خاصة أو كلمات مرور إلى `.env`, Git أو ملفات الواجهة. يعرض التطبيق حالة واضحة بدل الادعاء بأن Firebase متصل إذا غابت إعدادات العميل أو لم تُنشر الخدمات.

## إعداد Firebase قبل التفعيل الحي

1. في Firebase Console فعّل Email/Password في Authentication وأنشئ قاعدة Firestore Native-mode. شغّل Email Enumeration Protection وسياسة كلمة مرور مناسبة، وأضف نطاقات المعاينة/الإنتاج المعتمدة إلى إعدادات Authentication عند الحاجة.
2. اجعل منطقة الوظائف `us-central1` كما في العميل والخادم. لا تُفعّل Firebase Hosting لهذا المشروع؛ استضافة الواجهة مستقلة.
3. سجّل الدخول إلى Firebase CLI بحساب مالك المشروع في بيئة النشر المعتمدة. يتطلب نشر Cloud Functions إعداد Billing مناسبًا لدى Firebase؛ راجع الاستخدام والتكلفة في حسابك قبل تفعيله.
4. راجع القواعد ثم انشر فقط القواعد والوظائف للمشروع المحدد:

```bash
firebase deploy --only firestore:rules,functions --project "$VITE_FIREBASE_PROJECT_ID"
```

5. لإنشاء أول مدير: أنشئ حسابًا موثوقًا للموظف في Firebase Authentication، ثم أضف يدويًا في Firestore مستندًا خاصًا في `admins/{uid}` بقيمة `{ "active": true }` بعد التحقق من UID. لا يوجد حساب افتراضي أو مسار تسجيل ذاتي للإدارة. لا يستطيع عميل الويب إنشاء هذا السجل؛ Admin SDK للوظائف يتجاوز القواعد كما هو متوقع.
6. راجع التشغيل بإرسال طلب مدرس جديد، توثيق بريده، ثم اعتماده من `/admin/teacher-requests` بحساب الإدارة. بدون موافقة نشر المدرس، لا تنشئ الوظيفة سجلًا في `publicTeachers`. القواعد تتيح للعامة قراءة المستندات المنشورة فقط، وتمنع كتابة السجلات الخاصة من العميل.

## إعدادات العميل المطلوبة

يحتاج التطبيق إلى `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, و`VITE_FIREBASE_APP_ID`. هذه إعدادات Web عامة مرتبطة بمشروع Firebase، وتُضمَّن في ملفات JavaScript التي تصل إلى المتصفح. قيّد المفتاح من Google Cloud حيثما أمكن، ولا تعتبره سرًا أو بديلًا عن قواعد Firestore. لا يحتاج Admin SDK إلى service account key ثابت؛ يستخدم هوية خدمة بيئة Cloud Functions.

## التحقق

```bash
pnpm test
pnpm build
npm test --prefix functions
```

اختبارات وحدات التحقق لا تنشئ حسابات أو مستندات تجريبية. اختبارات المعاينة المحلية لا تثبت أن المشروع الخارجي نُشر أو أن المصادقة حية؛ ذلك يتطلب تحققًا منفصلًا على مشروع Firebase.
