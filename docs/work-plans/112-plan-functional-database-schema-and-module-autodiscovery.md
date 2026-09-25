# خطة عمل رقم 112: مخطط قاعدة البيانات الوظيفي والاكتشاف التلقائي للموديولات (Wave 2)
## Work Plan 112: Functional Database Schema and Module Auto-Discovery Architecture (Enhanced Specification)

> **الحالة:** 🟡 بانتظار الاعتماد السيادي النهائي (Pending Sovereign Approval)  
> **الفرع المنعزل (OBOO Branch):** `plan/112-functional-database-schema-and-module-autodiscovery`  
> **المرجع الدستوري:** ميثاق `GEMINI.md` (البنود 1، 2، 3، 4، 5، 6، 7، 7.1)، مسار التعديل والإنشاء السيادي (Rulebooks 11 & 12)، مصفوفة بوابات الجودة (G1, G2, G3, G4, G7, G10, G11, G12, G13, G14, G15, G19, G20, G21, G22, G23)  
> **الهيئة الفاحصة والمصممة:** `/jev` (Chief Quality & Forensic Sentinel) × `/saleh` (Sovereign Strategic Advisor)  
> **المحرك السحابي المعتمد:** TypeSafe System One (`jev-latest`) عبر `https://api.typesafe.ai/v1/systemone`  
> **الوثيقة المرجعية الأصلية:** تقرير التدقيق الدوري `docs/periodic-audits/2026-09-25/16-plan-functional-database-schema-and-module-autodiscovery.md`  
> **التحسينات المدمجة:** تم إدماج المقترحات التحسينية الأربعة لمحرك `/jev` (معيار `prismaSchemaFolder`، بروتوكول القفل OTP، الحصانة المالية وسياسة الإيقاف الآمن، وبوابات التسليم المرحلية).

---

## 🔬 0. التشخيص الجنائي للواقع المعماري والمشكلة الأساسية

يعاني المستودع تاريخياً من مركزية ملف قاعدة البيانات العملاق (`packages/database/prisma/schema.prisma` بـ 1869 سطراً)، حيث تتجمع نماذج الـ 126 تدفقاً في ملف واحد غير مملوك للموديولات التي تنفذ وظائفها فعلياً، مما يترتب عليه المشكلات التالية:
1. **غياب ملكية المخططات (Broken Schema Ownership):** الموديولات المستقلة (`modules/workforce`, `modules/settings`) لا تعلن مساهماتها في قاعدة البيانات داخل عقودها (`module.contract.json`)، بينما عقد `modules/sandbox` يعلن ملفات مخطط غير مستخدمة فعلياً.
2. **ازدواجية وهشاشة محركات الاكتشاف والتركيب (Discovery Divergence & Fragile Regex):** أداة التركيب الحالية `tools/modules/compose-database.ts` تبحث عن مجلدات `database/` بشكل مستقل عن سجل الاكتشاف الرسمي `tools/modules/catalog.ts` ومحمل التشغيل `modules-registry.ts`، وتعتمد على الدمج النصي البدائي وحقن العلاقات بالتعبيرات المنتظمة (`RegExp Injection`) بدلاً من المعايير الرسمية لـ Prisma.
3. **وجود نماذج وهمية أو غير مستخدمة (Zombie & Phantom Models):** وجود نماذج وجداول في المخطط لا يقابلها أي استدعاء فعلي في تدفقات Telegram أو لوحة الإدارة.
4. **فجوة المهاجرات في بيئة الـ CI (CI Data-Loss Risk):** استخدام أمر `db:push --accept-data-loss` في الـ CI بدلاً من مسار المهاجرات المنضبط (`prisma migrate deploy`).

