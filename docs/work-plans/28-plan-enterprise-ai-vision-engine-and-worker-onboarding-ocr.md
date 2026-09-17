# 📋 خطة العمل رقم 28: بناء حزمة محرك الرؤية الحاسوبية بالذكاء الاصطناعي (`@alsaada/ai-vision-engine`) وتفعيل المسار المزدوج لمعالج تعيين العمال
## Master Work Plan 28: Enterprise AI Vision Engine & Worker Registration Dual-Path OCR Integration

> [!IMPORTANT]
> **الحالة:** 🟢 مكتمل ومعتمد 100%  
> **التاريخ:** 2026-09-15  
> **الحزمة المشتركة المستهدفة:** `@alsaada/ai-vision-engine` داخل `packages/ai-vision-engine`  
> **التدفق المستهدف:** `01.1-worker-registration` (تسجيل وتعيين عامل / موظف جديد) داخل `modules/workforce/src/flows/01.1-worker-registration/`  
> **دستور العمل:** الالتزام الصارم بميثاق الحوكمة (`AGENTS.md`) والوثيقة 24 (`docs/24-enterprise-feature-and-flow-master-specification.md`): النواة المشتركة أولاً، حظر تكرار الأكواد، سقف معالج التدفق أقل من 350 سطراً، خلو تام من `any`، وحفظ دورة حياة الرسالة الواحدة والتنقل الموضعي.

---

### 1️⃣ الدوافع والمراجعة المعمارية للنواة المشتركة (Architecture & Rationale)

1. **ترقية محرك الرؤية والذكاء الاصطناعي لحزمة مستقلة (`packages/ai-vision-engine`):**
   - بدلاً من حبس خدمة الفحص داخل موديول القوى العاملة (`modules/workforce/src/services/ai-vision-id.service.ts`)، تم تأسيس حزمة مؤسسية معيارية `@alsaada/ai-vision-engine` لتكون المصدر الحصري الموحد (SSOT) في كافة أقسام المنظومة (بطاقات الرقم القومي، جوازات السفر، وفواتير المشتريات وإيصالات التحويل البنكي وبوالص الشحن كما هو موثق في `docs/03-ai-vision-invoice-engine.md`).
   - استئصال وحذف الملف القديم `modules/workforce/src/services/ai-vision-id.service.ts` بالكامل ومنع أي تكرار كودي، مع الالتزام بأنماط `TypeScript 5.9+` الصارمة (0 `any`).
   - دعم التدوير التلقائي لمفاتيح Gemini (`GEMINI_API_KEY`) مع تدرج النماذج الذكية (`gemini-2.5-flash` ثم `gemini-2.0-flash` ثم `gemini-1.5-flash`).
   - توفير صمامات أمان حاسوبية لجودة الصورة (كشف التشويش والاهتزاز، وكشف حجب الأرقام بالأصابع).

2. **تفعيل المسار المزدوج للتسجيل (Dual-Path Worker Registration UX):**
   - **المسار الذكي بالذكاء الاصطناعي (AI Path):**
     * رفع صورة وجه البطاقة ⬅️ رفع صورة ظهر البطاقة (أو صورة جواز السفر).
     * تنزيل الصور وتحليلها آلياً عبر محرك النواة المشتركة.
     * استخراج: الاسم الكامل، الرقم القومي (14 رقماً) أو رقم الجواز، تاريخ الميلاد، العمر، النوع، المحافظة، العنوان بالتفصيل، وتاريخ انتهاء السريان ("سارية حتى").
     * عرض بطاقة المراجعة والاعتماد الذكية (`AI_CONFIRMATION`) مزودة بأزرار:
       - `[ ✅ اعتماد ومتابعة ]` (تعبئة المسودة آلياً والقفز مباشرة لخطوة الهاتف ثم الراتب والوظيفة والموقع).
       - أزرار التعديل الموضعي: `[ ✏️ تعديل الاسم ]`, `[ ✏️ تعديل الرقم ]`, `[ ✏️ تعديل العنوان ]`, `[ ✏️ تعديل تاريخ الانتهاء ]`.
   - **المسار اليدوي السريع (Manual Fallback Path):**
     * إتاحة زر `[ ⚡ تخطي والمتابعة يدوياً ]` في شاشات التقاط الصور للانتقال المباشر للإدخال اليدوي المعتاد دون إجبار المشرف على رفع الصور في حالات ضعف الشبكة الميدانية.

3. **الالتزام الكامل بالوثيقة 24 وحوكمة التدفقات:**
   - مسار التتبع الشجري (`formatBreadcrumbs`) وترقيم الخطوات.
   - دورة حياة الرسالة الواحدة والتعديل الموضعي (`renderInPlaceWizardStep`).
   - الحذف التلقائي الصامت لرسائل وصور المستخدم الميدانية لمنع الفوضى في المحادثة.
   - الحفاظ الصارم على سقف معالج التدفق `flow.handler.ts` (346 سطراً <= 350 سطراً وخالٍ تماماً من `any`).

