# دليل Study Crew (قواعد الشخصيات والحركة والتنفيذ)

هذا الملف هو المرجع الوحيد لنظام الشخصيات. الكود في `src/studycrew/`، والأنماط في `styles/studycrew.css`، والتجربة في `studycrew-demo.html` (تعمل مع `pnpm dev` فقط ولا تدخل في البناء).
الحالة الآن: **إطار عمل كامل بشخصيات بديلة (Placeholders) مرسومة بالكود**. لا يوجد رسم نهائي ولا ملف Rive ولا Lottie بعد، ولا شيء مربوط بصفحات الموقع.

## 1. الشخصيات وأدوارها

| الشخصية | الدور | أين تظهر | النبرة |
|---|---|---|---|
| Alex (أليكس) ثعلب الفنك المتخرج | الوجه الرئيسي | الرئيسية، البحث، المساعد الذكي، لوحة الطالب، 404 | مرحة وذكية |
| Arthur (آرثر) الكتاب | المعرفة والهدوء | الدخول وإنشاء الحساب والاستعادة، لوحتا المعلم وولي الأمر، خطأ الخادم | هادئة وواضحة ورسمية قليلا |
| Oscar (أوسكار) القلم | الحلول والتشجيع | الواجبات، الامتحانات، التصحيح، رفع الواجبات | نشيطة ومشجعة |
| Leo (ليو) الفانوس | الإشعارات والهدوء | الإشعارات، انقطاع الشبكة | هادئة ومطمئنة |
| Chloe (كلوي) اللوتس | النمو والإنجاز | النتائج، الإنجازات، الشارات | لطيفة ومحفزة |

القاعدة الذهبية: الشخصية تظهر فقط إذا أضافت قيمة. لا ازدحام، ولا حركة دائمة، ولا تغطي حقلا أو زرا. المعلومة المهمة دائما نص حقيقي.
نشاط كلمة المرور (غطاء العينين) لآرثر فقط، في الدخول وإعادة التعيين، وليس في إنشاء الحساب. إعادة التعيين رابط يصل بالبريد (Firebase) وليس رمزا.

## 2. الحالات (States)

`Idle, Thinking, Reading, Searching, Typing, Loading, Success, Error, Celebrate, Sleep, Wake, Wave, HiddenPassword, VisiblePassword`
(`src/studycrew/Shared/stateMachine.js`). الأولوية: **Error (100) > Success (80) > Celebrate (60) > Loading وما يشبهه (30) > Sleep (10) > Idle (0)**. الحالة الأقل لا تقطع حالة أعلى ولا حالة قصيرة قيد التشغيل. الحالات القصيرة (Success, Error, Celebrate, Wake, Wave) تنتهي وحدها وترجع للراحة. الحالات المستمرة (Loading, Thinking...) تنتهي بـ `finish(state)`.
حدث الإشعار أقل من الخطأ والنجاح والإنجاز. لا شخصيتان في نفس المكان (Slots في `Shared/slots.js`): الأعلى أولوية تأخذ المكان.

## 3. الاستخدام

```js
import {mountCharacter, LoadingScene, ErrorAnimation, AchievementBanner} from '/src/studycrew/index.js';
const ctrl = await mountCharacter(hostEl, 'oscar', {state: 'Idle', slot: 'main'});
ctrl.request('Success');      // يرجع true إذا قُبل الطلب
ctrl.finish('Loading');
ctrl.destroy();               // يفرّغ كل شيء
const err = ErrorAnimation({characterId: 'arthur', message: 'حصلت مشكلة عندنا.', retry: {label: 'حاول تاني', onClick}});
container.append(err.el);     // err.destroy() عند المغادرة
```
المكونات: `CharacterCard, MascotBubble, SuccessAnimation, ErrorAnimation, LoadingScene, NotificationCharacter, AchievementBanner, CelebrationOverlay`. كلها مبنية على `makeScene()` في `Shared/components.js` (مسار واحد للتركيب والسلوك والوصول والتنظيف).
لا يُستورد الإطار من `src/app.js` الآن. عند الدمج يُستورد بشكل كسول (`import()`) في الصفحة التي تحتاجه فقط.