```mermaid
flowchart TB
    subgraph Problem["الوضع القائم (Monolithic Fragile Architecture)"]
        CentralSchema["packages/database/prisma/schema.prisma
        (1869 سطراً مركزي + نماذج مهجورة)"]
        RegexCompose["tools/modules/compose-database.ts
        (دمج نصوص بدائي + Regex Injection)"]
        CIPush["CI db:push --accept-data-loss
        (مخاطر فقدان البيانات في الإنتاج)"]
    end

    subgraph Solution["المعمارية المحسنة في WP 112 (Modular Auto-Discovery & prismaSchemaFolder)"]
        direction TB
        Contracts["عقود الموديولات الرسمية
        modules/*/module.contract.json
        (قسم database: schemaFiles + migrationsDir)"]
        UnifiedDiscovery["محرك الاكتشاف الموحد
        tools/modules/catalog.ts
        + compose-database.ts الحتمي"]
        MultiFileSchema[".generated/database/schema/
        00-core.prisma
        10-workforce.prisma
        20-settings.prisma
        (Prisma 7.10.0 Native prismaSchemaFolder)"]
        SafeMigrations["مهاجرات منضبطة ونشر آمن
        prisma migrate deploy (Zero Data Loss)"]
        
        Contracts --> UnifiedDiscovery
        UnifiedDiscovery --> MultiFileSchema
        MultiFileSchema --> SafeMigrations
    end
```

---

## 🎯 الأركان الستة الهندسية المحدثة لخطة العمل 112 (The 6 Architectural Pillars)

---

### الركن الأول (Pillar 1: Scope & Functional Baseline Parity)
- **Scope:**
  1. إجراء جرد ساكن وديناميكي شامل لكافة نماذج `packages/database/prisma/schema.prisma` وربط كل نموذج بمستودعه وتدفقه ومالكه الفعلي (`model → repository/service → entry point/flow → owner`).
  2. تحديث وتوحيد عقود الموديولات (`modules/workforce/module.contract.json`, `modules/settings/module.contract.json`) بإضافة قسم `database` الرسمي، وحسم وضع `sandbox`.
  3. التحول المعماري الشامل من الدمج النصي البدائي إلى معيار مجلد Prisma متعدد الملفات (`previewFeatures = ["prismaSchemaFolder"]`) بتوليد مجلد حتمي منظم (`00-core.prisma`, `10-workforce.prisma`, `20-settings.prisma`) في `.generated/database/schema/`.
  4. نقل نماذج المجال الخاصة بـ `workforce` و `settings` تدريجياً إلى مجلدات الموديولات (`modules/<module>/database/schema.prisma`) مع الإبقاء على النواة المشتركة فقط في `packages/database`.
  5. فرض الحصانة المالية المطلقة (Financial Ledger Immunity) للنماذج الستة وسلاسل الهاش `HMAC-SHA256`.
  6. تطبيق سياسة الإيقاف الآمن (Safe Deprecation Policy) وحظر الحذف الفيزيائي الفوري للنماذج غير المستخدمة.
  7. محاذاة مسارات البناء وتوليد العميل (`packages/database/prisma.config.ts`, `package.json`, Dockerfile, GitHub Actions).
  8. بناء جناح اختبارات ثوابت شامل يمنع أي تعارض في الأسماء أو العلاقات العابرة للموديولات دون عقد مصرح به.
- **Functional Baseline Parity (`F:\HR`):**
  - لا مساس بالحسابات أو الشاشات أو منطق الـ 126 تدفقاً التشغيلية؛ الهدف هو إعادة هيكلة وتوزيع ملكية البيانات مع الحفاظ بنسبة 100% على مطابقة `F:\HR`.

---

### الركن الثاني (Pillar 2: Blast Radius & Target Inventory)
الالتزام بمبدأ **Zero Blast Radius**؛ التعديلات محصورة حصراً في الملفات التالية:
- **عقود الموديولات:**
  - `modules/workforce/module.contract.json`
  - `modules/settings/module.contract.json`
  - `modules/sandbox/module.contract.json`
- **مخططات الموديولات الجديدة:**
  - `modules/workforce/database/schema.prisma`
  - `modules/settings/database/schema.prisma`
- **المخطط المركزي المحدث:**
  - `packages/database/prisma/schema.prisma` (إضافة `prismaSchemaFolder` واحتواء النماذج المشتركة فقط)
  - `packages/database/prisma.config.ts`
  - `packages/database/package.json`
