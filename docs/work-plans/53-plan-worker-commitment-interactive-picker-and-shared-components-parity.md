# 📋 خطة عمل رقم 53: دمج قائمة اختيار العاملين التفاعلية (Worker Picker) بمؤشر التزام العمال ومطابقة النواة المشتركة
## Worker Commitment Interactive Picker & Shared Components Parity

> **مرجع الخطة الدائم:** `docs/work-plans/53-plan-worker-commitment-interactive-picker-and-shared-components-parity.md`  
> **تاريخ التحرير:** 17-09-2026  
> **الحالة:** 🟢 مكتمل ومطابق 100% (Completed & Verified)  
> **الميثاق المرجعي:** بند 2.5 من `AGENTS.md` (إلزامية استيراد واستخدام `buildWorkerPickerKeyboard` و `getWorkerDisplayName` و `getJobTitleIcon`).

---

## 🔍 التحليل وسياق التطوير (Context & Problem Statement)

1. **الوضع السابق:**
   - عند الضغط على خيار **«🔍 استعلام تقييم عامل»** (`action:wcs:query`) في تدفق مؤشر التزام العمال (`01.9-worker-commitment-index`)، كان البوت يطلب إدخالاً نصياً يدوياً فورياً:
     `أرسل اسم العامل أو اسم الشهرة أو الكود الوظيفي (مثال: OP-DRV-0015):` دون تقديم أي لوحة تفاعلية لاختيار العمال.
2. **المواصفات المطلوبة بناءً على جلسة التوافق `/grill-me`:**
   - **الظهور الفوري لقائمة العاملين التفاعلية:** عند الضغط على `action:wcs:query`، تظهر لوحة مفاتيح الأزرار الشاملة لاختيار العاملين مباشرة مع التصفح بالصفحات (8 عمال في كل صفحة).
   - **صيغة الأزرار المخصصة للمؤشر:**  
     `[شارة التقييم] [أيقونة المهنة] [اسم الشهرة] - [الدرجة] نقطة`  
     (مثال: `🟢 🚜 صالح رجب - 95 نقطة` أو `🟡 👷 أحمد علي - 72 نقطة` أو `⚪ 🆕 كمال حسن - تحت الاختبار`).
   - **أولوية اسم الشهرة (Nickname Prioritization):** استخدام دالة `getWorkerDisplayName` من `@alsaada/core-components` لعرض اسم الشهرة أولاً مع اللجوء للاسم الرباعي كبديل فقط.
   - **أيقونة المهنة (Job Title Icon):** استخدام دالة `getJobTitleIcon` من `@alsaada/core-components` لتمثيل مهنة العامل بأيقونة تعبيرية دقيقة.
   - **محرك البحث الذكي (Smart Search Filter):**
     - زر مدمج بالقائمة `🔍 بحث بالاسم أو الشهرة أو الكود`.
     - إذا أسفر البحث عن **عامل واحد فقط** مطابق: يتم فتح كارت التقييم الشامل الخاص به فوراً ودون خطوة وسيطة.
     - إذا أسفر البحث عن **عدة عمال**: يتم عرض قائمة مصفاة بالنتائج مع زر `🔄 إلغاء تصفية البحث وعرض كافة العمال`.
   - **تقييد النطاق بالموقع (Site Scoping):** حصر العمال تلقائياً بموقع المشرف إذا كان `FIELD_ADMIN`، وعرض كافة العمال إذا كان `SUPER_ADMIN`.

---

## 🛠️ تفاصيل التعديل البرمجي (Proposed Code Changes)

### 1️⃣ طبقة البيانات والخدمة (`modules/workforce/src/flows/01.9-worker-commitment-index/flow.service.ts` & `flow.repository.ts`)
- إضافة دالة `getWorkersForPicker(siteId?: string, search?: string)` في `WorkerCommitmentService`:
  - تجلب العمال النشطين (مقيدين بـ `siteId` إن وجد).
  - تدعم التصفية حسب `search` (الاسم، اسم الشهرة، أو الكود الوظيفي).
  - تضمين أحدث درجة تقييم لكل عامل (`commitmentScores: { take: 1, orderBy: { evaluationDate: 'desc' } }`).
  - تحويل كل عامل إلى كائن مهيأ لـ `WorkerItem` ومزود بشارة التقييم ودرجته المحسوبة.

