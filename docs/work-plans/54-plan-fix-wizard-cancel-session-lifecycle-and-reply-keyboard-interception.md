# 📋 خطة عمل رقم 54 (النسخة النهائية المحصنة): الاستئصال المعماري لخلل دورة حياة معالج تسجيل العمال، تفعيل كولباكات المعالج، وتطهير اعتراض أزرار الكيبورد
## Enterprise Architecture Hardening: Worker Wizard Lifecycle, Full Route Parity & Microkernel Message Bus

> **مرجع الخطة الدائم:** `docs/work-plans/54-plan-fix-wizard-cancel-session-lifecycle-and-reply-keyboard-interception.md`  
> **تاريخ التحرير والتنقيح الاستشاري:** 17-09-2026  
> **الحالة:** 🟢 مسودة نهائية محصنة ومعتمدة بانتظار ترخيص فك القفل (Hardened & Pending Unlock Approval)  
> **الميثاق المرجعي:** بند 1.6 من `AGENTS.md` (بروتوكول فك القفل الحصري)، ميثاق Plan 43 (المايكروكرنل والناقل الموحد)، وبروتوكول النقد الذاتي للمجال (`expert-critique-protocol.md`).

---

## 🧐 تقرير النقد الاستشاري الصارم للمسودة السابقة (Adversarial Architectural Critique)

بصفتي خبيراً واستشارياً للمنظومة البرمجية، قمت بتشريح المسودة الأولية تشريحاً نقدياً لاذعاً كشف عن **4 فجوات معمارية خطيرة كانت ستؤدي إلى انتكاسات كارثية لو طُبقت المسودة القديمة**:

| # | موضع النقد في المسودة السابقة | العيب المعماري المكتشف | المعالجة النهائية المحصنة في هذه الخطة |
| :---: | :--- | :--- | :--- |
| **1** | **الحل السطحي لاختطاف الكيبورد:** الاكتفاء بإضافة `🖥️ فتح لوحة التحكم` داخل فاحص `isNav` المحلي في `module.routes.ts`. | **خرق صارخ لمعمارية المايكروكرنل (Plan 43):** وجود `bot.on('message:text')` محلي داخل الموديول هو التفاف دخيل يسرق الرسائل قبل وصولها لسيرفر البوت `bot.ts`، ويخلق تكراراً ضاراً وسباق معالجة! | **الاستئصال التام:** حذف مستمعات `message:text` و `message:photo` و `message:document` المحلية بالكامل من `module.routes.ts`، والاعتماد الحصري بنسبة 100% على الناقل المعماري الموحد `onTextInput`, `onPhotoInput`, `onDocumentInput` المنظم مركزياً في `bot.ts` بعد فحص الأوامر والتنقل. |
| **2** | **انعزال ذاكرة الجلسات:** ترك جلسات المعالج في `InMemoryWorkerWizardStateStore` (ذاكرة RAM محلية). | **تسريب الجلسات وموت البيانات:** مسح الـ Redis عند الضغط على أزرار التنقل لم يكن يمسح مسودة الـ RAM! كما أن أي إعادة تشغيل لحاوية الدوكر تفقد المستخدمين مدخلاتهم. | **التوحيد السحابي مع Redis:** بناء محول `RedisWorkerWizardStateStore` وربطه بالدوال الجاهزة في `redis.ts` (`setPendingWorkerWizard` بمهلة TTL 1800 ثانية، `clearPendingWorkerWizard`) ليصبح مسح المسودة متزامناً وموحداً في النظام ككل. |
| **3** | **قنبلة الكولباكات الموقوتة (Regex Mismatches):** التركيز فقط على زر الإلغاء وإغفال كولباكات الوظائف والمواقع. | **التعطل الصامت لخطوات المعالج:** كيبورد التدفق يرسل `job:` و `site:` و `job_page:` بينما الكود يتوقع `set_job:` و `set_site:` و `job_p:`! لو أصلحنا زر الإلغاء وحده لتعطل المستخدم في منتصف التسجيل! | **التسجيل الحصري المتطابق لـ 14 كولباك:** تصحيح وتوحيد كافة تعابير Regex للوظائف والمواقع والصفحات، وتسجيل كولباكات `cancel`, `back`, `confirm`, والخيارات الفرعية كاملة. |
| **4** | **ثغرة الاختبارات السابقة:** اختبارات الوحدة السابقة كانت تستدعي دوال الـ Handler مباشرة متجاهلة الـ Routing. | **غياب الأمان ضد الانتكاس (Blind Regression):** لم يكن هناك اختبار واحد يختبر استقبال الكولباك الفعلي أو تفريغ الجلسة من Redis عند التنقل. | **حزمة اختبارات TDD شاملة:** كتابة سيناريوهات تكامل حقيقية تحاكي ضغط الكولباكات، وإرسال نصوص أزرار التنقل أثناء وجود مسودة معلقة للتحقق من عدم اعتراضها. |