- **أدوات الحوكمة والاكتشاف:**
  - `tools/modules/catalog.ts`
  - `tools/modules/compose-database.ts`
  - `tools/modules/validate-catalog.ts`
  - `tools/modules/tests/database-composition.spec.ts`
- **أدوات البناء والـ CI:**
  - `.github/workflows/ci.yml` (تطبيق التركيب قبل التوليد والنشر)
  - `docker/Dockerfile`
- **التوثيق:**
  - `docs/18-enterprise-schema-and-entity-relationship-model.md`
  - `docs/21-mandatory-module-architecture-and-gates.md`

---

### الركن الثالث (Pillar 3: The 6 Discrete Implementation Tasks & Micro-Gates)

```mermaid
sequenceDiagram
    autonumber
    participant Agent as الوكيل المنفذ
    participant OTP as محرك الأمان OTP
    participant Schema as مخططات الموديولات
    participant Composer as جامع المخططات
    participant CI as بوابة الفحص والـ CI

    Agent->>Schema: المهمة 1: جرد الاستخدام والملكية (قراءة ساكنة)
    Schema-->>Agent: صدور تقرير model-ownership-inventory.json
    Agent->>Schema: المهمة 2: تحديث عقود الموديولات (module.contract.json)
    Agent->>Composer: المهمة 3: محرك الاكتشاف ومعيار prismaSchemaFolder
    Composer-->>Agent: توليد .generated/database/schema/*.prisma
    Agent->>OTP: المهمة 4: طلب ترخيص فك قفل الكيانات المحمية
    OTP-->>Agent: منح OTP مؤقت وإجراء النقل التدريجي للنماذج
    Agent->>OTP: إعادة القفل التلقائي فوراً (pnpm lock)
    Agent->>CI: المهمة 5: محاذاة البناء وإلغاء db:push في CI
    Agent->>CI: المهمة 6: اختبارات الانحدار وبوابات الحوكمة G1-G23
```

#### المهمة 1: تثبيت خط الأساس وجرد استخدام النماذج (Model Usage Inventory)
- مسح كامل لجميع نماذج `packages/database/prisma/schema.prisma`.
- تتبع استدعاءات كل نموذج عبر `ast-grep` والبحث المعجمي في `modules/`, `packages/`, `apps/`.
- تصنيف كل نموذج إلى 4 فئات صريحة:
  1. `SHARED_CORE`: نماذج البنية المشتركة الحقيقية (`CompanyProfile`, `AuditLog`, `SystemConfig`, `User`).
  2. `DOMAIN_WORKFORCE`: نماذج تابعة لإدارة العاملين والتشغيل (`Worker`, `Department`, `JobTitle`, `DutyRoster`, `PayrollRun`).
  3. `DOMAIN_SETTINGS`: نماذج الإعدادات وإدارة النظام.
  4. `DEPRECATED_ISOLATED`: نماذج غير مستخدمة حالياً؛ تُدرج في سجل عزل خاص `docs/schemas/deprecated-models.json` مع **حظر حذفها الفوري** لحماية قواعد البيانات الحية.
- **بوابة تسليم المهمة 1:** إخراج تقرير جرد مفصل في `docs/schemas/model-ownership-inventory.json` وخلوه من أي نموذج غير مصنف.

#### المهمة 2: تعريف حدود الملكية وعقد مساهمة الموديول (`module.contract.json`)
- ترقية مواصفة `module.contract.json` لتدعم قسم قاعدة البيانات الرسمي:
  ```json
  "database": {
    "schemaFiles": ["database/schema.prisma"],
    "relationsFile": "database/relations.contract.json",
    "migrationsDir": "database/migrations"
  }
  ```
- تحديث عقود `modules/workforce` و `modules/settings`.
- تصحيح عقد `modules/sandbox` بضبطه صراحة كعقد اختباري لا يساهم بنماذج إنتاجية.
- **بوابة تسليم المهمة 2:** اجتياز فحص التحقق من صحة العقود `pnpm exec tsx tools/modules/validate-catalog.ts` بنسبة 100%.

