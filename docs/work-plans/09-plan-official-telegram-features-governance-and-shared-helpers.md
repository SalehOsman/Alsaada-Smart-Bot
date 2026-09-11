# 📋 خطة العمل رقم 09: حوكمة وتوثيق مميزات تليجرام الرسمية المتقدمة وبناء محرك الوظائف المشتركة
## Telegram Bot API 7.0+ Native Features Governance, Core Engine Helpers & Documentation Charter

> [!IMPORTANT]
> **ميثاق الحوكمة ومرجعية الخطة:**
> بناءً على التوجيه المعتمد، تُوثق هذه الخطة المعايير الإلزامية لاستخدام مميزات تليجرام الرسمية المتقدمة (Telegram Bot API 7.0 - 8.0+)، وتحدد حزمة الوظائف البرمجية المشتركة في النواة (`packages/core-components`) لاستدعائها بيسر ومنع أي تكرار كودي عبر كافة الموديولات والتدفقات.

---

### 1️⃣ الأهداف والمخرجات الرئيسية (Core Deliverables)

1. **التوثيق الحتمي والملزم في وثائق المشروع:**
   - تحديث وثيقة تصميم التجربة رقم 22 (`docs/22-telegram-ux-ui-design-system-and-ergonomics.md`) بالمعايير والضوابط الصارمة للمميزات الست.
   - تحديث كتالوج المكونات المشتركة رقم 02 (`docs/02-core-shared-components-catalog.md`) بإضافة "محرك مميزات وتنسيقات تليجرام المتقدمة".
   - تحديث دستور ومنهجية العمل (`AGENTS.md` و `GEMINI.md`) تحت بند "قاعدة الإلزام الحتمي بالنواة المشتركة (Section 2.5)" بحظر كتابة هذه التنسيقات يدوياً وإلزامية الاستيراد من `@alsaada/core-components`.
2. **بناء وتوسيع محرك الوظائف المشتركة في النواة (`packages/core-components`):**
   - تطوير واجهات معيارية لكافة المميزات الست داخل `packages/core-components/src/formatting/telegram-formatters.ts`.
   - تصديرها عبر الفهرس العام `packages/core-components/src/index.ts`.
3. **التطوير الموجه بالاختبارات (TDD & Full Coverage):**
   - كتابة اختبارات شاملة لكافة الوظائف والحالات الحدية (Edge Cases) في `packages/core-components/tests/telegram-formatters.spec.ts`.
4. **تحديث فهرس خطط العمل المعتمدة:**
   - قيد الخطة في `docs/work-plans/README.md` وتحديث نسبة الإنجاز وحالة التنفيذ.

---

### 2️⃣ جدول مواصفات المميزات الرسمية والوظائف المشتركة المقترحة

| # | الميزة الرسمية في Telegram Bot API | الوظيفة البرمجية المشتركة في النواة | الغرض وحالات الاستخدام الإلزامية |
| :---: | :--- | :--- | :--- |
| **1** | **الاقتباسات المطوية<br>(Expandable Blockquotes)** | `formatExpandableQuote(text, mode?)` | طي النصوص الإرشادية الطويلة، تفاصيل اللوائح، وسجلات APM لتظهر في سطرين مع زر سهم للتوسيع. |
| **2** | **النسخ السريع بنقرة واحدة<br>(Click-to-Copy Code Formatting)** | `formatClickToCopy(code)`<br>`formatMonospace(code)`<br>`buildCopyTextButton(text, code)` | تغليف كود العامل، رمز التوكن السري، رقم الحوالة، والرقم القومي بوسم `<code>...</code>` لنسخها بلمسة واحدة، أو زر `copy_text`. |
| **3** | **إخفاء البيانات بالتشويش التفاعلي<br>(Collapsible Spoilers)** | `formatSpoiler(text, mode?)` | تغليف الرواتب، أرصدة الخزينة، والأرقام القومية بوسم التشويش `||...||` أو `<tg-spoiler>` لحمايتها ميدانياً. |
| **4** | **نوافذ التنبيه المنبثقة السيادية<br>(Show Alert Modals)** | `showModalAlert(ctx, text)`<br>`buildModalAlertOptions(text)` | فتح نافذة حوارية رسمية على شاشة الهاتف تتطلب الضغط على "حسناً" عند حظر الصلاحيات (RBAC) أو تجاوز الحدود المالية. |
| **5** | **كبح معاينات الروابط المشوهة<br>(Link Preview Options)** | `DISABLED_LINK_PREVIEWS`<br>`buildLinkPreviewOptions(disabled?)` | تمرير `{ link_preview_options: { is_disabled: true } }` عند إرسال روابط واتساب أو خرائط للحفاظ على نظافة الشاشة وموقع الأزرار. |
| **6** | **مؤشرات المعالجة التفاعلية<br>(Chat Action Indicators)** | `sendChatActionSafe(ctx, action)`<br>`withChatAction(ctx, action, task)` | إرسال نبضات "جاري رفع مستند" أو "جاري الكتابة" تلقائياً أثناء العمليات الطويلة (تصدير إكسيل أو استدعاءات الذكاء الاصطناعي). |

---

### 3️⃣ خطة التنفيذ خطوة بخطوة (Execution Steps)

#### الخطوة 1: بناء وتوسيع محرك النواة المشتركة
- تعديل `packages/core-components/src/types.ts` لدعم أنواع الـ ChatAction وخيارات التنبيه المنبثق.
- تطوير دوال المساعدة في `packages/core-components/src/formatting/telegram-formatters.ts`.
- تصدير الدوال عبر `packages/core-components/src/index.ts`.

#### الخطوة 2: كتابة وتوسيع اختبارات الـ TDD
- تحديث `packages/core-components/tests/telegram-formatters.spec.ts` لتغطية:
  * `formatClickToCopy` (تنسيق الكود، معالجة المدخلات الفارغة).
  * `showModalAlert` و `buildModalAlertOptions`.
  * `DISABLED_LINK_PREVIEWS` و `buildLinkPreviewOptions`.
  * `sendChatActionSafe` و `withChatAction` (محاكاة المهام غير المتزامنة والمؤقتات).

#### الخطوة 3: تحديث وثائق الحوكمة والتصميم
- تحديث `docs/22-telegram-ux-ui-design-system-and-ergonomics.md` بالبنود الصريحة والشاشات الملزمة.
- تحديث `docs/02-core-shared-components-catalog.md` بالقسم الجديد.
- تحديث `AGENTS.md` و `GEMINI.md` بقاعدة الاستيراد الصارمة.

#### الخطوة 4: الفحص الشامل والاعتماد
- تشغيل `pnpm typecheck` والتأكد من خلوه من أي خطأ تجميع.
- تشغيل كافة اختبارات الحزم والموديولات `pnpm vitest run`.
- تشغيل فواحص الحوكمة `pnpm governance:verify`.
- تسجيل الـ Commit وتحديث جدول الخطط في `docs/work-plans/README.md`.

---

### 4️⃣ مصفوفة التحقق والجاهزية (Verification Checklist)

- [x] بنود المميزات الست موثقة في `docs/22`
- [x] بنود الاستدعاء موثقة في `docs/02`
- [x] قاعدة الاستيراد موثقة في `AGENTS.md` و `GEMINI.md`
- [x] الدوال المشتركة مبنية ومصدرة في `packages/core-components`
- [x] اختبارات الـ Unit Tests تعمل بنجاح 100%
- [x] الفحص الصارم `tsc --noEmit` ينتهي بـ `Exit 0`
- [x] قفل الحوكمة واختبارات الـ Pre-commit تجتاز بنجاح (تم الدمج في PLAN-10)
