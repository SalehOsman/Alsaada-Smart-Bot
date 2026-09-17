# خطة عمل رقم 34: حوكمة رسائل الواتساب ونماذج دورات العمل المعتمدة والإدخال اليدوي المخصص
## Plan 34: WhatsApp Onboarding Message Sanitization, Shift Cycle Templates DB Governance & Custom Manual Input

> **الحالة:** 🟢 مكتملة ومنفذة ومختبرة بنسبة 100% (Completed & Verified 100%)  
> **التاريخ:** 15 سبتمبر 2026  
> **المرجع المعماري:** دستور الحوكمة وميثاق النواة المشتركة (`docs/21`, `docs/24`, `packages/database`, `modules/settings/00.3-job-matrix`, `modules/workforce/01.1-worker-registration`)

---

### 1️⃣ خلفية المشكلة والأهداف المحددة (Problem Statement & Scope)

بناءً على الفحص الميداني والملاحظات الدقيقة من الإدارة العليا:

1. **تشوه رسالة الواتساب المجهزة لدعوة العامل الجديد:**
   - ظهور رموز تالفة ( Unicode Replacement Character `\uFFFD`) بسبب الرموز التعبيرية المركبة (Surrogate Pairs & Variation Selectors) عند فك تشفير الرابط في واتساب.
   - ظهور وسيلة الصرف بترميز إنجليزي خام (`CASH_SITE`).
   - خطوط الفواصل والأرقام التعبيرية تسبب تشويشاً لبعض عملاء واتساب على الأجهزة المختلفة.

2. **ظهور نماذج دورات عمل شاذة لا تعبر عن الواقع الميداني (مثل 20 عمل / 30 إجازة):**
   - نتجت عن بيانات تاريخية موروثة في جدول المهن (`job_titles`) حيث كان فني صيانة سيارات مسجلاً بـ 20 عمل و 30 راحة.
   - سجل العامل ابراهيم سيد (`MNT-AUT-001`) بهذه الدورة المشوهة عند التعيين.

3. **غياب جدول مركزي لنماذج دورات العمل في قاعدة البيانات:**
   - الاعتماد السابق على نماذج مشتقة من المهن أو نصوص افتراضية ثابتة في الكود.
   - طلب الإدارة وجود جدول مخصص في قاعدة البيانات لنماذج دورات العمل القياسية يتيح الإضافة والتعديل والحذف مستقبلاً.

4. **الدورات القياسية الأربعة المطلوبة حصراً:**
   - `40 عمل / 10 إجازة`
   - `30 عمل / 10 إجازة`
   - `20 عمل / 10 إجازة`
   - `26 عمل / 4 إجازة`

5. **الحاجة لإمكانية الإدخال اليدوي المخصص:**
   - تمكين السوبر أدمن من إدخال عدد أيام العمل وعدد أيام الإجازة يدوياً خطوة بخطوة من واجهة البوت عند عدم الرغبة في استخدام النماذج القياسية.

---

### 2️⃣ بنود خطة التنفيذ الفني التفصيلية (Implementation Breakdown)

#### البند 1: تنقية وترجمة رسالة الواتساب الترحيبية (`buildWelcomeWhatsAppUrl`)
- **الملف:** `modules/workforce/src/flows/01.1-worker-registration/flow.service.ts`
- **التعديلات:**
  1. استبدال الإيموجيات المسببة لرموز  بنقاط وعناوين نصية أنيقة واضحة (`•`).
  2. ترجمة وسيلة الصرف `payoutMethod` إلى العربية الفصحى المعتمدة:
     - `CASH_SITE` -> `نقداً من الموقع الميداني`
     - `VODAFONE_CASH` / `ORANGE_CASH` / `ETISALAT_CASH` / `WE_PAY` / `SMART_WALLET` -> `محفظة إلكترونية`
     - `INSTAPAY` -> `إنستاباي (InstaPay)`
     - `BANK_ACCOUNT` -> `تحويل بنكي`
  3. استبدال خطوط الصناديق التعبيرية `━━━` بفواصل ASCII قياسية (`----------------------------------------`).
  4. استبدال أرقام الخطوات `1️⃣` و `2️⃣` بأرقام قياسية `1.` و `2.`.