---

## 🛠️ تفاصيل التعديلات الهندسية النهائية (Hardened Implementation Specifications)

### 1️⃣ الاستئصال المعماري وتوحيد الناقل في [`module.routes.ts`](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/module.routes.ts)
- استئصال مستمعات grammY المحلية: `bot.on('message:text')`، `bot.on('message:photo')`، و `bot.on('message:document')` من `module.routes.ts`.
- تمرير كافة الأحداث النصية والصور والمستندات حصراً عبر خطافات الناقل المعتمد في `module.register.ts`:
  - `onTextInput` -> يستدعي بلجنات الموديول بالتتابع فقط بعد أن يكون `bot.ts` قد استبعد أوامر النظام (`/cancel`, `/start`, `/menu`) واستبعد أزرار الكيبورد الدائمة (`isNav`).
  - `onPhotoInput` -> يستقبل الصور المفحوصة مركزياً.
  - `onDocumentInput` -> يستقبل المستندات المفحوصة مركزياً.
- ربط `WorkerRegistrationService` بمحول `RedisWorkerWizardStateStore` المستند إلى `redis.ts`.

### 2️⃣ تسجيل وتصحيح كافة مسارات المعالج الـ 14 في [`flows.manifest.ts`](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows.manifest.ts)
- تسجيل المسارات السيادية الثلاثة:
  ```typescript
  bot.callbackQuery('wizard:worker:cancel', async (ctx) => {
    await regHandler.handleCancel(ctx);
  });
  bot.callbackQuery('wizard:worker:back', async (ctx) => {
    await regHandler.handleBack(ctx);
  });
  bot.callbackQuery('wizard:worker:confirm', async (ctx) => {
    await regHandler.handleConfirm(ctx);
  });
  ```
- تصحيح وتوحيد مسارات الوظائف والمواقع لتتطابق حرفياً مع ما يولده `flow.keyboard.ts`:
  ```typescript
  bot.callbackQuery(/^wizard:worker:job_page:(\d+)$/, async (ctx) => {
    if (ctx.match?.[1]) await regHandler.handleJobPage(ctx, parseInt(ctx.match[1], 10));
  });
  bot.callbackQuery(/^wizard:worker:job:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await regHandler.handleJobChoice(ctx, ctx.match[1]);
  });
  bot.callbackQuery(/^wizard:worker:site_page:(\d+)$/, async (ctx) => {
    if (ctx.match?.[1]) await regHandler.handleSitePage(ctx, parseInt(ctx.match[1], 10));
  });
  bot.callbackQuery(/^wizard:worker:site:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await regHandler.handleSiteChoice(ctx, ctx.match[1]);
  });
  ```