#### المهمة 3: توحيد اكتشاف الموديولات وتركيب مجلد Prisma متعدد الملفات
- دمج منطق استكشاف المخططات في `tools/modules/catalog.ts` ليعتمد حصراً على ما تعلنه العقود الرسمية.
- إعادة بناء `tools/modules/compose-database.ts` للتخلي التام عن دمج النصوص والـ Regex Injection، واعتماد ميزة Prisma الرسمية:
  - توليد مجلد `.generated/database/schema/`:
    - `00-core.prisma`: إعدادات `datasource db` و `generator client` والنماذج المشتركة.
    - `10-workforce.prisma`: نماذج موديول القوى العاملة المعلنة في عقده.
    - `20-settings.prisma`: نماذج موديول الإعدادات.
- استخراج `datasource` و `generator` مركزياً وحظر تكرارهما داخل الموديولات.
- حساب بصمة SHA-256 للمخطط المجمع في `manifest.json` لضمان حتمية البناء (Deterministic Build).
- **بوابة تسليم المهمة 3:** تشغيل أداة التركيب والتحقق من سلامة البنية الحتمية بـ `pnpm typecheck` واختبار الوحدة.

#### المهمة 4: نقل النماذج إلى مالكيها تدريجياً وإدارة القفل التشفيري (OTP Protocol)
- **بروتوكول الأمان الدستوري:** قبل البدء في نقل النماذج، يتم طلب ترخيص فك القفل التشفيري المؤقت لكل كيان محمي (`package:database`, `module:workforce`, `module:settings`) عبر رمز OTP الديناميكي وفق ميثاق WP 90.
- نقل نماذج قطاع العاملين إلى `modules/workforce/database/schema.prisma`.
- نقل نماذج الإعدادات إلى `modules/settings/database/schema.prisma`.
- **صمام الحصانة المالية المطلقة:** حظر نقل أو المساس بنماذج قطاع المالية الستة (`FinancialLedger`, `CustodyExpenseItem`, `CustodySettlement`, `HospitalityExpense`, `WorkerExpenseClaim`, `SupplierPayment`) والإبقاء عليها في النواة المشتركة لحماية سلسلة الهاش.
- تشغيل أداة التركيب وتوليد العميل (`prisma generate`).
- **إعادة القفل التلقائي الفوري:** تشغيل `pnpm lock package:database` و `pnpm lock module:workforce` و `pnpm lock module:settings` فور اكتمال النقل، وإصدار بطاقات الإقرار.
- **بوابة تسليم المهمة 4:** اجتياز فحص `pnpm test:target packages/database/tests/` واختبارات التدفقات المتأثرة بنسبة 100%.

#### المهمة 5: محاذاة أدوات البناء والـ CI والـ Dockerfile
- تحديث `packages/database/prisma.config.ts` و `package.json` ليشير مسار المخطط إلى المجلد المولد `.generated/database/schema/`.
- تحديث أوامر `pnpm db:generate` في جذر المشروع والحزم لتشغيل التركيب أولاً (`pnpm db:compose && prisma generate`).
- تصحيح مسار GitHub Actions (`.github/workflows/ci.yml`) بإلغاء `db:push --accept-data-loss` واستبدالها بنشر المهاجرات المنضبط (`prisma migrate deploy`).
- **بوابة تسليم المهمة 5:** محاكاة بناء Docker محلياً واجتياز فحص صحة المهاجرات.

#### المهمة 6: توثيق معايير الحوكمة واختبارات الانحدار الشاملة
- كتابة جناح اختبار شامل `tools/modules/tests/database-composition.spec.ts`:
  - التحقق من رفض أي تكرار في أسماء النماذج أو الحقول (`MODEL_COLLISION`).
  - التحقق من حظر العلاقات العابرة للموديولات دون عقد صريح.
  - التحقق من حتمية التجميع وتطابق بصمة الهاش.