## 4. البنية (فصل صارم)

```
src/studycrew/
  Shared/       المنطق: config, logger, stateMachine, idleScheduler, characterManager,
                animationManager, assetLoader, adapters (Rive/Lottie), placeholder, components, audio, haptics, prefs, slots, eyeTracker, connection
  Characters/   Alex/ Arthur/ Oscar/ Leo/ Chloe/ (manifest.js + index.js + الأصول) و registry.js
  Animations/   مقاطع مشتركة بين الشخصيات
  Sounds/       أصوات مسجلة إن وُجدت (الحالية مولّدة بالكود)
  Icons/        شعارات وأيقونات صغيرة
  Effects/      التأثيرات (confetti)
  Themes/       tokens.js (المصدر الوحيد للقيم) و index.js (نظام السمات)
```
قاعدة: أي قيمة (لون، مدة، حد، مفتاح تخزين) تُكتب مرة واحدة: بصريا في `Themes/tokens.js`، وتشغيليا في `Shared/config.js`. الاختبارات تفشل إذا استخدم CSS متغيرا غير معرّف.

## 5. القيم المركزية (Design Tokens)

`Themes/tokens.js`: ألوان (ذهبي/كحلي الموقع + ألوان الشخصيات)، خطوط، أنصاف أقطار، مسافات، ظلال، لمعان وتوهج، مدد الحركة، منحنيات، أحجام. تُكتب كمتغيرات `--sc-*` بـ `applyTokens()`. سمة جديدة: `registerTheme('اسم', {color: {...}})` وتُفعّل بـ `setTheme('اسم')`.

## 6. الحركة

- التحريك بـ `transform` و`opacity` فقط. لا تحريك للأبعاد أو الهوامش أو الموضع.
- المدد من الجدول: دقيقة 100-180ms، أزرار 120-180، بطاقات 180-240، نوافذ 220-320، شخصيات 300-500، احتفالات 700-1200 (مقدّرة في `tokens.motion`).
- 32 حركة خمول لكل شخصية: 12 مشتركة (`Shared/idles.js`) + 20 خاصة (في manifest كل شخصية). الاختيار عشوائي موزون، **لا نفس الحركة مرتين متتاليتين، ولا من آخر 5، والحركات الكبيرة تهدأ 90 ثانية**. التنفس طبقة دائمة وليس مقطعا.
- التصعيد: 30 ثانية خمول، 60 تلويح، 90 حركة عشوائية أكبر.
- تتبع العين: مستمع واحد مشترك (`eyeTracker.js`)، بالأولوية: نافذة، حقل يُكتب فيه (ليس كلمة المرور)، زر مهم (`data-crew-target`)، المؤشر. لا تتبع على اللمس المستمر.
- الإيقاف التلقائي: عند إخفاء التبويب، أو تقليل الحركة (النظام أو إعداد `motion:'off'`)، أو الجهاز الضعيف (خمول فقط).

## 7. الأداء والذاكرة

- ميزانية (مقترحة، تُضبط بعد القياس): ملف الشخصية 400KB، أول تحميل 150KB، الإطار 12KB مضغوطا، صوت 30KB، شخصيتان حيتان كحد أقصى، 40 جسيما (`Shared/config.js`).
- كل شخصية ملف كسول مستقل (`Characters/registry.js` استيراد ديناميكي). لا تُحمّل إلا عند الحاجة، و`destroy()` يلغي المؤقتات والمستمعات والرسوم ويزيل العناصر.
- `assetLoader.js`: جلب واحد لكل رابط، كاش LRU محدود، فحص الحجم، لا يكسر الصفحة. `preloadAssets()` وقت الخمول لما هو مهم فقط (`CONFIG.preload.important`).
- `npm run crew:check` (أو `pnpm crew:check`): يفحص حجم وامتداد أي ملفات فنية ويطبع نصائح التحسين.
- مكتبة Rive (WASM) غير مضافة. تُحمّل كسولا من رابط في `manifest.renderer.rive.runtimeUrl` فقط عند وجود ملف `.riv`.

## 8. الوصول والاستجابة والأخطاء

