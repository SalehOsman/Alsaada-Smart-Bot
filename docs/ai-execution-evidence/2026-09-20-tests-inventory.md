# 📊 تقرير الجرد الشامل والنهائي لمنظومة الاختبارات (Enterprise Test Suite Inventory)
**تاريخ الفحص والتدقيق الميداني:** 20 سبتمبر 2026  
**المستودع:** `F:\Alsaada-Smart-Bot`  
**الفرع الحالي:** `plan/86-core-financial-and-security-hardening`  
**محرك الفحص المستخدم:** `vitest/3.2.7` + `typescript/5.9.3 AST Analyzer`  
**الحالة العامة للمنظومة:** 🟢 **235 ملف اختبار — جميعها مشغلة بنسبة 100% (Zero Unrun Tests)**

---

## 1️⃣ جدول الملخص الإحصائي العام (Executive Summary)

| المؤشر | القيمة الفعلية | الملاحظات والبيان |
| :--- | :--- | :--- |
| **إجمالي ملفات الاختبار المكتشفة في المستودع** | **235 ملف** | 229 ملف tracked في Git + 6 ملفات untracked مستحدثة في Plan 86 |
| **الملفات المكتشفة بالأنماط القياسية (`*.spec.ts`)** | **235 ملف** | تطابق تام مع معيار التسمية الموحد للمنظومة |
| **الملفات المخفية المكتشفة بأكواد اختبار (`describe/it/test`)** | **0 ملف** | لا توجد أي أجنحة اختبار مكتوبة خارج النمط القياسي |
| **الملفات المشغلة فعلياً بواسطة Vitest Runner** | **235 ملف (100%)** | تتطابق بنسبة 100% مع نمط الاشتمال `**/tests/**/*.spec.ts` |
| **الملفات غير المشغلة (Unrun Tests)** | **0 ملف (0%)** | لا يوجد أي ملف اختبار مهمل أو مستبعد |
| **إجمالي أجنحة الاختبار (`describe` AST Blocks)** | **553 كتلة** | محصاة عبر فحص شجرة الرموز المجردة (AST CallExpressions) |
| **إجمالي حالات الاختبار المفردة (`it / test` AST Count)** | **1,820 حالة** | كتل الاختبار المصرح بها في الشفرة البرمجية (كانت 1,797 حالة فعالة أثناء حادثة تلف ملف branded-types المؤقتة: 1,820 - 23) |
| **إجمالي الاختبارات المشغلة تجميعياً (`Vitest Runner Collected`)** | **1,922 اختباراً** | تشمل التوسعات البارامترية (`it.each`) والمولدات الديناميكية (كانت 1,899 أثناء حادثة التلف: 1,922 - 23) |
| **إجمالي جمل التوكيد والتحقق (`expect` Assertions)** | **6,792 توكيد** | متوسط 3.73 توكيد لكل حالة اختبار فردية (تم التحقق بـ AST 5.9.3) |
| **إجمالي الاختبارات المعطلة أو المتخطاة (`skips / xit / todo`)** | **0 تخطي (Zero Skips)** | التزام صارم بحظر تخطي الاختبارات |
| **إجمالي المحاكيات البرمجية (`vi.mock / jest.mock`)** | **53 محاكاة** | محصورة في طبقات العزل (38 في البوت، 13 في الداشبورد، 2 حوكمة) |
| **الملفات المحتوية على خطافات تهيئة (`beforeAll/beforeEach`)** | **54 ملف** | لإعداد وتصفية السياق، عزل المعاملات، وتنظيف قواعد البيانات |
| **الملفات ذات المهلة المخصصة (`custom timeouts`)** | **9 ملفات** | 3 ملفات بمهلة Vitest صريحة على مستوى الاختبار + 6 ملفات بمحاكاة مهلات غير متزامنة |

---

## 2️⃣ توزيع الاختبارات حسب الموديولات والحزم (Workspace Breakdown)

| الحزمة / الموديول / التطبيق | المسار | عدد الملفات | describe | it / test | expect | vi.mock |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **لوحة التحكم الإدارية** | `apps/admin-dashboard` | **30** | 116 | 325 | 1,214 | 13 |
| **سيرفر بوت تليجرام** | `apps/bot-server` | **29** | 90 | 264 | 1,045 | 38 |
| **بوابة التوثيق التفاعلية** | `apps/docs` | **1** | 1 | 9 | 53 | 0 |
| **موديول الإعدادات العامة** | `modules/settings` | **60** | 64 | 184 | 558 | 0 |
| **موديول القوى العاملة** | `modules/workforce` | **46** | 82 | 286 | 1,310 | 0 |
| **محرك معالجة الصور بالذكاء الاصطناعي** | `packages/ai-vision-engine` | **1** | 1 | 13 | 51 | 0 |
| **مكتبة المكونات النواة المشتركة** | `packages/core-components` | **26** | 86 | 219 | 831 | 0 |
| **حزمة قاعدة البيانات وقيد التدقيق المالي** | `packages/database` | **13** | 27 | 134 | 431 | 0 |
| **محرك الرقم القومي المصري** | `packages/national-id-engine` | **1** | 1 | 14 | 58 | 0 |
| **محرك الصلاحيات والأدوار (RBAC)** | `packages/rbac` | **3** | 14 | 49 | 168 | 0 |
| **المحرك الإقليمي العربي والتوقيت** | `packages/regional-engine` | **2** | 6 | 20 | 51 | 0 |
| **نواة القياس والملاحظة والتتبع (APM)** | `packages/telemetry` | **7** | 33 | 116 | 387 | 0 |
| **أدوات الحوكمة وفحص النزاهة الجنائية** | `tools/governance` | **16** | 32 | 187 | 635 | 2 |
| **المجموع الإجمالي (Total)** | — | **235** | **553** | **1,820** | **6,792** | **53** |

---

## 3️⃣ مصدر الحقيقة الرسمي لإعدادات الاختبارات (Official SSOT Configuration)

### أ. ملف الإعدادات المركزي: `vitest.config.ts`
- **مسار الملف:** `F:\Alsaada-Smart-Bot\vitest.config.ts`
- **بيئة التشغيل (Environment):** `node`
- **أنماط الاشتمال (Include Pattern):**
  ```ts
  include: [
    '**/tests/**/*.spec.ts',
  ]
  ```
- **أنماط الاستبعاد (Exclude Pattern):** لا توجد استبعادات مخصصة داخل الإعداد؛ تُطبق الاستبعادات الافتراضية لمحرك Vitest:
  - `**/node_modules/**`
  - `**/dist/**`
  - `**/cypress/**`
  - `**/.{idea,git,cache,output,temp}/**`
  - `**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*`
- **المهلة الافتراضية للاختبار (testTimeout):** `35,000ms` (35 ثانية)
- **المتغيرات البيئية المحقونة افتراضياً:**
  - `DATABASE_ENCRYPTION_KEY`
  - `DATABASE_URL`
- **الأسماء المستعارة (Aliases):**
  - `@` -> `./apps/admin-dashboard/src`

### ب. فحص إعدادات الحزم الفرعية
- لا توجد أي ملفات إعدادات مستقلة (`vitest.workspace.ts` أو `vitest.config.ts` محلية) داخل أي من حزم `packages/*` أو موديولات `modules/*` أو تطبيقات `apps/*`.
- يعتمد المستودع بالكامل على **الإعداد المركزي الموحد (Unified Root Vitest Engine)** لتشغيل كافة اختبارات الحزم والموديولات بتناغم وسرعة فائقة.

