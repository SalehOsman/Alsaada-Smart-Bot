# 📋 خطة العمل رقم 27: تسجيل إحداثيات المواقع عبر تيليجرام GPS، تحصين مسار التتبع، وأزرار التنقل والرجوع الموحدة (Shared Kernel First)
## Master Work Plan 27: Universal Governorate Picker, Universal Location Capture, and In-Place Flow Lifecycle

> [!IMPORTANT]
> **الحالة:** 🟢 مكتمل ومعتمد 100%  
> **التاريخ:** 2026-09-15  
> **المرجع والتدفق المستهدف:** الحزمة المشتركة `@alsaada/core-components` والتدفق `00.2` (مصفوفة ودليل المواقع والمشاريع التشغيلية) في موديول الإعدادات (`modules/settings/src/flows/00.2-sites-hub/`).  
> **دستور العمل:** الالتزام الصارم بدستور الحوكمة (`AGENTS.md`): حظر إعادة كتابة الأكواد وتكرار المنطق، تأسيس الوظائف المشتركة في حزم النواة (`packages/*`)، سقف أسطر المعالج أقل من 350 سطراً، خلو تام من `any`، والتحكم الموضعي أحادي الرسالة (In-Place Single Message Lifecycle).

---

### 1️⃣ الدوافع والمراجعة المعمارية للنواة المشتركة (Shared Kernel SSOT Audit)
1. **استئصال تكرار مصفوفة المحافظات الـ 27:**
   - بدلاً من تكرار مصفوفات المحافظات يدوياً داخل موديولات الأعمال (`00.2-sites-hub`, `01.2.D-worker-edit`)، يتم استيرادها مركزياً من `EGYPTIAN_GOVERNORATES` في `@alsaada/national-id-engine`.
   - بناء محرك موحد لاختيار المحافظات (`UniversalGovernoratePicker`) في `@alsaada/core-components` مع ترقيم الصفحات التلقائي (3 صفحات × 9 محافظات) وأزرار التنقل والرجوع.
2. **محرك موحد لطلب واقتناص إحداثيات الموقع (GPS):**
   - بناء `UniversalLocationPicker` في `@alsaada/core-components` ليكون معياراً عاماً لأي تدفق يتطلب إحداثيات جغرافية (تسجيل المواقع، الحضور الميداني، تسليمات الموردين).
   - توفير بطاقة إرشادية موحدة تشرح طريقة الإرسال من التيليجرام 📎 مع كيبورد التخطي والرجوع والإلغاء.
3. **تعميم محرك دورة حياة الرسالة الواحدة (`InPlaceFlowManager`):**
   - اعتماد `renderInPlaceWizardStep` و `renderInPlaceCompletion` لمعالجة كافة خطوات التدفق:
     - الحذف الصامت لرسائل المستخدم النصية ورسائل الموقع الجغرافي.
     - تعديل نفس الرسالة موضعياً في الشات دون تراكم.
     - تزامن شاشة المستخدم مع مانع الأزرار القديمة (`Stale Button Guard`).
     - تقليص حجم معالج التدفق `flow.handler.ts` إلى ما دون 300 سطر.
4. **لوحة أزرار ما بعد الإنجاز المعيارية (Section 5.2):**
   - اعتماد `buildCompletionKeyboard` عند إتمام إنشاء الموقع بالترتيب الإلزامي: إضافة موقع آخر ➡️ العودة لقائمة المواقع ➡️ القائمة الرئيسية.

---

### 2️⃣ مصفوفة المهام التنفيذية (Milestones & Action Items)

- [x] **المرحلة 1: النواة المشتركة — محرك المحافظات الموحد (`packages/core-components`)**
  - [x] إنشاء `packages/core-components/src/governorate-picker/`:
    - `getGovernoratesList()`: قائمة المحافظات الـ 27 من `@alsaada/national-id-engine`.
    - `buildGovernoratePickerKeyboard(options)`: كيبورد مقسم على 3 صفحات مع أزرار RTL وزر السابق والإلغاء.
  - [x] تصدير المكون من `packages/core-components/src/index.ts`.
  - [x] كتابة اختبارات الوحدة في `packages/core-components/tests/governorate-picker.spec.ts`.