### 2️⃣ طبقة لوحات المفاتيح (`modules/workforce/src/flows/01.9-worker-commitment-index/flow.keyboard.ts`)
- بناء دالة `workerPickerKeyboard`:
  - تعتمد على محرك النواة `buildWorkerPickerKeyboard` من `@alsaada/core-components`.
  - تمرر أزرار التصفح الموضعي بالصفحات (`pageCallbackPrefix: 'action:wcs:picker:page:'`).
  - تخصص بادئة اختيار العامل: `workerCallbackPrefix: 'action:wcs:card:'`.
  - تدمج زر البحث `🔍 بحث بالاسم أو الشهرة أو الكود` أو زر إلغاء البحث `🔄 إلغاء البحث وعرض كافة العمال`.
  - أزرار العودة: `backCallbackData: 'menu:wcs:main'`.

### 3️⃣ طبقة الرسائل والتوجيه (`modules/workforce/src/flows/01.9-worker-commitment-index/flow.messages.ts` & `flow.handler.ts`)
- تعديل `flow.messages.ts`:
  - إضافة رسالة `pickerHeader(total: number, page: number, totalPages: number, search?: string)`.
- تعديل `flow.handler.ts`:
  - تحديث `handleSearchPrompt` لتصبح `handleWorkerPicker` تعرض القائمة التفاعلية فوراً.
  - إضافة معالج الضغط على صفحات التصفح: `action:wcs:picker:page:(\d+)`.
  - إضافة معالج البحث النصي وإلغاء البحث: `action:wcs:picker:search_prompt` و `action:wcs:picker:clear_search`.
  - توجيه نتيجة البحث التلقائية: إذا كانت نتيجة البحث عاملاً واحداً، استدعاء `handleWorkerCard` مباشرة.

---

## 🧪 خطة التحقق والاختبار (Verification Plan)

1. **اختبارات الوحدة (Unit Tests):**
   - إضافة اختبارات توليد لوحة أزرار اختيار العاملين وتخصيص نص الأزرار واسم الشهرة في `flow.ux.spec.ts`.
   - اختبار منطق تصفية البحث وتوجيه العامل المفرد في `flow.unit.spec.ts`.
2. **اختبارات التكامل (Integration Tests):**
   - تشغيل `pnpm --filter @alsaada/workforce test src/flows/01.9-worker-commitment-index/tests`.
3. **فحص التايب سكريبت الصارم والحوكمة:**
   - `pnpm typecheck` (صفر أخطاء).
   - `pnpm arch:verify` (PASS).
4. **تحديث سجل الترحيل وخطط العمل:**
   - إغلاق الخطة واعتمادها بنسبة 100%.

---

## 📋 جدول متابعة المهام (Task Checklist)

- [x] إضافة دالة جلب العمال للوحة الاختيار مع أحدث تقييم في `flow.service.ts` و `flow.repository.ts`.
- [x] بناء دالة لوحة المفاتيح `workerPickerKeyboard` المستندة لـ `buildWorkerPickerKeyboard` في `flow.keyboard.ts`.
- [x] تحديث رسائل العرض وتضمين مؤشرات المسار التفاعلية في `flow.messages.ts`.
- [x] تحديث مسارات التوجيه وأزرار التقليب والبحث الذكي في `flow.handler.ts`.
- [x] تحديث اختبارات التدفق في `tests/flow.unit.spec.ts` و `tests/flow.ux.spec.ts`.
- [x] تشغيل اختبارات التدفق والتأكد من نجاحها 100%.
- [x] التحقق من بناء المشروع `pnpm typecheck` والحوكمة `pnpm arch:verify`.
- [x] توثيق الإنجاز وتحديث أرشيف الخطط.