- كتابة جناح ثوابت الموجة الثانية `tests/wave-2-database-composition-invariants.spec.ts`.
- تحديث الوثيقة المعمارية [`docs/18`](docs/18-enterprise-schema-and-entity-relationship-model.md) والوثيقة [`docs/21`](docs/21-mandatory-module-architecture-and-gates.md).
- **بوابة تسليم المهمة 6:** اجتياز الفحص الجنائي الشامل `pnpm pre-commit:fast` و `pnpm lock:verify` بنتيجة:
  > `✅ All entities are cryptographically locked and verified with 0 unsealed modifications.`

---

### الركن الرابع (Pillar 4: Testing & Regression Strategy - TDD)
- تطبيق منهجية **Test-Driven Development (TDD)** الصارمة:
  1. **Red Stage:** كتابة اختبارات التركيب والاكتشاف الموحد (`database-composition.spec.ts`) وفشلها قبل تعديل محرك التركيب.
  2. **Green Stage:** تنفيذ محرك الاكتشاف والتركيب وتوزيع النماذج واجتياز كافة الاختبارات بنجاح.
  3. **Refactor Stage:** ضبط الأداء وتحقيق ميزانية التنفيذ (< 2s).
- **جناح اختبارات الثوابت الدائم:**
  إنشاء `tests/wave-2-database-composition-invariants.spec.ts` للتحقق من سلامة المخطط المولد وسلامة العميل.

---

### الركن الخامس (Pillar 5: Security, RBAC & Cryptographic Lock Plan)
- **قواعد أمان المخطط والحصانة المالية:**
  - تطبيق التشفير الحقلي الصارم (ALE - AES-256-GCM) للبيانات المدنية والرواتب.
  - حظر النماذج مجهولة المالك (Orphan Models).
  - حظر المساس بسلاسل التدقيق المالي المزدوج (Double-Entry Invariant G12/G13).
- **بروتوكول القفل التشفيري التلقائي (Dynamic OTP Protocol):**
  - كل تعديل على كيان محمي يتطلب طلب ترخيص OTP وموافقة صريحة، يتبعه قفل تلقائي حتمي بالهاش SHA-256 فور الانتهاء.
  - اجتياز `pnpm lock:verify` شرط قطعي غير قابل للتجاوز.

---

### الركن السادس (Pillar 6: Quality Gates & Rollback Playbook)
- **مطابقة بوابات الجودة (Quality Gates Compliance):**
  - **Gate G1 (Type Safety):** خلو كامل من `any` واجتياز `pnpm typecheck`.
  - **Gate G2 (10-File Slice Architecture):** احترام حدود الموديولات الـ 10 ملفات ومجلد `database/`.
  - **Gate G4 (Flow & Module Contracts):** مطابقة عقود `module.contract.json`.
  - **Gate G10 (Test Authenticity):** فحص حقيقي لقاعدة البيانات بدون Mocking مفرط.
  - **Gate G11/G12/G13 (Financial Invariants):** الحفاظ التام على سلامة سلاسل الهاش المالي.
  - **Gate G15 (Git Hygiene):** العمل داخل فرع منعزل ونظيف off `main`.
  - **Gate G20 (Database Migration Reversibility):** وجود مهاجرات قابلة للعكس وخلو من فقدان البيانات.
- **خطة التراجع الآمن (Rollback Playbook):**
  - في حال حدوث أي خطأ غير متوقع أثناء التركيب أو التوليد، يتم تفريغ المسار المؤقت `.generated/database/`، والرجوع للنسخة الاحتياطية المستقرة عبر Git دون فقدان أي بيانات.

---

## 🔬 7. استشارة محرك الجودة `/jev` (Pre-Task Plan Readiness Consultation)

- **الهدف الرقابي:** فحص الخطة عبر الأبعاد الـ 10 لمحرك System One السحابي.
- **الحد الأدنى للاعتماد:** تحقيق مؤشر جاهزية **Plan Readiness >= 90%** و **CGI >= 95%**.
- **صيغة الاعتماد السيادي المطلوبة لبدء الكود:**
  > **«موافق على خطة الإصلاح»**