- [x] **المرحلة 2: النواة المشتركة — محرك طلب واقتناص الإحداثيات (`UniversalLocationPicker`)**
  - [x] إنشاء `packages/core-components/src/location-picker/`:
    - `formatLocationPromptCard(options)`: بطاقة الطلب بالمسار التوضيحي.
    - `buildLocationPromptKeyboard(options)`: كيبورد التخطي وزر السابق والإلغاء.
    - `parseTelegramLocation(ctx)`: دالة استخراج الإحداثيات بأمان ودعم Venue والإحداثيات النصية وروابط الخرائط.
  - [x] تصدير المكون من `packages/core-components/src/index.ts`.
  - [x] كتابة اختبارات الوحدة في `packages/core-components/tests/location-picker.spec.ts`.

- [x] **المرحلة 3: تطبيق النواة في تدفق المواقع (`00.2-sites-hub`)**
  - [x] تنظيف `flow.keyboard.ts`: استئصال مصفوفة المحافظات اليدوية واستدعاء المحركات المشتركة وإضافة زر السابق للخطوة الثانية.
  - [x] تنظيف `flow.messages.ts`: اعتماد مسار التتبع المعياري وترقيم الخطوات الخمس.
  - [x] إعادة هيكلة `flow.handler.ts`: استخدام `InPlaceFlowManager` للتنقل الموضعي، وخفض الأسطر لتحت 300 سطر مع معالجة الكود المخصص والإحداثيات النصية وزر الرجوع لكل خطوة.
  - [x] ربط لوحة الإتمام الموحدة `buildCompletionKeyboard` عند نجاح إنشاء الموقع.

- [x] **المرحلة 4: تسجيل المسارات وتحديث العقد (`module.routes.ts` & `flow.contract.json`)**
  - [x] تسجيل استجابة `action:site:add:skip_location` و `action:site:add:back_to_location` و `action:site:add:back_to_name`.
  - [x] توثيق الأزرار الجديدة في `flow.contract.json`.

- [x] **المرحلة 5: الاختبارات والاعتماد الشامل (Zero Regressions)**
  - [x] تشغيل اختبارات النواة المشتركة بنجاح 100% (21 ملفاً، 138 اختباراً).
  - [x] تشغيل اختبارات تدفق المواقع بنجاح 100% (5 ملفات، 38 اختباراً).
  - [x] فحص الحوكمة `flow:check` وفحص التايب سكريبت `pnpm typecheck`.

- [x] **المرحلة 6: مصفوفة حصانة التنقل والمعالجة التلقائية والتنظيف المركزي (Navigation Immunity & Auto-Healing Kernel)**
  - [x] ترقية `ScreenFlowService.isStaleCallback` بمصفوفة حماية التنقل `NAVIGATION_IMMUNITY_PATTERNS` تشمل كافة أزرار التنقل والرجوع والإلغاء وتصفح السجلات والصفحات.
  - [x] تطبيق ميزة المعالجة التلقائية `Auto-Healing` لتحديث مؤشر الشاشة النشطة في Redis تلقائياً دون إظهار أي تنبيه للمستخدم.
  - [x] ربط صائد التنظيف المركزي `Central Garbage Collection Hook` في `bot.ts` لحذف معالجات الإدخال غير المكتملة تلقائياً عند التبديل بين الأقسام.
  - [x] ترقية `InPlaceFlowManager` لقمع معاينات الروابط تلقائياً (`disable_web_page_preview` و `link_preview_options: { is_disabled: true }`).
  - [x] إعادة هيكلة `renderSitesHub` و `renderSiteDetail` لتحويل رسالة التعديل موضعياً (`activeMessageId`) والحفاظ على سقف 347 سطراً (أقل من 350 سطراً، صفر `any`).
  - [x] إعادة بناء حاوية البوت وتشغيلها في دوكر بنجاح تام (`alsaada_enterprise_bot`).