- تسجيل كافة كولباكات الخيارات التفاعلية:
  - `/^wizard:worker:pick_nick:(.+)$/` -> `regHandler.handlePickNick`
  - `/^wizard:worker:tr_same:(.+)$/` -> `regHandler.handlePayoutTransferChoice`
  - `/^wizard:worker:payout:(.+)$/` -> `regHandler.handlePayoutChoice`
  - `/^wizard:worker:sdate:(.+)$/` -> `regHandler.handleStartDateChoice`
  - `/^wizard:worker:lic:(.+)$/` -> `regHandler.handleLicenseChoice`
  - `/^wizard:worker:mil:(.+)$/` -> `regHandler.handleMilitaryChoice`
  - `'wizard:worker:emg:skip'` -> `regHandler.handleSkipEmergencyPhone`
  - `/^wizard:worker:ins:(.+)$/` -> `regHandler.handleInsuranceChoice`
  - `/^wizard:worker:mar:(.+)$/` -> `regHandler.handleMaritalChoice`
  - `/^wizard:worker:retry:(.+)$/` -> `regHandler.handleRetryStep`

### 3️⃣ تحصين مسار الإلغاء والتنظيف الشامل في [`flow.handler.ts`](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.1-worker-registration/flow.handler.ts)
- تحصين `handleCancel` بكتلة حماية شاملة:
  1. الإجابة الفورية لكولباك تليجرام (`ctx.answerCallbackQuery()`).
  2. مسح مسودة العامل من مخزن الحالة نهائياً.
  3. استدعاء `screenFlowService.cleanupUnfinishedFlow` لتطهير الرسائل والـ Redis.
  4. تعديل الرسالة موضعياً لتأكيد الإلغاء مع زر العودة للقائمة الرئيسية، مع `fallback` آمن عبر `ctx.reply` في حال تعذر التعديل الموضعي.

---

## 🧪 خطة التحقق والاختبار الصارمة (TDD Verification Plan)

1. **اختبارات الوحدة والتكامل المؤتمتة:**
   - اختبار النقر على كولباك `wizard:worker:cancel` والتحقق من تفريغ المسودة وظهور رسالة الإلغاء.
   - اختبار النقر على كولباك `wizard:worker:back` والتأكد من الرجوع للخطوة السابقة.
   - اختبار مطابقة كولباكات الوظائف والمواقع والصفحات (`job:`, `site:`, `job_page:`, `site_page:`).
   - اختبار إرسال نصوص أزرار التنقل (`🖥️ فتح لوحة التحكم` و `🏠 القائمة الرئيسية`) والتأكد من عدم اعتراضها أو معاملتها كمدخل في المعالج.
   - تشغيل الاختبارات: `pnpm --filter @alsaada/workforce test src/flows/01.1-worker-registration/tests`.
2. **فحص التايب سكريبت الصارم:**
   - `pnpm typecheck` (0 أخطاء).
3. **فاحص الحوكمة المعمارية والقفل:**
   - `pnpm arch:verify` (PASS).
   - إعادة قفل التدفق بحوكمة التشفير: `pnpm flow:finish workforce-01.1`.

---

## 📋 جدول متابعة المهام (Task Checklist)

- [x] الحصول على ترخيص فك القفل المعتمد من المستخدم بالصيغة الإلزامية: «موافق على الفتح».
- [x] تشغيل أمر فك القفل `pnpm flow:unlock 01.1`.
- [x] استئصال مستمعات النصوص والصور والمستندات المحلية من `module.routes.ts` والاعتماد على الناقل الموحد.
- [x] ربط مخزن Redis للجلسات المؤقتة مع مهلة TTL تبلغ 1800 ثانية (`RedisWorkerWizardStateStore`).
- [x] تسجيل وتصحيح كولباكات المعالج الـ 14 بالكامل في `flows.manifest.ts`.
- [x] تحصين دالة `handleCancel` في `flow.handler.ts` وربط `cancelExitKeyboard`.
- [x] كتابة وتشغيل اختبارات TDD والتأكد من نجاحها 100% (55 اختباراً ناجحاً).
- [x] التحقق من `pnpm typecheck` (0 أخطاء) و `pnpm arch:verify` (PASS).
- [ ] تقديم استفسار القفل وإعادة حماية التدفق تشفيرياً بالصيغة المعتمدة.
