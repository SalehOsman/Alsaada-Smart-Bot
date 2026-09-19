# 📜 خطة العمل المعمارية رقم 86 (النسخة الموسعة الشاملة)
## المعالجة الجنائية الشاملة لثغرات النواة المالية والأمنية والصلاحيات والـ Outbox وتحصين التزامن
### Plan 86: Comprehensive 17-Point Forensic Remediation & Multi-Squad Hardening Specification

---

> [!IMPORTANT]
> **حالة الوثيقة:** 🟡 مسودة معتمدة موسعة وموثقة وجاهزة للتنفيذ (`Approved Comprehensive Draft — Ready for Squad Execution`)  
> **الفرع المقترح للعمل:** `plan/86-core-financial-and-security-hardening`  
> **الإصدار المستهدف:** `v2.0.0-alpha.86`  
> **المرجعية الدستورية:** ميثاق الحوكمة `AGENTS.md` و `GEMINI.md` + التقرير الجنائي الميداني الشامل للثغرات الـ 17.

---

### 1️⃣ خلفية المراجعة الشاملة والدوافع المعمارية (Comprehensive Forensic Rationale)

أسفر التدقيق الجنائي الفني الشامل لكافة قطاعات ومصادر المنظومة (`packages/*`, `apps/*`, `modules/*`, `tools/governance/*`) عن رصد **17 ثغرة وفجوة معمارية حاسمة** تتوزع بين:
1. تسرب أقفال التزامن وكسر السلسلة الجنائية.
2. تزييف اختبارات الضغط والتحقق بـ Mutexes واختبارات تسلسلية شكلية.
3. ثغرات تصعيد الصلاحيات وتجاوز الحدود الجغرافية ومفاتيح السيادة.
4. ثغرات حسابية تقبل `NaN` و `Infinity` في محركات العهد، المقاصة، والأقساط.
5. تسريب الحذف الآمن (Soft Delete) في عمليات التعديل والدمج.
6. انفصال طابور الـ Outbox ومستودعات الأقفال عن الواقع التشغيلي الفعلي.
7. تعطيل الخوارزميات الرسمية للهوية وتسريب المفاتيح وتسمم أنواع الكاش في الذاكرة.

تهدف هذه الخطة إلى هندسة المعالجة الجذرية لكافة هذه النقاط الـ 17 وفق مبدأ **«العلاج الهيكلي الشامل والأثر الصفري على استقرار المنظومة»** قبل السماح بأي قفل تشفيري للنواة.

---

### 2️⃣ الفهرس الجنائي المعتمد للثغرات الـ 17 ونطاق المعالجة (The 17 Forensic Pillars)

#### 🛡️ أولاً: محور الأمان والصلاحيات والهوية (Security & RBAC Squad)