---

### 2️⃣ خطة العمل التنفيذية المنجزة (Completed Milestones)

- [x] **المرحلة 1: تأسيس الحزمة المشتركة `@alsaada/ai-vision-engine`**
  - [x] إنشاء بنية الحزمة في `packages/ai-vision-engine`:
    * `package.json` و `tsconfig.json`.
    * `src/types.ts`: الواجهات والأنواع الصارمة للمستندات والنتائج وجودة الصور.
    * `src/prompts.ts`: التعليمات البرمجية الدقيقة لاستخراج الهويات المصرية وجوازات السفر والفواتير.
    * `src/engine.ts`: فئة `AiVisionEngine` والمحرك الافتراضي `aiVisionEngine` مع التدوير والحراسة وتدقيق الرقم القومي عبر `@alsaada/national-id-engine`.
    * `src/index.ts`: التصدير المركزي لكافة الأنواع والمحركات.
  - [x] كتابة اختبارات الوحدة الشاملة في `packages/ai-vision-engine/tests/engine.spec.ts` (9/9 اختبارات ناجحة).
  - [x] ربط الحزمة بمساحة العمل وتثبيت التبعيات وبناؤها (`pnpm --filter @alsaada/ai-vision-engine build`).

- [x] **المرحلة 2: تنظيف موديول القوى العاملة واستئصال التكرار**
  - [x] حذف واستئصال `modules/workforce/src/services/ai-vision-id.service.ts` نهائياً لمنع أي كود ميت.
  - [x] حذف تصديره من `modules/workforce/src/index.ts`.
  - [x] إضافة `@alsaada/ai-vision-engine` إلى `modules/workforce/package.json` و `apps/bot-server/package.json`.
  - [x] تحديث `apps/bot-server/tests/worker-ai-vision.spec.ts` للاستيراد المباشر من `@alsaada/ai-vision-engine` (7/7 اختبارات ناجحة).

- [x] **المرحلة 3: ترقية تدفق تسجيل العمال (`01.1-worker-registration`) للمسار المزدوج**
  - [x] ترقية `flow.types.ts`: تكييف حالات خطوات المعالج (`PHOTO_FRONT`, `PHOTO_BACK`, `AI_CONFIRMATION`, `AI_EDIT_*`).
  - [x] ترقية `flow.service.ts`: إضافة وظيفة معالجة وفحص الصور وتنزيل الملفات المؤقتة من تيليجرام وتمريرها لمحرك الذكاء الاصطناعي لتخفيف العبء عن الـ Handler.
  - [x] ترقية `flow.keyboard.ts`: بناء كيبورد شاشة المراجعة الذكية `aiConfirmationKeyboard` وأزرار التعديل والتخطي.
  - [x] ترقية `flow.messages.ts`: بناء بطاقة مراجعة بيانات الذكاء الاصطناعي المستخرجة ورسائل تعديل الحقول الموضعية.
  - [x] ترقية `flow.handler.ts`:
    * معالجة استقبال صور الوجه والظهر والتحقق منها عبر المحرك المشترك.
    * معالجة زر الاعتماد `wizard:worker:ai_approve` والانتقال المباشر لخطوة الهاتف.
    * معالجة أزرار التعديل الموضعي للبيانات المستخرجة والعودة الموضعية لـ `AI_CONFIRMATION`.
    * الحفاظ التام على سقف الأسطر (346 سطراً <= 350 سطراً) والصفر `any`.
  - [x] تحديث `flow.contract.json` لتوثيق نقاط الدخول والأزرار الجديدة وحصانة التنقل في `ScreenFlowService`.
  - [x] تسجيل مسارات ردود النداء في `modules/workforce/src/module.routes.ts`.

- [x] **المرحلة 4: الاختبارات الشاملة وضمان Zero-Regression**
  - [x] تشغيل اختبارات الحزمة `@alsaada/ai-vision-engine` (9/9 PASS).
  - [x] إثراء وتحديث اختبارات `01.1-worker-registration` في `flow.unit.spec.ts` و `flow.ux.spec.ts` (34/34 PASS).
  - [x] تشغيل اختبارات بوت سيرفر `apps/bot-server/tests/worker-ai-vision.spec.ts` (7/7 PASS).
  - [x] تشغيل `pnpm flow:check modules/workforce/src/flows/01.1-worker-registration` (30/30 PASS).
  - [x] تشغيل `pnpm typecheck` بنجاح عبر كافة حزم ومشاريع مساحة العمل الـ 12.