- الشخصية زخرفية (`aria-hidden`)، النص الحقيقي في `role="status"` أو `role="alert"`، ولا معلومة تعتمد على لون أو حركة فقط.
- أزرار بحجم 44px على الأقل، `:focus-visible` ظاهر، لوحة المفاتيح تعمل.
- الهاتف: شخصية أصغر وحركة أقل، ولا تغطي حقولا أبدا (البالونات في ركن بدون `pointer-events`).
- لا اتصال: `watchConnection()` + `NotificationCharacter` (ليو يخفت ثم يتعافى).
- فشل أي أصل أو شخصية: يسقط إلى الشخصية البديلة ويُسجَّل بهدوء في `logger.js` (لا استثناء يصل للصفحة). تجاوز حد الشخصيات الحية أو المكان المشغول: لا تظهر الشخصية وتُسجَّل.
- الصوت: مولّد بالكود، **مغلق افتراضيا**، صوت واحد في كل مرة وفاصل أدنى بينهما. الاهتزاز: خفيف عند النجاح وصغير عند الخطأ، مغلق افتراضيا. الإعدادات في `prefs.js` (`setPrefs({sound:true})`).

## 9. كيف تستبدل البديل بالرسم النهائي (بدون تغيير منطق)

1. ضع الملف في `Characters/<Name>/` (مثلا `alex.riv` أو `alex.lottie.json`) داخل الميزانية.
2. عدّل `manifest.js` فقط:
   - Rive: `renderer:{type:'rive', rive:{src:'/path/alex.riv', runtimeUrl:'<رابط runtime>', stateMachine:'Crew'}}`
   - Lottie: `renderer:{type:'lottie', lottie:{src:'/path/alex.json', runtimeUrl:'<رابط lottie>', segments:{Idle:[0,60]}}}`
3. للتبديل بين Rive وLottie غيّر هذا الحقل فقط. الواجهة المطلوبة من أي renderer: `setState(name), play(recipe), look(x,y), pause(), resume(), destroy()` (`Shared/adapters.js`).
4. شغّل `pnpm crew:check` و`pnpm test`.
تنبيه: المحوّلات (adapters) لم تُجرَّب مع ملفات حقيقية لأنها غير موجودة بعد. اختبرها عند وصول أول ملف.

## 10. كيف تضيف شخصية جديدة

1. أنشئ `Characters/<Name>/` فيها `manifest.js` (id, name, ar, role, shape أو renderer, palette, speed, idles ×20) و`index.js` يصدّر الافتراضي.
2. أضف سطرا واحدا في `Characters/registry.js`.
3. لا تغيّر أي ملف آخر. الاختبارات تفحص أن لها 20 حركة خمول بأسماء وصفات (recipes) معروفة.
4. اتبع نفس الألوان والحركة والأداء. اطلب مراجعة هوية قبل الاستخدام في الواجهة.

## 11. قائمة فحص الجودة (لكل شخصية وحركة)

- بصري: الصورة الظلية واضحة، العينان والفم واضحان، لا قص، يعمل في الداكن والفاتح.
- أداء: 60fps على جهاز متوسط، لا إعادة تخطيط (Layout)، الحجم داخل الميزانية، `pnpm crew:check` ناجح.
- استخدام: لا تغطي محتوى، تُقرأ على الهاتف، تقليل الحركة يعطي وجها ثابتا مفهوما.
- اتساق: نفس الإيقاع والمرونة والوزن ومنحنيات الحركة (دليل نظام الحركة).
- سرعة التحميل: كسول، ملف واحد لكل شخصية، أول تحميل داخل 150KB.
- متصفحات وأجهزة: Chrome وSafari وFirefox على iOS وAndroid، شاشة 60 و120Hz، جهاز ضعيف. **هذا لم يُختبر بعد.**

## 12. ما لم يُتحقق منه

لم يُختبر شيء على جهاز حقيقي أو على Firebase الحي. لا يوجد رسم نهائي ولا ملف Rive ولا Lottie. محوّلات Rive وLottie غير مجرَّبة. أرقام الميزانية والمدد مقترحات للضبط. أسماء الشخصيات لم تُفحص كعلامات تجارية.