1. **تصحيح فاحص الصلاحيات وتقديم حواجز المواقع والسيادة على المنح ([evaluator.ts:331](file:///F:/Alsaada-Smart-Bot/packages/rbac/src/evaluator.ts#L331)):**
   - تقديم فحص حدود الموقع (`SITE_BOUNDARY_VIOLATION`) وفحص مفاتيح السوبر أدمن السيادية (`ROLE_NOT_AUTHORIZED_FOR_FEATURE`) ليتم تنفيذهما قطيعاً **قبل** فحص قواعد المنح `ALLOW`.
2. **حظر حقن الصلاحيات السيادية من قِبل الـ `GENERAL_ADMIN` ([route.ts:79](file:///F:/Alsaada-Smart-Bot/apps/admin-dashboard/src/app/api/permissions/matrix/route.ts#L79)):**
   - إضافة فحص في نقطة النهاية `POST /api/permissions/matrix` يمنع منعاً باتاً غير السوبر أدمن من تعيين سياسة `ALLOW` على أي ميزة مدرجة في `SOVEREIGN_SUPER_ADMIN_KEYS`.
3. **فرض قيود الموقع الجغرافي في واجهة برمجة تسجيل العمال ([workers/route.ts:14-25](file:///F:/Alsaada-Smart-Bot/apps/admin-dashboard/src/app/api/workers/route.ts#L14-L25)):**
   - إلزام التحقق من مطابقة `body.siteId === user.assignedSiteId` عندما يكون المستخدم `FIELD_ADMIN`، وإرجاع `403 Forbidden` عند أي محاولة لتسجيل عمال في مواقع أخرى.
4. **استئصال التتويج العشوائي لمسؤولي المواقع غير المعينين ([auth.middleware.ts:24-37](file:///F:/Alsaada-Smart-Bot/apps/bot-server/src/middlewares/auth.middleware.ts#L24-L37)):**
   - إلغاء دالة `resolveDefaultFieldAdminSiteId()` تماماً؛ وإذا كان الـ `FIELD_ADMIN` غير مسند لموقع صريح في قاعدة البيانات، يتم حجب وصوله وإظهار رسالة تحذيرية صريحة تطالبه بمراجعة الإدارة بدلاً من منحه أول موقع نشط عشوائياً.
5. **استئصال الملح التشفيري الثابت من الكود المصدري ([workers/[id]/route.ts:133](file:///F:/Alsaada-Smart-Bot/apps/admin-dashboard/src/app/api/workers/%5Bid%5D/route.ts#L133)):**
   - إزالة النص الثابت `'default-salt-value-for-alsaada-2026'` وإلزام جلب `BLIND_INDEX_SECRET` من البيئة المشفرة، وإلقاء استثناء فوري عند غيابه.
6. **تفعيل خوارزمية Modulo-11 للرقم القومي المصري إلزامياً ([parser.ts:126](file:///F:/Alsaada-Smart-Bot/packages/national-id-engine/src/parser.ts#L126)):**
   - جعل التحقق من الخانة الـ 14 (Check Digit) عبر خوارزمية السجل المدني **مفعلاً افتراضياً (Default: Strict)** لرفض أي بطاقات قومية عشوائية أو مزورة في كافة التدفقات والـ OCR.

---

#### 💰 ثانياً: محور المحركات المالية والحسابات والتزامن (Financial & Concurrency Squad)

7. **تصحيح تريجرز قاعدة البيانات والـ Migration الصامت ([migration.sql:26](file:///F:/Alsaada-Smart-Bot/packages/database/prisma/migrations/20260918_immutable_financial_ledger_triggers/migration.sql#L26)):**
   - تصحيح مصفوفة الجداول لتستهدف الأسماء الفعلية في PostgreSQL بصيغة `snake_case` (`financial_ledgers`, `supplier_invoices`, `custody_settlements`, `advance_installments`, `payroll_transactions`)، وحذف التجاوز الصامت `IF EXISTS`.
8. **حصر القفل الاستشاري وسلسلة الهاش في معاملة ذرية موحدة ([hash-ledger.extension.ts:255](file:///F:/Alsaada-Smart-Bot/packages/database/src/ledger/hash-ledger.extension.ts#L255)):**
   - ربط `pg_advisory_xact_lock` وجلب `previousHash` وحساب الهاش وكتابة السجل داخل معاملة تفاعلية موحدة (`prisma.$transaction`) تمنع تفكك السلسلة عند التزامن.
9. **استئصال `TestMutex` الاصطناعي وبناء اختبارات تزامن حقيقية ([hash-chain.stress.spec.ts:445](file:///F:/Alsaada-Smart-Bot/packages/database/tests/hash-chain.stress.spec.ts#L445)):**
   - إزالة كلاس `TestMutex` من الاختبار واختبار المحرك ضد استدعاءات متوازية فعلية تثبت عدم توليد أي تضارب أو تجزئة في الهاش.
10. **تحصين محركات الصرف والعهد والمقاصة ضد قيم `NaN` ([gate.ts:23](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/custody-gate/gate.ts#L23) و [clearing.ts:85](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/clearing-engine/clearing.ts#L85)):**
    - تطبيق الفحص الرياضي الصارم `!Number.isFinite(amount) || amount <= 0` ورفض أي قيم شاذة بإلقاء خطأ عربي صريح.
11. **تحصين محرك الأقساط الشهرية ضد `NaN` ([installment-engine/engine.ts:37](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/installment-engine/engine.ts#L37)):**
    - إلزام فحص `Number.isFinite(totalAmount) && totalAmount > 0` في `UniversalInstallmentEngine`.
12. **سد ثغرة تسرب قيمة `Infinity` في المبالغ والكميات ([numbers.ts:38](file:///F:/Alsaada-Smart-Bot/packages/regional-engine/src/numbers.ts#L38) و [validator.ts:28](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/amount-picker/validator.ts#L28)):**
    - تعديل `parseRegionalNumber` و `validateAmount` و `validateQuantity` لرفض `Infinity` وفحص `Number.isFinite` قطيعاً.
13. **ضبط حدود محرك احتساب أيام الراحة المكتسبة ([shift-accrual/engine.ts:16](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/shift-accrual/engine.ts#L16)):**
    - التحقق الصارم من أن `presenceDays` رقم موجب ومحدود لا يتجاوز 365 يوماً في الاستدعاء الواحد.
14. **ربط وتفعيل مستودع العهد الذري `CustodyTransactionRepository` في التدفقات الفعلية ([custody-transaction.repository.ts](file:///F:/Alsaada-Smart-Bot/packages/database/src/repositories/custody-transaction.repository.ts)):**
    - استيراد واستخدام المستودع في تدفقات الصرف المالي الفعلي وحصر استدعاء `findAndLock` داخل معاملة ذرية إلزامية.

---

#### 🗄️ ثالثاً: محور البنية التحتية والـ Outbox وقواعد البيانات والذكاء الاصطناعي (Infrastructure & Data Squad)

15. **تحصين الحذف الآمن ومنع تسريب التعديل والدمج ([soft-delete.extension.ts:150-205](file:///F:/Alsaada-Smart-Bot/packages/database/src/extensions/soft-delete.extension.ts#L150-L205)):**
    - إضافة اعتراض صريح لعمليات `update`, `updateMany`, و `upsert` لضمان حقن شرط `where: { isDeleted: false }` ومنع تعديل أو إحياء السجلات المفصولة أو المحذوفة.
16. **تشغيل مستهلك الـ Outbox وضمان ذرية انبعاث الأحداث ([worker.ts:75](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/outbox-queue/worker.ts#L75) و [flow.repository.ts:574](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.8-worker-offboarding/flow.repository.ts#L574)):**
    - بناء مشغل خلفي دوري (Background Poller) في `apps/bot-server` يستدعي `processBatch` دورياً لترحيل الأحداث لشيتات جوجل.
    - تصحيح استدعاءات الـ Outbox في تدفقات إنهاء الخدمة والتسجيل لتكون حصراً ضمن المعاملة الذرية `tx.outboxEvent.create`.
17. **معالجة تسريب مفاتيح الذكاء الاصطناعي وتسمم كاش Redis ([ai-vision-engine/engine.ts:121](file:///F:/Alsaada-Smart-Bot/packages/ai-vision-engine/src/engine.ts#L121) و [fast-cache.service.ts:48](file:///F:/Alsaada-Smart-Bot/apps/bot-server/src/services/fast-cache.service.ts#L48)):**
    - نقل مفتاح Gemini API من الـ URL إلى الـ Header الرسمي `x-goog-api-key`.
    - تصحيح تسلسل واسترجاع الـ `BigInt` في كاش Redis لمنع تحويل `telegramId` إلى نصوص وكسر مقارنات الهوية.
    - تحديث `docker/Dockerfile` وبوابة `verify-financial-integrity.ts` لتشمل فحص التزامن المتوازي الحقيقي ودعم كافة الموديولات ديناميكياً.

---

### 3️⃣ هيكلية ومسؤوليات فرق العمل المتخصصة (Multi-Squad Execution Matrix)

| الفريق المتخصص (Specialist Squad) | نطاق المسؤوليات والملفات المستهدفة |
| :--- | :--- |
| **🛡️ فريق الأمان والسيادة والهوية (Security & RBAC Squad)** | معالجة البنود (1، 2، 3، 4، 5، 6) في `packages/rbac`, `apps/admin-dashboard/src/app/api`, `apps/bot-server/src/middlewares`, `packages/national-id-engine`. |
| **💰 فريق المحركات المالية والعمليات والتزامن (Financial & Concurrency Squad)** | معالجة البنود (7، 8، 9، 10، 11، 12، 13، 14) في `packages/database`, `packages/core-components`, `packages/regional-engine`. |
| **🗄️ فريق قواعد البيانات والـ Outbox والدوكر (Database & Infrastructure Squad)** | معالجة البنود (15، 16، 17) في `packages/database/src/extensions`, `packages/core-components/src/outbox-queue`, `apps/bot-server`, `packages/ai-vision-engine`, `docker/Dockerfile`. |
| **🧪 هيئة المحلفين والتحقق الجنائي المستقل (Independent QA & Forensic Auditors)** | كتابة اختبارات إحباط التسلل والتنافس المتوازي الحقيقي، التحقق من عدم وجود أي Mocking خادع، وفحص التراجع الشامل. |

---

### 4️⃣ وثيقة مسودة التكليف الفني المعتمدة لفريق الوكلاء (Teamwork Preview Prompt Draft)

```markdown
# Teamwork Project Prompt — Official Sealed 17-Point Remediation

> Status: Ready for launch — awaiting user approval
> Goal: Comprehensive 17-point forensic hardening across core financial, security, RBAC, outbox, and data layers
> Requested team: Full multi-agent team (Security & RBAC Architect, Database & Concurrency Specialist, Financial Auditor, Infrastructure & Outbox Engineer, and QA Verifier)

Execute complete forensic remediation of the 17 architectural and security vulnerabilities discovered in Al-Saada Smart Bot core packages, apps, and database layers, ensuring authentic concurrency safety, strict role and site isolation, numerical immutability, and zero false-pass testing.

Working directory: F:/Alsaada-Smart-Bot
Integrity mode: development

## Requirements

### R1. RBAC Prioritization & Sovereign Protection
- Refactor `packages/rbac/src/evaluator.ts` so Site Boundary (`targetSiteId !== siteId`) and Sovereign Super Admin Keys (`SOVEREIGN_SUPER_ADMIN_KEYS`) checks execute strictly before any `ALLOW` rule returns `granted: true`.
- Guard `POST /api/permissions/matrix` in `apps/admin-dashboard` so non-super admins (`GENERAL_ADMIN`) are explicitly prohibited from mutating policies on sovereign feature keys.

### R2. Field Admin Site Boundary & Fallback Hardening
- Enforce strict site boundary checks in `apps/admin-dashboard/src/app/api/workers/route.ts` requiring `body.siteId === user.assignedSiteId` for `FIELD_ADMIN`.
- Eliminate `resolveDefaultFieldAdminSiteId()` in `apps/bot-server/src/middlewares/auth.middleware.ts`; unassigned field admins must be denied operational site access until explicitly assigned.
- Eliminate hardcoded fallback secret in `apps/admin-dashboard/src/app/api/workers/[id]/route.ts`, enforcing strict environment variable resolution for blind indexing.

### R3. Mandatory National ID Check-Digit Enforcement
- In `packages/national-id-engine/src/parser.ts`, make the Modulo-11 14th check digit validation strictly active by default across all workflows and OCR pipelines.

### R4. Database Immutability Triggers & Atomic Hash Chain Transaction
- Fix `20260918_immutable_financial_ledger_triggers/migration.sql` to bind triggers to actual PostgreSQL snake_case tables (`financial_ledgers`, `supplier_invoices`, etc.) and prevent silent bypasses.
- Refactor `hashLedgerExtension` so that `pg_advisory_xact_lock`, previous hash fetching, and record creation execute inside an atomic interactive transaction.
- Remove synthetic `TestMutex` in `packages/database/tests/hash-chain.stress.spec.ts` and verify authentic database concurrency.

### R5. Numerical & Arithmetic Validation Hardening (NaN & Infinity)
- Update `packages/core-components/src/custody-gate/gate.ts` and `clearing.ts` to strictly validate `Number.isFinite(amount) && amount > 0`.
- Update `packages/core-components/src/installment-engine/engine.ts` to strictly reject non-finite and `<= 0` total amounts.
- Update `packages/regional-engine/src/numbers.ts`, `amount-picker`, and `quantity-picker` to strictly reject `Infinity` and `-Infinity`.
- Validate `presenceDays` in `packages/core-components/src/shift-accrual/engine.ts` to prevent negative or non-finite leave accruals.

### R6. Custody Repository Integration & Soft Delete Mutation Protection
- Integrate `CustodyTransactionRepository` into active financial flows with mandatory transaction wrapping.
- Intercept `update`, `updateMany`, and `upsert` in `packages/database/src/extensions/soft-delete.extension.ts` to inject `where: { isDeleted: false }`.

### R7. Outbox Background Daemon & Integration Hygiene
- Implement an active background runner in `apps/bot-server` executing `processBatch` for `TransactionalOutboxQueue`.
- Ensure all outbox events (including offboarding in `01.8`) emit strictly within transactional boundaries (`tx.outboxEvent.create`).
- Move Gemini API key from query param to `x-goog-api-key` header in `packages/ai-vision-engine/src/engine.ts`.
- Fix BigInt serialization/deserialization in `apps/bot-server/src/services/fast-cache.service.ts`.
- Update `docker/Dockerfile` to dynamically discover and build all workspace modules.

## Acceptance Criteria

### Security & Identity Criteria
- [ ] Automated test proves a `FIELD_ADMIN` assigned to Site A is denied creating workers in Site B (`403 Forbidden`).
- [ ] Automated test proves a `GENERAL_ADMIN` cannot grant `ALLOW` on sovereign super admin features via the matrix API.
- [ ] National ID parser rejects invalid 14th check digit by default without requiring explicit options.
- [ ] Unassigned field admins in bot-server are denied site actions without acquiring random company sites.

### Financial & Concurrency Criteria
- [ ] Unit tests prove `NaN`, `Infinity`, and negative amounts are rejected with `INVALID_AMOUNT` in custody gate, clearing engine, installment engine, and amount pickers.
- [ ] Concurrent insertion test against database executes parallel workers without in-test mutexes and produces an unbroken, monotonic cryptographic hash chain.
- [ ] PostgreSQL trigger strictly blocks direct SQL `UPDATE` or `DELETE` on protected columns in `financial_ledgers` and `supplier_invoices`.

### Database & Outbox Criteria
- [ ] Soft delete test proves `prisma.worker.update` and `updateMany` cannot mutate records where `isDeleted: true`.
- [ ] Outbox queue tests verify background processing drains pending events, and failed transactions roll back outbox events cleanly.
- [ ] All monorepo packages compile strictly under TypeScript 5.9+ with zero lint errors and pass all Vitest suites.
```

---

### 5️⃣ معايير القفل النهائي وتوثيق الإنجاز (Final Immutability Protocol)
1. اجتياز كافة الاختبارات الآلية واليدوية بنسبة 100%.
2. إثبات عدم التراجع في أي من بوابات الجودة الـ 21 للمشروع.
3. تقديم تقرير إنجاز ميداني موثق في `docs/ai-execution-evidence/`.
4. طلب إذن القفل التشفيري الحرفي: **«نعم اقفل»** وفق دستور الحوكمة.
