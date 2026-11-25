# إعداد المنصة وتشغيلها

## تشغيل الواجهة محليًا

```bash
pnpm install --frozen-lockfile
pnpm dev
```

يعمل Vite على المنفذ 3000. عند غياب إعدادات Firebase يعرض التطبيق حالة واضحة ولا يرسل بيانات تسجيل الدخول. لا تختبر التسجيل أو الدخول ببيانات حقيقية قبل أن يؤكد مالك المدرسة المشروع ويهيئ الخدمات.

## إعداد Firebase (مسؤولية مالك المشروع)

1. أكد معرّف المشروع وملكيته ومنطقته وتكلفة Cloud Functions قبل أي نشر.
2. فعّل Firebase Authentication بالبريد وكلمة المرور، وأعد سياسة كلمة المرور وحماية تعداد البريد والنطاقات المصرح بها.
3. أنشئ Firestore Native-mode وراجع `firestore.rules` و`firestore.indexes.json`.
4. أضف إعدادات Firebase Web العامة إلى متغيرات GitHub Actions للمستودع: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, والمنطقة الاختيارية `VITE_FIREBASE_FUNCTIONS_REGION`. هذه القيم تدخل في JavaScript العام للمتصفح؛ ليست أسرارًا ولا تحمي البيانات من دون قواعد Firestore. لا تُضف مفتاح خدمة أو كلمة مرور أو service-account إلى المتغيرات الأمامية أو المستودع.
5. بعد مراجعة المشروع الذي تم تأكيده، انشر الوظائف والقواعد فقط إلى ذلك المشروع من بيئة نشر مخولة:

```bash
firebase deploy --only firestore:rules,functions --project "$VITE_FIREBASE_PROJECT_ID"
```

هذا الأمر يغير خدمات مشروع Firebase خارجي؛ لا تنفذه قبل موافقة مالك المشروع على المعرّف والأثر والتكلفة. لا يُفعّل Firebase Hosting؛ استضافة الواجهة مستقلة على GitHub Pages.
6. أنشئ حساب إدارة موثوقًا في Firebase Authentication، ثم أضف يدويًا سجلًا خاصًا `admins/{uid}` بقيمة `{ "active": true }` بعد التحقق من UID. لا يوجد حساب مدير افتراضي أو مسار تسجيل إدارة ذاتي.
7. اختبر بحسابات اختبار غير حقيقية تدفقات التسجيل والدخول وتوثيق البريد وطلب المدرس والرفض والاعتماد وموافقة النشر، وتحقق من القواعد في Emulator قبل المشروع الحي. لا تستخدم سجلات الطلاب الحقيقيين للاختبار.

## اختبارات وبناء

```bash
pnpm test
pnpm test:rules
pnpm build
npm test --prefix functions
```

`pnpm test:rules` يشغل Firebase Firestore Emulator للاختبارات؛ نجاح اختبارات الوحدات وحدها لا يثبت إعداد Firebase حيًا. صفحة المدرسين ورسائل الدخول التي تذكر غياب إعداد Firebase تظل متوقعة إلى أن تُضبط إعدادات العميل وتنشر الخدمات المطلوبة.