---

## 4️⃣ قائمة بارزة: اختبارات موجودة لكن لا تُشغَّل (Unrun Tests Audit)

> ### 🟢 النتيجة القطعية للفحص الجنائي الميداني:
> **لا توجد أي اختبارات مهملة أو غير مشغلة نهائياً في كامل مستودع المشروع (Zero Unrun Tests).**
> 
> - **نسبة التغطية والتشغيل:** **100.0%** (235 ملف من أصل 235 ملف).
> - **أسباب الاستبعاد:** `0` ملفات مستبعدة (خارج include: صفر | داخل exclude: صفر | إعدادات مفقودة: صفر).
> - **فحص الملفات غير القياسية (Negative Discovery):**
>   - تم فحص جميع الملفات المصدرية بالامتدادات (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`) والبالغ عددها 852 ملفاً.
>   - لم يُعثر على أي ملف كود تنفيذي يحتوي على `describe(` أو `it(` أو `test(` خارج مجلدات `**/tests/**`.
>   - الملفات الوحيدة غير القياسية التي أظهرت تطابقاً ظاهرياً هي:
>     1. `packages/database/src/generated/client/runtime/react-native.js` و `wasm-engine-edge.js`: كود مولد مضغوط من Prisma Client حيث تم استخدام المعرف `it` كاسم متغير أو دالة داخلية مصغرة (`minified symbol`)، وليست دوال اختبار. (وهذا المسار مدرج بالفعل في `.gitignore`).
>     2. `tools/scaffold/scaffold-dashboard.ts`, `tools/scaffold/scaffold-flow.ts`, `tools/scaffold/scaffold-module.ts`: نصوص قوالب توليد برمجية (`Code Generation Template Strings`) لتوليد ملفات الاختبارات الجديدة وليست كود اختبار تنفيذي.
>     3. وثائق التصميم في `docs/superpowers/specs/*.md`: ملفات توثيق بصيغة Markdown طابقت مجلد `specs/` ولكنها وثائق هندسية وليست شفرة برمجية.

### 🔍 التوثيق الجنائي لحادثة الملف التالف المؤقتة (Corrupted File Forensic Incident):
- **الملف المتأثر:** `packages/core-components/tests/branded-types.spec.ts`
- **وقت الرصد الجنائي:** 20 سبتمبر 2026 الساعة 04:20:50
- **طبيعة العطل:** تم العثور على الملف محتوياً على ناتج تفريغ JSON خام بحجم **508 كيلوبايت (512,634 بايت، 7,674 سطراً)** نتيجة إعادة توجيه ناتج تشغيل سابق لأمر `vitest list --json` إلى مسار الملف بدلاً من مسار مجلد التجريب `scratch/`.
- **الأثر الميداني أثناء وجود العطل:**
  - لم يتعرف محرك Vitest على أي اختبار داخل الملف وجمع منه **0 اختبارات**.
  - انخفض عدد الملفات المشغلة فعلياً مؤقتاً إلى **234 ملفاً**.
  - انخفض إجمالي الاختبارات المجمعة من 1,922 إلى **1,899 اختباراً** (فارق 23 اختباراً).
  - انخفضت كتل AST الفعالة من 1,820 إلى **1,797 حالة اختبار فعالة** (فارق 23 اختباراً).
- **المعالجة والتحقق النهائي:**
  - تمت استعادة الملف بنجاح إلى شفرته البرمجية الصحيحة وتوسيعه باختبارات التحصين الشاملة في الخطة 86 ليبلغ حجمه النهائي **27,192 بايت (709 أسطر)**.
  - يحتوي الملف بشكله النهائي المعتمد على **8 كتل describe، و 23 حالة اختبار it، و 151 توكيد expect** (بعد إضافة تحصينات حدود `UniversalInstallmentEngine` و `UniversalShiftAccrualEngine` في الأسطر 576-709).
  - تم تشغيل أمر الفحص الميداني: `npx vitest list --run packages/core-components/tests/branded-types.spec.ts` وجمع بنجاح كافة الاختبارات الـ **23 كاملة بنسبة 100%**.
  - عادت المنظومة بالكامل للعمل بنسبة 100% (235 ملفاً مجمعاً بالكامل عبر Vitest تجمع 1,922 اختباراً).

---

## 5️⃣ مقارنة مع آخر تشغيل معروف وبيان الفروق (Baseline Comparison & Delta Analysis)

### أ. بيانات المقارنة الشاملة

| المتغير | خط الأساس السابق (Baseline) | حالة الفحص الجنائي الوسيطة | الواقع الميداني المستقر الحالي | الفارق الصافي (Net Delta) | سبب الفارق والتحليل الدقيق |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **عدد ملفات الاختبار** | **232 ملف** | **234 ملف** | **235 ملف** | **+3 ملفات** | 229 ملف tracked في Git + 6 ملفات untracked مستحدثة في Plan 86 = 235 ملفاً |
| **حالات الاختبار المجمعة (Vitest)** | **1,896 اختباراً** | **1,899 اختباراً** | **1,922 اختباراً** | **+26 اختباراً** | +19 اختباراً من الملفات الـ 3 المستحدثة، و +4 اختبارات تحصين في `branded-types.spec.ts`، و +3 اختبارات أضيفت إلى الاختبارات القائمة |
| **كتل AST المصرح بها (`it/test`)** | — | **1,797 حالة فعالة** | **1,820 حالة مصرحة** | — | الفرق (23 حالة) هو كتل اختبار `branded-types.spec.ts` بعد استعادتها وتحصينها |
| **توكيدات التحقق (`expect`)** | — | 6,641 توكيد | **6,792 توكيد** | **+151 توكيد** | إضافة وتثبيت توكيدات `branded-types.spec.ts` البالغة 151 توكيداً |
| **الملفات ذات المهلات المخصصة** | 3 ملفات (Vitest) | 9 ملفات (شاملة) | **9 ملفات** | — | 3 ملفات بمهلة Vitest صريحة + 6 ملفات بمحاكاة تأخير غير متزامن |

### ب. تفصيل الملفات الـ 6 المستحدثة في فرع Plan 86:
1. `packages/core-components/tests/branded-types.spec.ts` (23 اختباراً: 19 أساسية + 4 تحصينات حدود) — فحص أمان الأنواع الاسمية Branded Types للعمليات المالية وحدود الأقساط وحسابات الورديات.
2. `tools/governance/tests/verify-boundary-deserialization.spec.ts` (6 اختبارات) — فحص صمام منع حقن الحقول غير المصرح بها عند الحدود.
3. `tools/governance/tests/verify-rbac-invariants.spec.ts` (7 اختبارات) — فحص المتغيرات الثابتة لصلاحيات النظام.
*(هذه الملفات الثلاثة مع النسخة الأولية لـ branded-types رفعت الأساس السابق من 229 ملفاً إلى 232 ملفاً و 1,896 اختباراً)*.

**ثم أضيفت الملفات الثلاثة التالية واكتملت تحصينات الخطة 86:**
4. `apps/bot-server/tests/outbox-circuit-breaker.spec.ts` (9 اختبارات) — فحص قاطع الدائرة الثلاثي وضمان عدم ضياع الأحداث Outbox Daemon.
5. `packages/database/tests/hmac-keyring.spec.ts` (5 اختبارات) — فحص حلقة مفاتيح HMAC والتدوير التشفيري للمفاتيح على مدار 90 يوماً.
6. `packages/database/tests/transactional-rls.spec.ts` (5 اختبارات) — فحص عزل مستوى السجلات (RLS) ومطابقة حدود المواقع في المعاملات.
*(مجموع الاختبارات الجديدة: 9 + 5 + 5 = 19 اختباراً من الملفات الثلاثة، بالإضافة إلى +4 اختبارات في branded-types و +3 اختبارات في الملفات المعدلة، رفعت إجمالي الاختبارات المشغلة من 1,896 إلى 1,922 اختباراً عبر 235 ملف اختبار)*.

### ج. تفصيل الملفات الـ 9 ذات المهلات المخصصة (Custom Timeouts Breakdown):
1. **الملفات المحددة لمهلة صريحة على مستوى مشغل الاختبار Vitest (`it(..., fn, timeout)`):**
   - `apps/docs/tests/docs-portal.spec.ts`: مهلة مخصصة **360,000ms (6 دقائق)** لتوليد وبناء بوابة التوثيق التفاعلية وفهرس البحث Pagefind.
   - `packages/core-components/tests/sovereign-auto-loader.spec.ts`: مهلة مخصصة **90,000ms (90 ثانية)** لاختبار التحميل الآلي الميداني للتدفقات.
   - `tools/governance/tests/agent-dispatcher.spec.ts`: مهلات مخصصة **35,000ms و 15,000ms** لاختبارات توجيه وتنسيق وكلاء الذكاء الاصطناعي.
2. **الملفات المستخدمة لمحاكاة تأخير زمني صريح (`setTimeout` / async sleep timers):**
   - `apps/bot-server/tests/error-vault-and-telemetry.spec.ts`: مهلة تأخير 10ms لمحاكاة المعالجة غير المتزامنة.
   - `apps/bot-server/tests/fast-cache.benchmark.spec.ts`: مهلات تأخير 1100ms و 50ms و 100ms لفحص انقضاء وقت الذاكرة المؤقتة TTL.
   - `apps/bot-server/tests/outbox-circuit-breaker.spec.ts`: مهلات تأخير 1100ms لاختبار انتقال قاطع الدائرة إلى حالة نصف المفتوح (Half-Open).
   - `packages/core-components/tests/wizard-session.spec.ts`: مهلة تأخير 10ms لمحاكاة انتهاء جلسات المعالج.
   - `packages/database/tests/hash-chain.stress.spec.ts`: دالة sleep(ms) مخصصة لاختبارات الإجهاد وتزامن المعاملات المالية.
   - `packages/telemetry/tests/context.spec.ts`: مهلات تأخير 10ms و 20ms لفحص انتشار سياق التتبع الزمني.

---

## 6️⃣ فحص نصوص التشغيل (Scripts Inventory & Coverage)

### أ. نصوص التشغيل في `package.json` الرئيسي:
| اسم السكربت | الأمر المنفذ | النطاق والمهمة |
| :--- | :--- | :--- |
| `pnpm test` | `vitest run` | يشغّل كافة الاختبارات الـ 235 في المنظومة دفعة واحدة حتى الاكتمال |
| `pnpm test:watch` | `vitest` | يشغّل الاختبارات في وضع المراقبة التفاعلية للمطور |
| `pnpm test:flow` | `vitest run` | مرادف لتشغيل اختبارات التدفقات والحزم بالكامل |
| `pnpm test:changed` | `vitest related` | يشغّل حصرياً الاختبارات المرتبطة بالملفات المعدلة في Git |
| `pnpm test:pre-commit` | `tsx tools/governance/pre-commit-test-guard.ts` | صمام أمان Git Hook للتأكد من نجاح اختبارات الكيانات قبل التثبيت |
| `pnpm ci:simulate` | `pnpm typecheck && pnpm test && pnpm git-hygiene:verify && pnpm governance:verify` | بوابة التكامل المستمر الكاملة تفحص التايب سكريبت والاختبارات والحوكمة |
| `pnpm test-authenticity:verify` | `tsx tools/governance/verify-test-authenticity.ts` | فحص النزاهة الجنائية وحظر الاختبارات الوهمية (`expect(true).toBe(true)`) |

### ب. نصوص التشغيل داخل الحزم والتطبيقات الفرعية:
- `apps/admin-dashboard`: يحتوي على `"test": "vitest run"`
- `apps/bot-server`: يحتوي على `"test": "vitest run"`
- `modules/settings`: يحتوي على `"test": "vitest run"`
- `modules/workforce`: يحتوي على `"test": "vitest run"`
- `packages/ai-vision-engine`: يحتوي على `"test": "vitest run"`
- `packages/core-components`: يحتوي على `"test": "vitest run"`
- `packages/database`: يحتوي على `"test": "vitest run"`
- `packages/national-id-engine`: يحتوي على `"test": "vitest run"`
- `packages/rbac`: يحتوي على `"test": "vitest run"`
- `packages/regional-engine`: يحتوي على `"test": "vitest run"`
- `packages/telemetry`: يحتوي على `"test": "vitest run"`
- `apps/docs`: لا يحتوي على سكربت test مستقل في `package.json`، ولكن اختبار `apps/docs/tests/docs-portal.spec.ts` يُشغل تلقائياً وبشكل كامل عبر السكربت الرئيسي `pnpm test` في جذر المشروع.

---

## 7️⃣ الفهرس التفصيلي لجميع ملفات الاختبار الـ 235 (Complete File-by-File Inventory)

| م | مسار ملف الاختبار (Test File Path) | describe | it/test | expect | Skips | Mocks | يُشغَّل فعلاً؟ |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | `apps/admin-dashboard/tests/adversarial-route-role-session.spec.ts` | 4 | 13 | 41 | 0 | 2 | 🟢 نعم |
| 2 | `apps/admin-dashboard/tests/approvals-treasury.spec.ts` | 4 | 8 | 35 | 0 | 0 | 🟢 نعم |
| 3 | `apps/admin-dashboard/tests/auth-claim-concurrency.spec.ts` | 1 | 1 | 3 | 0 | 0 | 🟢 نعم |
| 4 | `apps/admin-dashboard/tests/auth-claim.spec.ts` | 2 | 18 | 62 | 0 | 0 | 🟢 نعم |
| 5 | `apps/admin-dashboard/tests/auth-session.spec.ts` | 1 | 6 | 24 | 0 | 0 | 🟢 نعم |
| 6 | `apps/admin-dashboard/tests/bot-features-tree-and-telegram-unification.spec.ts` | 5 | 15 | 45 | 0 | 0 | 🟢 نعم |
| 7 | `apps/admin-dashboard/tests/dashboard-auth-ast.spec.ts` | 1 | 8 | 9 | 0 | 0 | 🟢 نعم |
| 8 | `apps/admin-dashboard/tests/dashboard-auth-r1-remediation.spec.ts` | 5 | 9 | 18 | 0 | 1 | 🟢 نعم |
| 9 | `apps/admin-dashboard/tests/dashboard-intelligence.spec.ts` | 4 | 6 | 19 | 0 | 0 | 🟢 نعم |
| 10 | `apps/admin-dashboard/tests/dashboard-preferences.spec.ts` | 6 | 19 | 103 | 0 | 2 | 🟢 نعم |
| 11 | `apps/admin-dashboard/tests/data-fetchers.spec.ts` | 13 | 36 | 208 | 0 | 1 | 🟢 نعم |
| 12 | `apps/admin-dashboard/tests/docs-portal-cockpit.spec.ts` | 3 | 6 | 17 | 0 | 1 | 🟢 نعم |
| 13 | `apps/admin-dashboard/tests/error-boundaries.spec.ts` | 5 | 10 | 35 | 0 | 0 | 🟢 نعم |
| 14 | `apps/admin-dashboard/tests/health-route.spec.ts` | 1 | 2 | 20 | 0 | 1 | 🟢 نعم |
| 15 | `apps/admin-dashboard/tests/legacy-auth-elimination.spec.ts` | 1 | 6 | 8 | 0 | 0 | 🟢 نعم |
| 16 | `apps/admin-dashboard/tests/middleware-session-guard.spec.ts` | 1 | 6 | 14 | 0 | 0 | 🟢 نعم |
| 17 | `apps/admin-dashboard/tests/middleware-trace.spec.ts` | 3 | 9 | 26 | 0 | 0 | 🟢 نعم |
| 18 | `apps/admin-dashboard/tests/parity/approvals-security-guard.spec.ts` | 4 | 6 | 18 | 0 | 0 | 🟢 نعم |
| 19 | `apps/admin-dashboard/tests/parity/settings-and-delegations-parity.spec.ts` | 4 | 6 | 17 | 0 | 0 | 🟢 نعم |
| 20 | `apps/admin-dashboard/tests/parity/workforce-parity.spec.ts` | 5 | 9 | 30 | 0 | 0 | 🟢 نعم |
| 21 | `apps/admin-dashboard/tests/permissions-matrix-and-telegram-groups.spec.ts` | 4 | 9 | 47 | 0 | 0 | 🟢 نعم |
| 22 | `apps/admin-dashboard/tests/pillar-4-cybersecurity-and-skeletons.spec.ts` | 4 | 16 | 43 | 0 | 2 | 🟢 نعم |
| 23 | `apps/admin-dashboard/tests/prisma-studio-rbac.spec.ts` | 6 | 24 | 70 | 0 | 2 | 🟢 نعم |
| 24 | `apps/admin-dashboard/tests/rbac.spec.ts` | 1 | 5 | 15 | 0 | 0 | 🟢 نعم |
| 25 | `apps/admin-dashboard/tests/role-overview.spec.ts` | 5 | 5 | 13 | 0 | 0 | 🟢 نعم |
| 26 | `apps/admin-dashboard/tests/screen-responsiveness.spec.ts` | 10 | 24 | 61 | 0 | 0 | 🟢 نعم |
| 27 | `apps/admin-dashboard/tests/secure-export.spec.ts` | 3 | 5 | 34 | 0 | 0 | 🟢 نعم |
| 28 | `apps/admin-dashboard/tests/sidebar-nav.spec.ts` | 3 | 17 | 77 | 0 | 0 | 🟢 نعم |
| 29 | `apps/admin-dashboard/tests/workforce-evaluations.spec.ts` | 2 | 9 | 70 | 0 | 1 | 🟢 نعم |
| 30 | `apps/admin-dashboard/tests/workforce-onboarding.spec.ts` | 5 | 12 | 32 | 0 | 0 | 🟢 نعم |
| 31 | `apps/bot-server/tests/adversarial-dashboard-access.spec.ts` | 3 | 6 | 47 | 0 | 2 | 🟢 نعم |
| 32 | `apps/bot-server/tests/boost-handler.spec.ts` | 1 | 3 | 14 | 0 | 2 | 🟢 نعم |
| 33 | `apps/bot-server/tests/bot-handlers-sla.benchmark.spec.ts` | 1 | 4 | 6 | 0 | 2 | 🟢 نعم |
| 34 | `apps/bot-server/tests/coordinates.spec.ts` | 1 | 9 | 14 | 0 | 0 | 🟢 نعم |
| 35 | `apps/bot-server/tests/dashboard-command.spec.ts` | 8 | 28 | 143 | 0 | 2 | 🟢 نعم |
| 36 | `apps/bot-server/tests/env-validation.spec.ts` | 2 | 14 | 23 | 0 | 0 | 🟢 نعم |
| 37 | `apps/bot-server/tests/error-vault-and-telemetry.spec.ts` | 3 | 12 | 54 | 0 | 3 | 🟢 نعم |
| 38 | `apps/bot-server/tests/fast-cache.benchmark.spec.ts` | 1 | 6 | 26 | 0 | 1 | 🟢 نعم |
| 39 | `apps/bot-server/tests/fast-cache.spec.ts` | 3 | 12 | 32 | 0 | 2 | 🟢 نعم |
| 40 | `apps/bot-server/tests/group-manager.spec.ts` | 4 | 4 | 17 | 0 | 2 | 🟢 نعم |
| 41 | `apps/bot-server/tests/hr-rbac-masking.spec.ts` | 1 | 3 | 29 | 0 | 2 | 🟢 نعم |
| 42 | `apps/bot-server/tests/main-menu.spec.ts` | 4 | 23 | 79 | 0 | 0 | 🟢 نعم |
| 43 | `apps/bot-server/tests/modules-registry-and-autoloader.spec.ts` | 1 | 3 | 19 | 0 | 0 | 🟢 نعم |
| 44 | `apps/bot-server/tests/outbox-circuit-breaker.spec.ts` | 3 | 9 | 38 | 0 | 0 | 🟢 نعم |
| 45 | `apps/bot-server/tests/permanent-speed-engine.spec.ts` | 6 | 9 | 32 | 0 | 0 | 🟢 نعم |
| 46 | `apps/bot-server/tests/reply-bar.keyboard.spec.ts` | 3 | 15 | 49 | 0 | 0 | 🟢 نعم |
| 47 | `apps/bot-server/tests/screen-flow-and-hr-directory.spec.ts` | 1 | 17 | 50 | 0 | 1 | 🟢 نعم |
| 48 | `apps/bot-server/tests/security-hardening-r07-r09.spec.ts` | 4 | 8 | 14 | 0 | 0 | 🟢 نعم |
| 49 | `apps/bot-server/tests/session-monitor.spec.ts` | 3 | 5 | 35 | 0 | 1 | 🟢 نعم |
| 50 | `apps/bot-server/tests/site-scope.spec.ts` | 1 | 5 | 9 | 0 | 0 | 🟢 نعم |
| 51 | `apps/bot-server/tests/telegram-enforcer-and-lifecycle.spec.ts` | 3 | 10 | 46 | 0 | 2 | 🟢 نعم |
| 52 | `apps/bot-server/tests/telemetry-sla.spec.ts` | 4 | 9 | 37 | 0 | 2 | 🟢 نعم |
| 53 | `apps/bot-server/tests/worker-ai-vision.spec.ts` | 4 | 7 | 20 | 0 | 0 | 🟢 نعم |
| 54 | `apps/bot-server/tests/worker-attachments-and-address.spec.ts` | 3 | 3 | 11 | 0 | 2 | 🟢 نعم |
| 55 | `apps/bot-server/tests/worker-edit-governance.spec.ts` | 5 | 8 | 33 | 0 | 2 | 🟢 نعم |
| 56 | `apps/bot-server/tests/worker-excel.spec.ts` | 2 | 9 | 58 | 0 | 2 | 🟢 نعم |
| 57 | `apps/bot-server/tests/worker-full-wizard.spec.ts` | 4 | 7 | 26 | 0 | 2 | 🟢 نعم |
| 58 | `apps/bot-server/tests/worker-id-types.spec.ts` | 4 | 8 | 23 | 0 | 2 | 🟢 نعم |
| 59 | `apps/bot-server/tests/worker-linking-approval.spec.ts` | 7 | 8 | 61 | 0 | 4 | 🟢 نعم |
| 60 | `apps/docs/tests/docs-portal.spec.ts` | 1 | 9 | 53 | 0 | 0 | 🟢 نعم |
| 61 | `modules/settings/src/flows/00.1-corporate-profile/tests/flow.data.spec.ts` | 1 | 2 | 3 | 0 | 0 | 🟢 نعم |
| 62 | `modules/settings/src/flows/00.1-corporate-profile/tests/flow.integration.spec.ts` | 1 | 1 | 1 | 0 | 0 | 🟢 نعم |
| 63 | `modules/settings/src/flows/00.1-corporate-profile/tests/flow.rbac.spec.ts` | 1 | 2 | 5 | 0 | 0 | 🟢 نعم |
| 64 | `modules/settings/src/flows/00.1-corporate-profile/tests/flow.unit.spec.ts` | 1 | 4 | 13 | 0 | 0 | 🟢 نعم |
| 65 | `modules/settings/src/flows/00.1-corporate-profile/tests/flow.ux.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 66 | `modules/settings/src/flows/00.10-notification-policies/tests/flow.data.spec.ts` | 1 | 2 | 6 | 0 | 0 | 🟢 نعم |
| 67 | `modules/settings/src/flows/00.10-notification-policies/tests/flow.integration.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 68 | `modules/settings/src/flows/00.10-notification-policies/tests/flow.rbac.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 69 | `modules/settings/src/flows/00.10-notification-policies/tests/flow.unit.spec.ts` | 3 | 6 | 20 | 0 | 0 | 🟢 نعم |
| 70 | `modules/settings/src/flows/00.10-notification-policies/tests/flow.ux.spec.ts` | 1 | 2 | 5 | 0 | 0 | 🟢 نعم |
| 71 | `modules/settings/src/flows/00.11-telegram-groups/tests/flow.data.spec.ts` | 1 | 2 | 5 | 0 | 0 | 🟢 نعم |
| 72 | `modules/settings/src/flows/00.11-telegram-groups/tests/flow.integration.spec.ts` | 1 | 1 | 3 | 0 | 0 | 🟢 نعم |
| 73 | `modules/settings/src/flows/00.11-telegram-groups/tests/flow.rbac.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 74 | `modules/settings/src/flows/00.11-telegram-groups/tests/flow.unit.spec.ts` | 3 | 9 | 29 | 0 | 0 | 🟢 نعم |
| 75 | `modules/settings/src/flows/00.11-telegram-groups/tests/flow.ux.spec.ts` | 1 | 2 | 5 | 0 | 0 | 🟢 نعم |
| 76 | `modules/settings/src/flows/00.12-user-rbac-management/tests/flow.data.spec.ts` | 1 | 4 | 12 | 0 | 0 | 🟢 نعم |
| 77 | `modules/settings/src/flows/00.12-user-rbac-management/tests/flow.integration.spec.ts` | 1 | 1 | 4 | 0 | 0 | 🟢 نعم |
| 78 | `modules/settings/src/flows/00.12-user-rbac-management/tests/flow.rbac.spec.ts` | 1 | 3 | 8 | 0 | 0 | 🟢 نعم |
| 79 | `modules/settings/src/flows/00.12-user-rbac-management/tests/flow.unit.spec.ts` | 1 | 10 | 25 | 0 | 0 | 🟢 نعم |
| 80 | `modules/settings/src/flows/00.12-user-rbac-management/tests/flow.ux.spec.ts` | 1 | 2 | 4 | 0 | 0 | 🟢 نعم |
| 81 | `modules/settings/src/flows/00.2-sites-hub/tests/flow.data.spec.ts` | 1 | 2 | 3 | 0 | 0 | 🟢 نعم |
| 82 | `modules/settings/src/flows/00.2-sites-hub/tests/flow.integration.spec.ts` | 1 | 21 | 107 | 0 | 0 | 🟢 نعم |
| 83 | `modules/settings/src/flows/00.2-sites-hub/tests/flow.rbac.spec.ts` | 1 | 2 | 5 | 0 | 0 | 🟢 نعم |
| 84 | `modules/settings/src/flows/00.2-sites-hub/tests/flow.unit.spec.ts` | 1 | 4 | 9 | 0 | 0 | 🟢 نعم |
| 85 | `modules/settings/src/flows/00.2-sites-hub/tests/flow.ux.spec.ts` | 1 | 9 | 55 | 0 | 0 | 🟢 نعم |
| 86 | `modules/settings/src/flows/00.3-job-matrix/tests/flow.data.spec.ts` | 1 | 2 | 3 | 0 | 0 | 🟢 نعم |
| 87 | `modules/settings/src/flows/00.3-job-matrix/tests/flow.integration.spec.ts` | 1 | 1 | 1 | 0 | 0 | 🟢 نعم |
| 88 | `modules/settings/src/flows/00.3-job-matrix/tests/flow.rbac.spec.ts` | 1 | 2 | 5 | 0 | 0 | 🟢 نعم |
| 89 | `modules/settings/src/flows/00.3-job-matrix/tests/flow.unit.spec.ts` | 1 | 10 | 31 | 0 | 0 | 🟢 نعم |
| 90 | `modules/settings/src/flows/00.3-job-matrix/tests/flow.ux.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 91 | `modules/settings/src/flows/00.4-admin-profile/tests/flow.data.spec.ts` | 1 | 2 | 3 | 0 | 0 | 🟢 نعم |
| 92 | `modules/settings/src/flows/00.4-admin-profile/tests/flow.integration.spec.ts` | 1 | 1 | 1 | 0 | 0 | 🟢 نعم |
| 93 | `modules/settings/src/flows/00.4-admin-profile/tests/flow.rbac.spec.ts` | 1 | 2 | 5 | 0 | 0 | 🟢 نعم |
| 94 | `modules/settings/src/flows/00.4-admin-profile/tests/flow.unit.spec.ts` | 1 | 5 | 11 | 0 | 0 | 🟢 نعم |
| 95 | `modules/settings/src/flows/00.4-admin-profile/tests/flow.ux.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 96 | `modules/settings/src/flows/00.5-admin-assignment/tests/flow.data.spec.ts` | 1 | 2 | 2 | 0 | 0 | 🟢 نعم |
| 97 | `modules/settings/src/flows/00.5-admin-assignment/tests/flow.integration.spec.ts` | 1 | 1 | 1 | 0 | 0 | 🟢 نعم |
| 98 | `modules/settings/src/flows/00.5-admin-assignment/tests/flow.rbac.spec.ts` | 1 | 4 | 8 | 0 | 0 | 🟢 نعم |
| 99 | `modules/settings/src/flows/00.5-admin-assignment/tests/flow.unit.spec.ts` | 1 | 8 | 24 | 0 | 0 | 🟢 نعم |
| 100 | `modules/settings/src/flows/00.5-admin-assignment/tests/flow.ux.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 101 | `modules/settings/src/flows/00.6-ghost-mode/tests/flow.data.spec.ts` | 1 | 2 | 2 | 0 | 0 | 🟢 نعم |
| 102 | `modules/settings/src/flows/00.6-ghost-mode/tests/flow.integration.spec.ts` | 1 | 7 | 34 | 0 | 0 | 🟢 نعم |
| 103 | `modules/settings/src/flows/00.6-ghost-mode/tests/flow.rbac.spec.ts` | 1 | 2 | 5 | 0 | 0 | 🟢 نعم |
| 104 | `modules/settings/src/flows/00.6-ghost-mode/tests/flow.unit.spec.ts` | 1 | 5 | 16 | 0 | 0 | 🟢 نعم |
| 105 | `modules/settings/src/flows/00.6-ghost-mode/tests/flow.ux.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 106 | `modules/settings/src/flows/00.7-audit-incident-vault/tests/flow.data.spec.ts` | 1 | 2 | 2 | 0 | 0 | 🟢 نعم |
| 107 | `modules/settings/src/flows/00.7-audit-incident-vault/tests/flow.integration.spec.ts` | 1 | 1 | 1 | 0 | 0 | 🟢 نعم |
| 108 | `modules/settings/src/flows/00.7-audit-incident-vault/tests/flow.rbac.spec.ts` | 1 | 2 | 5 | 0 | 0 | 🟢 نعم |
| 109 | `modules/settings/src/flows/00.7-audit-incident-vault/tests/flow.unit.spec.ts` | 1 | 4 | 11 | 0 | 0 | 🟢 نعم |
| 110 | `modules/settings/src/flows/00.7-audit-incident-vault/tests/flow.ux.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 111 | `modules/settings/src/flows/00.8-apm-telemetry/tests/flow.data.spec.ts` | 1 | 2 | 2 | 0 | 0 | 🟢 نعم |
| 112 | `modules/settings/src/flows/00.8-apm-telemetry/tests/flow.integration.spec.ts` | 1 | 1 | 1 | 0 | 0 | 🟢 نعم |
| 113 | `modules/settings/src/flows/00.8-apm-telemetry/tests/flow.rbac.spec.ts` | 1 | 2 | 5 | 0 | 0 | 🟢 نعم |
| 114 | `modules/settings/src/flows/00.8-apm-telemetry/tests/flow.unit.spec.ts` | 1 | 4 | 11 | 0 | 0 | 🟢 نعم |
| 115 | `modules/settings/src/flows/00.8-apm-telemetry/tests/flow.ux.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 116 | `modules/settings/src/flows/00.9-emergency-cache/tests/flow.data.spec.ts` | 1 | 2 | 2 | 0 | 0 | 🟢 نعم |
| 117 | `modules/settings/src/flows/00.9-emergency-cache/tests/flow.integration.spec.ts` | 1 | 1 | 1 | 0 | 0 | 🟢 نعم |
| 118 | `modules/settings/src/flows/00.9-emergency-cache/tests/flow.rbac.spec.ts` | 1 | 2 | 5 | 0 | 0 | 🟢 نعم |
| 119 | `modules/settings/src/flows/00.9-emergency-cache/tests/flow.unit.spec.ts` | 1 | 3 | 11 | 0 | 0 | 🟢 نعم |
| 120 | `modules/settings/src/flows/00.9-emergency-cache/tests/flow.ux.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 121 | `modules/workforce/src/flows/01.1-worker-registration/tests/flow.data.spec.ts` | 1 | 1 | 7 | 0 | 0 | 🟢 نعم |
| 122 | `modules/workforce/src/flows/01.1-worker-registration/tests/flow.integration.spec.ts` | 1 | 8 | 44 | 0 | 0 | 🟢 نعم |
| 123 | `modules/workforce/src/flows/01.1-worker-registration/tests/flow.rbac.spec.ts` | 1 | 6 | 14 | 0 | 0 | 🟢 نعم |
| 124 | `modules/workforce/src/flows/01.1-worker-registration/tests/flow.unit.spec.ts` | 2 | 17 | 90 | 0 | 0 | 🟢 نعم |
| 125 | `modules/workforce/src/flows/01.1-worker-registration/tests/flow.ux.spec.ts` | 3 | 23 | 113 | 0 | 0 | 🟢 نعم |
| 126 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.data.spec.ts` | 1 | 1 | 5 | 0 | 0 | 🟢 نعم |
| 127 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.draft-store.spec.ts` | 1 | 4 | 16 | 0 | 0 | 🟢 نعم |
| 128 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.integration.spec.ts` | 1 | 4 | 17 | 0 | 0 | 🟢 نعم |
| 129 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.rbac.spec.ts` | 1 | 2 | 2 | 0 | 0 | 🟢 نعم |
| 130 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.unit.spec.ts` | 1 | 10 | 42 | 0 | 0 | 🟢 نعم |
| 131 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.ux.spec.ts` | 1 | 1 | 2 | 0 | 0 | 🟢 نعم |
| 132 | `modules/workforce/src/flows/01.4-worker-export/tests/flow.data.spec.ts` | 1 | 2 | 12 | 0 | 0 | 🟢 نعم |
| 133 | `modules/workforce/src/flows/01.4-worker-export/tests/flow.integration.spec.ts` | 1 | 2 | 6 | 0 | 0 | 🟢 نعم |
| 134 | `modules/workforce/src/flows/01.4-worker-export/tests/flow.rbac.spec.ts` | 1 | 3 | 9 | 0 | 0 | 🟢 نعم |
| 135 | `modules/workforce/src/flows/01.4-worker-export/tests/flow.unit.spec.ts` | 1 | 6 | 36 | 0 | 0 | 🟢 نعم |
| 136 | `modules/workforce/src/flows/01.4-worker-export/tests/flow.ux.spec.ts` | 1 | 2 | 6 | 0 | 0 | 🟢 نعم |
| 137 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.data.spec.ts` | 1 | 5 | 26 | 0 | 0 | 🟢 نعم |
| 138 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.documents.spec.ts` | 3 | 11 | 55 | 0 | 0 | 🟢 نعم |
| 139 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.integration.spec.ts` | 1 | 2 | 7 | 0 | 0 | 🟢 نعم |
| 140 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.rbac.spec.ts` | 1 | 2 | 2 | 0 | 0 | 🟢 نعم |
| 141 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.unit.spec.ts` | 1 | 7 | 27 | 0 | 0 | 🟢 نعم |
| 142 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.ux.spec.ts` | 1 | 3 | 6 | 0 | 0 | 🟢 نعم |
| 143 | `modules/workforce/src/flows/01.6-worker-self-edit/tests/flow.data.spec.ts` | 1 | 3 | 20 | 0 | 0 | 🟢 نعم |
| 144 | `modules/workforce/src/flows/01.6-worker-self-edit/tests/flow.integration.spec.ts` | 1 | 1 | 5 | 0 | 0 | 🟢 نعم |
| 145 | `modules/workforce/src/flows/01.6-worker-self-edit/tests/flow.rbac.spec.ts` | 1 | 1 | 3 | 0 | 0 | 🟢 نعم |
| 146 | `modules/workforce/src/flows/01.6-worker-self-edit/tests/flow.unit.spec.ts` | 1 | 5 | 17 | 0 | 0 | 🟢 نعم |
| 147 | `modules/workforce/src/flows/01.6-worker-self-edit/tests/flow.ux.spec.ts` | 1 | 3 | 7 | 0 | 0 | 🟢 نعم |
| 148 | `modules/workforce/src/flows/01.7-guest-join-and-linking/tests/flow.data.spec.ts` | 1 | 1 | 4 | 0 | 0 | 🟢 نعم |
| 149 | `modules/workforce/src/flows/01.7-guest-join-and-linking/tests/flow.integration.spec.ts` | 1 | 3 | 10 | 0 | 0 | 🟢 نعم |
| 150 | `modules/workforce/src/flows/01.7-guest-join-and-linking/tests/flow.rbac.spec.ts` | 1 | 2 | 6 | 0 | 0 | 🟢 نعم |
| 151 | `modules/workforce/src/flows/01.7-guest-join-and-linking/tests/flow.unit.spec.ts` | 1 | 5 | 10 | 0 | 0 | 🟢 نعم |
| 152 | `modules/workforce/src/flows/01.7-guest-join-and-linking/tests/flow.ux.spec.ts` | 1 | 4 | 9 | 0 | 0 | 🟢 نعم |
| 153 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.challenger-m2-sanitization.stress.spec.ts` | 12 | 27 | 139 | 0 | 0 | 🟢 نعم |
| 154 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.challenger-m2.stress.spec.ts` | 6 | 17 | 80 | 0 | 0 | 🟢 نعم |
| 155 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.data.spec.ts` | 1 | 2 | 15 | 0 | 0 | 🟢 نعم |
| 156 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.integration.spec.ts` | 1 | 1 | 9 | 0 | 0 | 🟢 نعم |
| 157 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.rbac.spec.ts` | 1 | 1 | 3 | 0 | 0 | 🟢 نعم |
| 158 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.repository.stress.spec.ts` | 4 | 13 | 107 | 0 | 0 | 🟢 نعم |
| 159 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.service.spec.ts` | 6 | 25 | 103 | 0 | 0 | 🟢 نعم |
| 160 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.unit.spec.ts` | 1 | 2 | 10 | 0 | 0 | 🟢 نعم |
| 161 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.ux.spec.ts` | 8 | 22 | 92 | 0 | 0 | 🟢 نعم |
| 162 | `modules/workforce/src/flows/01.9-worker-commitment-index/tests/flow.data.spec.ts` | 1 | 4 | 15 | 0 | 0 | 🟢 نعم |
| 163 | `modules/workforce/src/flows/01.9-worker-commitment-index/tests/flow.integration.spec.ts` | 1 | 3 | 17 | 0 | 0 | 🟢 نعم |
| 164 | `modules/workforce/src/flows/01.9-worker-commitment-index/tests/flow.rbac.spec.ts` | 1 | 3 | 10 | 0 | 0 | 🟢 نعم |
| 165 | `modules/workforce/src/flows/01.9-worker-commitment-index/tests/flow.unit.spec.ts` | 1 | 9 | 49 | 0 | 0 | 🟢 نعم |
| 166 | `modules/workforce/src/flows/01.9-worker-commitment-index/tests/flow.ux.spec.ts` | 1 | 7 | 26 | 0 | 0 | 🟢 نعم |
| 167 | `packages/ai-vision-engine/tests/engine.spec.ts` | 1 | 13 | 51 | 0 | 0 | 🟢 نعم |
| 168 | `packages/core-components/tests/amount-picker.spec.ts` | 4 | 10 | 17 | 0 | 0 | 🟢 نعم |
| 169 | `packages/core-components/tests/approval-workflow.spec.ts` | 1 | 3 | 14 | 0 | 0 | 🟢 نعم |
| 170 | `packages/core-components/tests/attachment-pipeline.spec.ts` | 1 | 2 | 8 | 0 | 0 | 🟢 نعم |
| 171 | `packages/core-components/tests/bot-catalog.spec.ts` | 3 | 9 | 27 | 0 | 0 | 🟢 نعم |
| 172 | `packages/core-components/tests/branded-types.spec.ts` | 8 | 23 | 151 | 0 | 0 | 🟢 نعم |
| 173 | `packages/core-components/tests/clearing-engine.spec.ts` | 1 | 5 | 19 | 0 | 0 | 🟢 نعم |
| 174 | `packages/core-components/tests/completion-card.spec.ts` | 4 | 6 | 26 | 0 | 0 | 🟢 نعم |
| 175 | `packages/core-components/tests/custody-gate.spec.ts` | 1 | 3 | 9 | 0 | 0 | 🟢 نعم |
| 176 | `packages/core-components/tests/date-picker.spec.ts` | 5 | 7 | 16 | 0 | 0 | 🟢 نعم |
| 177 | `packages/core-components/tests/governorate-picker.spec.ts` | 1 | 7 | 36 | 0 | 0 | 🟢 نعم |
| 178 | `packages/core-components/tests/in-place-flow.spec.ts` | 12 | 19 | 71 | 0 | 0 | 🟢 نعم |
| 179 | `packages/core-components/tests/installment-engine.spec.ts` | 2 | 8 | 28 | 0 | 0 | 🟢 نعم |
| 180 | `packages/core-components/tests/location-picker.spec.ts` | 4 | 11 | 40 | 0 | 0 | 🟢 نعم |
| 181 | `packages/core-components/tests/notification-engine.spec.ts` | 3 | 7 | 35 | 0 | 0 | 🟢 نعم |
| 182 | `packages/core-components/tests/notification-helper.spec.ts` | 1 | 4 | 10 | 0 | 0 | 🟢 نعم |
| 183 | `packages/core-components/tests/outbox-queue.spec.ts` | 1 | 3 | 16 | 0 | 0 | 🟢 نعم |
| 184 | `packages/core-components/tests/purchase-picker.spec.ts` | 1 | 1 | 6 | 0 | 0 | 🟢 نعم |
| 185 | `packages/core-components/tests/quantity-picker.spec.ts` | 3 | 5 | 10 | 0 | 0 | 🟢 نعم |
| 186 | `packages/core-components/tests/shift-accrual.spec.ts` | 1 | 3 | 10 | 0 | 0 | 🟢 نعم |
| 187 | `packages/core-components/tests/source-picker.spec.ts` | 3 | 5 | 15 | 0 | 0 | 🟢 نعم |
| 188 | `packages/core-components/tests/sovereign-auto-loader.spec.ts` | 6 | 18 | 82 | 0 | 0 | 🟢 نعم |
| 189 | `packages/core-components/tests/telegram-formatters.spec.ts` | 10 | 23 | 34 | 0 | 0 | 🟢 نعم |
| 190 | `packages/core-components/tests/topic-router.spec.ts` | 1 | 2 | 8 | 0 | 0 | 🟢 نعم |
| 191 | `packages/core-components/tests/wizard-session.spec.ts` | 3 | 15 | 51 | 0 | 0 | 🟢 نعم |
| 192 | `packages/core-components/tests/worker-commitment-engine.spec.ts` | 1 | 10 | 53 | 0 | 0 | 🟢 نعم |
| 193 | `packages/core-components/tests/worker-picker.spec.ts` | 5 | 10 | 39 | 0 | 0 | 🟢 نعم |
| 194 | `packages/database/tests/adversarial-m2-audit.spec.ts` | 3 | 20 | 68 | 0 | 0 | 🟢 نعم |
| 195 | `packages/database/tests/custody-transaction.repository.spec.ts` | 4 | 18 | 38 | 0 | 0 | 🟢 نعم |
| 196 | `packages/database/tests/hash-chain.spec.ts` | 3 | 5 | 8 | 0 | 0 | 🟢 نعم |
| 197 | `packages/database/tests/hash-chain.stress.spec.ts` | 4 | 25 | 99 | 0 | 0 | 🟢 نعم |
| 198 | `packages/database/tests/hash-ledger.extension.spec.ts` | 2 | 15 | 50 | 0 | 0 | 🟢 نعم |
| 199 | `packages/database/tests/hmac-keyring.spec.ts` | 1 | 5 | 8 | 0 | 0 | 🟢 نعم |
| 200 | `packages/database/tests/migration-rbac-and-sessions.spec.ts` | 1 | 3 | 16 | 0 | 0 | 🟢 نعم |
| 201 | `packages/database/tests/migration-trace-and-magic-claim.spec.ts` | 1 | 3 | 7 | 0 | 0 | 🟢 نعم |
| 202 | `packages/database/tests/milestone-1-schema-contract.spec.ts` | 1 | 8 | 55 | 0 | 0 | 🟢 نعم |
| 203 | `packages/database/tests/security.spec.ts` | 4 | 12 | 30 | 0 | 0 | 🟢 نعم |
| 204 | `packages/database/tests/soft-delete.spec.ts` | 1 | 9 | 24 | 0 | 0 | 🟢 نعم |
| 205 | `packages/database/tests/transactional-rls.spec.ts` | 1 | 5 | 10 | 0 | 0 | 🟢 نعم |
| 206 | `packages/database/tests/verify-ledger-chain.spec.ts` | 1 | 6 | 18 | 0 | 0 | 🟢 نعم |
| 207 | `packages/national-id-engine/tests/national-id.spec.ts` | 1 | 14 | 58 | 0 | 0 | 🟢 نعم |
| 208 | `packages/rbac/tests/cascading-rbac.spec.ts` | 6 | 17 | 44 | 0 | 0 | 🟢 نعم |
| 209 | `packages/rbac/tests/dashboard-auth.spec.ts` | 3 | 15 | 62 | 0 | 0 | 🟢 نعم |
| 210 | `packages/rbac/tests/rbac.spec.ts` | 5 | 17 | 62 | 0 | 0 | 🟢 نعم |
| 211 | `packages/regional-engine/tests/names.spec.ts` | 1 | 4 | 11 | 0 | 0 | 🟢 نعم |
| 212 | `packages/regional-engine/tests/regional.spec.ts` | 5 | 16 | 40 | 0 | 0 | 🟢 نعم |
| 213 | `packages/telemetry/tests/adapters.spec.ts` | 6 | 15 | 47 | 0 | 0 | 🟢 نعم |
| 214 | `packages/telemetry/tests/challenger-m1-2.stress.spec.ts` | 15 | 48 | 134 | 0 | 0 | 🟢 نعم |
| 215 | `packages/telemetry/tests/context.spec.ts` | 2 | 8 | 17 | 0 | 0 | 🟢 نعم |
| 216 | `packages/telemetry/tests/empirical-challenger-m1-r2.spec.ts` | 3 | 10 | 49 | 0 | 0 | 🟢 نعم |
| 217 | `packages/telemetry/tests/incidents.spec.ts` | 1 | 4 | 16 | 0 | 0 | 🟢 نعم |
| 218 | `packages/telemetry/tests/logger.spec.ts` | 1 | 5 | 26 | 0 | 0 | 🟢 نعم |
| 219 | `packages/telemetry/tests/redaction.spec.ts` | 5 | 26 | 98 | 0 | 0 | 🟢 نعم |
| 220 | `tools/governance/tests/agent-dispatcher.spec.ts` | 3 | 6 | 18 | 0 | 0 | 🟢 نعم |
| 221 | `tools/governance/tests/docker-governance-lock.spec.ts` | 1 | 8 | 40 | 0 | 0 | 🟢 نعم |
| 222 | `tools/governance/tests/governance-verifiers.spec.ts` | 2 | 44 | 177 | 0 | 0 | 🟢 نعم |
| 223 | `tools/governance/tests/legacy-parity-verifier.spec.ts` | 1 | 9 | 15 | 0 | 0 | 🟢 نعم |
| 224 | `tools/governance/tests/pre-commit-test-guard.spec.ts` | 1 | 7 | 28 | 0 | 0 | 🟢 نعم |
| 225 | `tools/governance/tests/rag-engine.spec.ts` | 9 | 33 | 137 | 0 | 0 | 🟢 نعم |
| 226 | `tools/governance/tests/unified-lock-engine.spec.ts` | 5 | 11 | 49 | 0 | 0 | 🟢 نعم |
| 227 | `tools/governance/tests/verify-boundary-deserialization.spec.ts` | 1 | 6 | 11 | 0 | 0 | 🟢 نعم |
| 228 | `tools/governance/tests/verify-code-security.spec.ts` | 1 | 7 | 17 | 0 | 1 | 🟢 نعم |
| 229 | `tools/governance/tests/verify-financial-integrity.spec.ts` | 1 | 11 | 22 | 0 | 0 | 🟢 نعم |
| 230 | `tools/governance/tests/verify-git-hygiene.spec.ts` | 1 | 10 | 34 | 0 | 0 | 🟢 نعم |
| 231 | `tools/governance/tests/verify-latency-anti-patterns.spec.ts` | 1 | 8 | 17 | 0 | 0 | 🟢 نعم |
| 232 | `tools/governance/tests/verify-performance-budget.spec.ts` | 2 | 9 | 28 | 0 | 0 | 🟢 نعم |
| 233 | `tools/governance/tests/verify-rbac-invariants.spec.ts` | 1 | 7 | 14 | 0 | 0 | 🟢 نعم |
| 234 | `tools/governance/tests/verify-secret-leakage.spec.ts` | 1 | 4 | 11 | 0 | 1 | 🟢 نعم |
| 235 | `tools/governance/tests/verify-test-authenticity.spec.ts` | 1 | 7 | 17 | 0 | 0 | 🟢 نعم |

---

## 8️⃣ نتائج التحقق والأصالة الجنائية (Test Authenticity & Quality Invariants)

1. **انعدام تام للاختبارات المتخطاة (Zero-Skip Enforcement):**
   - لم يتم رصد أي استخدام لـ `it.skip`, `test.skip`, `describe.skip`, `xit`, `xtest`, أو `it.todo` في أي ملف من الملفات الـ 235.
2. **العزل الصارم للمحاكاة (Mock Isolation):**
   - حزم النواة المشتركة (`core-components`, `database`, `rbac`, `regional-engine`, `telemetry`, `national-id-engine`, `ai-vision-engine`) تحتوي على **صفر محاكيات (`0 mocks`)** ويتم اختبارها بالكامل بمنطق حقيقي وبيئات واقعية.
   - تقتصر المحاكيات (`53 mocks`) حصراً على واجهات تليجرام الخارجية في البوت (`bot-server`: 38) وواجهات Next.js في الداشبورد (`admin-dashboard`: 13) وأدوات الحوكمة (2).
3. **أصالة التوكيدات (No Vacuous Assertions):**
   - تخضع كافة الاختبارات لأداة التحقق الجنائي `tools/governance/verify-test-authenticity.ts` التي تمنع التوكيدات التافهة وتلزم بارتباط كل اختبار بمنطق تنفيذي حقيقي.

---
**تم إعداد هذا التقرير الجنائي والتحقق من دقته بنسبة 100% استناداً إلى قراءة شجرة الرموز (AST) وتشغيل محرك Vitest الرسمي.**
