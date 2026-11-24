# منصة مدرسة التناغة الشرقية الثانوية

منصة تعليمية متكاملة لمناهج المرحلة الثانوية — دروس، فيديوهات، واجبات، امتحانات، حضور، ومتابعة لأولياء الأمور.

## المميزات

- **أدوار متعددة**: طالب · مدرس · ولي أمر · إدارة
- **محتوى دراسي** حسب الصف والمادة (روابط https آمنة)
- **امتحانات إلكترونية** بتصحيح تلقائي ومفتاح إجابات محمي
- **تسجيل حضور** ونسب للطالب وولي الأمر
- **ربط ولي الأمر** بكود من حساب الطالب
- **إشعارات** حسب الصف
- **مساعد ذكي** (Claude) اختياري عبر Cloud Functions
- **PWA** قابلة للتثبيت على الموبايل
- **وضع داكن فاخر** بتصميم عربي RTL

## التشغيل السريع

1. أنشئ مشروع Firebase من [console.firebase.google.com](https://console.firebase.google.com)
2. فعّل **Authentication** (Email/Password)
3. أنشئ **Firestore** في وضع Production
4. انسخ قيم الإعدادات في `public/firebase-config.js`
5. انشر القواعد: انسخ محتوى `firestore.rules` في Firebase Console → Publish
6. ارفع الموقع:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add   # اختر مشروعك
   firebase deploy
   ```
7. سجّل حسابًا عاديًا، ثم من Firestore غيّر `role` إلى `admin` لحسابك

تفاصيل أكثر في [`SETUP.md`](SETUP.md) و[`TEST.md`](TEST.md).

## هيكل المشروع

```
tanaga-platform/
├── public/                 # الواجهة (Hosting)
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── firebase-config.js  # ← ضع قيم مشروعك هنا
│   ├── sw.js               # Service Worker (PWA)
│   ├── manifest.webmanifest
│   └── assets/
├── functions/              # Cloud Functions (المساعد الذكي)
├── firestore.rules         # قواعد الأمان
├── firebase.json
├── SETUP.md
└── TEST.md
```

## الأمان

- لا توجد مفاتيح سرية في الواجهة
- قواعد Firestore صارمة (امتحانات، تسليمات، أدوار)
- روابط المحتوى https فقط
- يُنصح بتفعيل App Check (reCAPTCHA v3)

## الترخيص

للاستخدام الخاص بمدرسة التناغة الشرقية الثانوية المشتركة.