#### البند 2: إنشاء جدول نماذج دورات العمل في قاعدة البيانات (`ShiftCycleTemplate`)
- **الملف:** `packages/database/prisma/schema.prisma`
- **النموذج الجديد:**
  ```prisma
  model ShiftCycleTemplate {
    id             String   @id @default(uuid())
    name           String   // e.g. "دورة قياسية (20+10)"
    workDays       Int      // 20
    restDays       Int      // 10
    totalCycleDays Int      // 30
    isStandard     Boolean  @default(true)
    isActive       Boolean  @default(true)
    displayOrder   Int      @default(0)
    createdAt      DateTime @default(now()) @map("created_at")
    updatedAt      DateTime @updatedAt @map("updated_at")

    @@map("shift_cycle_templates")
  }
  ```
- **ترحيل ومزامنة قاعدة البيانات:**
  - تشغيل `pnpm --filter @alsaada/database exec prisma db push`
  - تشغيل `pnpm --filter @alsaada/database db:generate`
- **بذر (Seed) النماذج القياسية الأربعة المعتمدة:**
  1. `40 عمل / 10 إجازة` (`totalCycleDays: 50`, `displayOrder: 1`)
  2. `30 عمل / 10 إجازة` (`totalCycleDays: 40`, `displayOrder: 2`)
  3. `20 عمل / 10 إجازة` (`totalCycleDays: 30`, `displayOrder: 3`)
  4. `26 عمل / 4 إجازة` (`totalCycleDays: 30`, `displayOrder: 4`)

#### البند 3: تصحيح البيانات الشاذة الموروثة في المهن والعمال
- تشغيل استعلام تصحيحي في قاعدة البيانات:
  - ضبط أي مهنة بها دورة شاذة (مثل `AUT` و `WLD` التي كانت 20/30، و `SAD`, `FIN`, `TYR`, `STR` التي كانت 20/20) لتكون بالدورة القياسية `20 عمل / 10 إجازة` (`workDays: 20, restDays: 10, totalCycleDays: 30`).
  - تحديث سجل العامل ابراهيم سيد (`MNT-AUT-001`) ليكون بنظام دوام `20 يوم عمل / 10 راحة` وإعادة احتساب الأجر اليومي بدقة `dailyWage = (basicSalary + additionalSalary) / 30`.

#### البند 4: ربط واجهات البوت بجدول النماذج ودعم الإدخال اليدوي المخصص
- **في `modules/settings/src/flows/00.3-job-matrix`:**
  1. **تحديث `flow.repository.ts`:**
     - استعلام نماذج دورات العمل النشطة حصراً من جدول `shift_cycle_templates` مرتبة حسب `displayOrder`.
  2. **تحديث `flow.keyboard.ts`:**
     - عرض أزرار النماذج القياسية المسترجعة من قاعدة البيانات:
       - `[ ⚡ 40 عمل / 10 إجازة ]`
       - `[ ⚡ 30 عمل / 10 إجازة ]`
       - `[ ⚡ 20 عمل / 10 إجازة ]`
       - `[ ⚡ 26 عمل / 4 إجازة ]`
     - إضافة زر: `[ ✍️ إدخال يدوي مخصص ]` (`wizard:job:cycle_custom`).
  3. **تحديث `flow.types.ts`:**
     - إضافة حالتي `CUSTOM_CYCLE_WORK_DAYS` و `CUSTOM_CYCLE_REST_DAYS` إلى `JobMatrixEditState`.
  4. **تحديث `flow.handler.ts`:**
     - عند اختيار الإدخال اليدوي:
       - طلب إدخال عدد أيام العمل (بين 1 و 60).
       - في الرسالة التالية: طلب إدخال عدد أيام الإجازة (بين 0 و 30).
       - التحقق من سلامة الأرقام وتطبيعها (`normalizeDigits`).
       - الانتقال إلى شاشة سياسة السريان (المعينون الجدد فقط / جميع العاملين بالوظيفة).

---

### 3️⃣ خطة الفحص والتحقق (Verification Plan)

1. **فحص الحوكمة والتايب سكريبت السريع:**
   - `pnpm flow:check modules/settings/src/flows/00.3-job-matrix`
   - `pnpm flow:check modules/workforce/src/flows/01.1-worker-registration`
2. **تشغيل حزم الاختبارات الآلية:**
   - `pnpm --filter @alsaada/workforce test`
   - `pnpm --filter @alsaada/settings test`
   - `pnpm --filter @alsaada/bot-server test`
3. **فحص التايب سكريبت الشامل:**
   - `pnpm typecheck`
4. **بناء وتشغيل حاوية البوت والتحقق الميداني:**
   - `docker compose build bot`
   - `docker compose up -d bot`
   - فحص صحة الحاوية وعرض نص رسالة الواتساب النظيفة الخالية من أي رموز تالفة.
