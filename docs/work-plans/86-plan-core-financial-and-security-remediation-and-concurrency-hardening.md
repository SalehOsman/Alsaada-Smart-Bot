# 📜 خطة العمل المعمارية رقم 86 (النسخة المعتمدة والموثقة)
## المعالجة الشاملة لثغرات النواة المالية والأمنية وتحصين التزامن وقفل قاعدة البيانات
### Plan 86: Core Financial, Security & Concurrency Hardening with Multi-Agent Teamwork Specification

---

> [!IMPORTANT]
> **حالة الوثيقة:** 🟡 مسودة معتمدة موثقة وجاهزة للتنفيذ (`Documented & Ready for Multi-Agent Execution`)  
> **الفرع المقترح للعمل:** `plan/86-core-financial-and-security-hardening`  
> **الإصدار المستهدف:** `v2.0.0-alpha.86`  
> **المرجعية الدستورية:** ميثاق الحوكمة `AGENTS.md` و `GEMINI.md` + تقرير التدقيق الجنائي المعتمد.

---

### 1️⃣ خلفية التدقيق والدوافع المعمارية (Audit Background & Rationale)

كشف التدقيق الفني والجنائي المتقدم للنواة المشتركة وقواعد البيانات عن 7 ثغرات وفجوات هيكلية حاسمة كانت ستقود إلى **«وهم كاذب بالأمان» (False Sense of Security)** في حال اعتماد القفل التشفيري للنواة المالية والأمنية في هذا التوقيت. 

توضح هذه الخطة المعمارية بنود المعالجة الجذرية بالتفصيل، وتحدد هيكلية فريق الوكلاء المتخصصين، ومعايير القبول الصارمة للتحقق قبل إعادة النظر في قفل النواة تشفيرياً.

---

### 2️⃣ الثغرات الـ 7 المرصودة ونطاق المعالجة الفنية (Forensic Vulnerability Catalog)

#### 1. ثغرة التريجرز والـ Migration الصامت ([migration.sql:26](file:///F:/Alsaada-Smart-Bot/packages/database/prisma/migrations/20260918_immutable_financial_ledger_triggers/migration.sql#L26))
* **الوصف:** استهداف أسماء جداول بصيغة PascalCase قديمة (`SupplierInvoice`, `PayrollTransaction`...) محاطة بـ `IF EXISTS` بينما الجداول الحقيقية في PostgreSQL منشأة بصيغة snake_case (`supplier_invoices`, `financial_ledgers`). النتيجة: نجاح تشغيل الـ Migration بصمت دون تطبيق التريجر على أي جدول فعلي، وغياب جدول `financial_ledgers` كلياً عن المصفوفة.
* **المعالجة:**
  - تعديل مصفوفة الجداول لتشمل أسماء الجداول الفعلية: `financial_ledgers`, `supplier_invoices`, `custody_settlements`, `advance_installments`, `payroll_transactions`, `attendance_records`.
  - إزالة التخطي الصامت وفرض تثبيت التريجر الصارم `enforce_financial_ledger_integrity_trg` لحظر أي تعديل أو حذف للأعمدة المحمية.

#### 2. تسرب القفل الاستشاري وكسر سلسلة الهاش المتزامنة ([hash-ledger.extension.ts:255](file:///F:/Alsaada-Smart-Bot/packages/database/src/ledger/hash-ledger.extension.ts#L255))
* **الوصف:** استدعاء `pg_advisory_xact_lock` عبر كائن `client` العام المفصول عن المعاملة؛ في PostgreSQL يتحرر القفل فور انتهاء الجملة، مما يترك جلب `previousHash` وكتابة السجل الجديد خارج القفل، متيحاً لعمليات متزامنة القراءة المشتركة لنفس الهاش السابق وتفكك السلسلة.
* **المعالجة:**
  - إلزام عمليات إدراج القيود المالية بالدخول في سياق معاملة تفاعلية موحدة (`prisma.$transaction(async (tx) => { ... })`).
  - تنفيذ القفل وقراءة آخر هاش وكتابة القيد الجديد وحساب الهاش كعملية ذرية غير قابلة للتجزئة (Atomic Unit of Work).

#### 3. زيف اختبار الضغط بـ TestMutex اصطناعي ([hash-chain.stress.spec.ts:445](file:///F:/Alsaada-Smart-Bot/packages/database/tests/hash-chain.stress.spec.ts#L445))
* **الوصف:** استخدام كلاس `TestMutex` في الذاكرة داخل الاختبار لجدولة الاستدعاءات ومنع التزامن محلياً في Node.js، مع تزييف `$executeRawUnsafe`.
* **المعالجة:**
  - إزالة `TestMutex` تماماً من الاختبار.
  - كتابة اختبارات تكامل وتزامن حقيقية تطلق طلبات متوازية فعلية للتأكد من قدرة محرك الهاش وقاعدة البيانات على حسم التنافس دون تكرار للهاشات.

#### 4. ثغرة تصعيد الصلاحيات وتجاوز الحدود الجغرافية ([evaluator.ts:331](file:///F:/Alsaada-Smart-Bot/packages/rbac/src/evaluator.ts#L331))
* **الوصف:** إرجاع `{ granted: true }` فور العثور على قاعدة `ALLOW` في مستوى المستخدم أو الدور، وذلك **قبل** التحقق من شرط الموقع الجغرافي `targetSiteId !== siteId` و **قبل** فحص مفاتيح السوبر أدمن السيادية `SOVEREIGN_SUPER_ADMIN_KEYS`.
* **المعالجة:**
  - تقديم فحص حدود الموقع (`SITE_BOUNDARY_VIOLATION`) وفحص المفاتيح السيادية (`ROLE_NOT_AUTHORIZED_FOR_FEATURE`) ليتم تنفيذهما قطيعاً **قبل** فحص قواعد المنح `ALLOW`.
  - تحصين الكتالوج لمنع منح أدوار عادية كـ `WORKER` أي صلاحيات إدارية كـ `workforce.compensation.edit`.

#### 5. طابور الـ Outbox غير المستهلك عملياً ([worker.ts:75](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/outbox-queue/worker.ts#L75))
* **الوصف:** كود معالجة الطابور `processBatch` موجود ومختبر في التيست فقط، ولا يوجد في أي من تطبيقات المنظومة (`apps/bot-server`, `apps/admin-dashboard`) أي Background Daemon أو Worker يقوم باستهلاك وترحيل الأحداث فعلياً لشيتات جوجل.
* **المعالجة:**
  - بناء وتفعيل مستهلك خلفي (Background Polling / Tick Runner) داخل `apps/bot-server` يقوم بتشغيل `processBatch` دورياً.
  - تسجيل المعالجات الحقيقية (Handlers) وتمريرها للمستهلك مع مفاتيح عدم التكرار (Idempotency Keys).

#### 6. مخاطر السقوط للذاكرة في المعاملات المالية ([worker.ts:36](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/outbox-queue/worker.ts#L36))
* **الوصف:** دالة `enqueueTx` تضع الحدث في الذاكرة عند غياب `db`، وتتجاهل التراجع `rollback`، وتفقده عند إعادة التشغيل.
* **المعالجة:**
  - منع التراجع الصامت للذاكرة عند استدعاء `enqueueTx`، وفرض وجود اتصال قاعدة بيانات حقيقي أو إلقاء خطأ تشغيلي صريح.

#### 7. ثغرة قبول قيم NaN المالية ([gate.ts:23](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/custody-gate/gate.ts#L23) و [clearing.ts:85](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/clearing-engine/clearing.ts#L85))
* **الوصف:** استخدام الفحص التقليدي `<= 0` الذي يُرجع `false` عند تمرير `NaN`، مما يسمح بتجاوز الفحص والموافقة على الصرف بمبلغ NaN.
* **المعالجة:**
  - فرض فحص الصلاحية العددية الصارمة: `!Number.isFinite(amount) || amount <= 0`.
  - تطبيق الفحص في كافة محركات العهد، المقاصة، الصرف، وفواتير الموردين.

---

### 3️⃣ هيكلية ومسؤوليات فريق الوكلاء المتخصصين (Teamwork Preview Squad)

| الوكيل المتخصص (Specialist Agent) | نطاق التكليف والمسؤوليات |
| :--- | :--- |
| **🛡️ مهندس الأمان والسيادة (Security & RBAC Architect)** | إعادة هندسة `packages/rbac/src/evaluator.ts`، تقديم حواجز المواقع والمفاتيح السيادية، وتحصين بوابات الصلاحيات. |
| **🗄️ خبير قواعد البيانات والتزامن (Database & Concurrency Specialist)** | تصحيح `migration.sql`، ربط القفل الاستشاري بسياق المعاملة الذرية في `hash-ledger.extension.ts`، وضمان سلامة الهاش شين. |
| **💰 مدقق المحركات المالية والعهد (Financial Engine & Integrity Auditor)** | تحصين `gate.ts` و `clearing.ts` ضد `NaN` و `Infinity`، وضبط حسابات الأرصدة بدقة سنتات. |
| **⚙️ مهندس البنية التحتية والـ Outbox (Core Infrastructure & DevOps Engineer)** | بناء مشغل الـ Outbox في خادم البوت، تصحيح `scaffold-module.ts` لضمان عزل الملفات، وتحديث `docker/Dockerfile`. |
| **🧪 مراجع الجودة والتدقيق الجنائي (Independent QA & Verification Auditor)** | استبدال `TestMutex` باختبارات تزامن حقيقية، كتابة سيناريوهات الاختراق، والتحقق الجنائي الشامل قبل القفل. |

---

### 4️⃣ وثيقة مسودة التكليف الفني المعتمدة (Teamwork Preview Prompt Draft)

```markdown
# Teamwork Project Prompt — Official Sealed Draft

> Status: Ready for launch — awaiting user approval
> Goal: Multi-agent execution of Core Financial, Security & Concurrency Remediation
> Requested team: Full multi-agent team (Database Specialist, Financial Security Architect, Core Infrastructure Engineer, and QA/Verification Auditor)

Comprehensive remediation, concurrency hardening, and cryptographic integrity restoration for the core financial ledger, database immutability triggers, RBAC security gates, transactional outbox queue, and arithmetic validation pipelines across the Alsaada-Smart-Bot system.

Working directory: F:/Alsaada-Smart-Bot
Integrity mode: development

## Requirements

### R1. PostgreSQL Database Immutability Triggers & Schema Alignment
- Re-align the database migration triggers (packages/database/prisma/migrations/20260918_immutable_financial_ledger_triggers/migration.sql) to target the actual physical table names (financial_ledgers, supplier_invoices, custody_settlements, advance_installments, payroll_transactions, etc.) as defined in schema.prisma.
- Eliminate silent failures from table checks so triggers are guaranteed to attach to all financial tables, and include financial_ledgers explicitly.
- Prohibit any direct row updates or deletions on immutable financial columns (amount, worker_id, created_at, current_hash, prev_hash).

### R2. Atomic Advisory Locking & Transactional Ledger Chain Integrity
- Refactor hashLedgerExtension in packages/database/src/ledger/hash-ledger.extension.ts so that PostgreSQL advisory locks (pg_advisory_xact_lock), reading the previous hash (previousHash), and writing the new row with the computed recordHash execute within a single atomic interactive transaction ($transaction).
- Guarantee that concurrent record insertions cannot acquire identical previous hashes or interleave uncommitted states.

### R3. Removal of Synthetic Mutexes & Genuine Database Concurrency Testing
- Overhaul packages/database/tests/hash-chain.stress.spec.ts by removing synthetic in-memory serialization (TestMutex) and mock implementations of $executeRawUnsafe.
- Implement rigorous integration stress tests that execute truly concurrent queries against the database layer to prove race-condition immunity and hash chain continuity.

### R4. Strict RBAC Boundary Immunity & Sovereign Guardrails
- Refactor packages/rbac/src/evaluator.ts so that Site Boundary checks (targetSiteId !== siteId) and sovereign super-admin permission restrictions (SOVEREIGN_SUPER_ADMIN_KEYS) are strictly enforced before any ALLOW rule returns granted: true.
- Ensure role hierarchies prevent lower-tier roles (e.g. WORKER) from claiming administrative capabilities via user-level override misuse.

### R5. Financial Arithmetic Hardening & NaN Immunization
- Harden packages/core-components/src/custody-gate/gate.ts and packages/core-components/src/clearing-engine/clearing.ts to strictly validate Number.isFinite(amount) && amount > 0.
- Explicitly reject NaN, Infinity, negative numbers, and non-numeric inputs, returning structured error payloads with localized Arabic error descriptions.

### R6. Outbox Queue Consumer Runtime & Safe Fallback Architecture
- Implement an active background consumer runtime / daemon for TransactionalOutboxQueue that periodically triggers processBatch with registered handlers in apps/bot-server.
- Fix enqueueTx in packages/core-components/src/outbox-queue/worker.ts so that transactions rolled back in PostgreSQL do not leak orphaned events into memory.
- Enforce idempotency keys and at-least-once delivery guarantees.

### R7. Module Scaffolding Blast-Radius & Dockerfile Hardening
- Refactor tools/scaffold/scaffold-module.ts to eliminate direct mutation of files in apps/bot-server (package.json, modules.registry.ts), relying instead on dynamic discovery or explicit modular registration.
- Update docker/Dockerfile to dynamically support all workspace modules instead of hardcoded dependencies on workforce and settings.
- Reconcile governance.lock.json and documentation so that entity lock states reflect reality.

## Acceptance Criteria

### Security & RBAC Criteria
- [ ] RBAC evaluator test demonstrates that a FIELD_ADMIN assigned to Site A is strictly denied access to Site B (SITE_BOUNDARY_VIOLATION), even if an explicit USER ALLOW rule exists.
- [ ] RBAC evaluator test demonstrates that sovereign admin keys are strictly denied to non-super admin roles regardless of user-level rules.

### Database & Concurrency Criteria
- [ ] PostgreSQL migration script creates active BEFORE UPDATE OR DELETE triggers on financial_ledgers, supplier_invoices, and all other financial tables.
- [ ] Direct SQL UPDATE or DELETE on protected columns in financial_ledgers raises CRITICAL_SECURITY_VIOLATION.
- [ ] Concurrent insertion tests execute parallel workers without in-test mutexes, producing a valid, unbroken cryptographic hash chain where no two consecutive records share identical hashes or timestamps.

### Financial Validation Criteria
- [ ] Unit tests for verifyCustodyBalance and processCashAdvanceClearing pass asserting that NaN, Infinity, -100, null, and undefined are rejected with INVALID_AMOUNT.
- [ ] Zero financial calculations produce NaN in downstream balances.

### Outbox & Infrastructure Criteria
- [ ] Outbox queue tests verify that aborted/rolled-back transactions leave zero events in queue.
- [ ] Background worker successfully processes pending outbox batches and marks them COMPLETED.
- [ ] tools/scaffold/scaffold-module.ts runs cleanly without touching files outside the newly created module folder.
- [ ] Monorepo passes typecheck (pnpm tsc --noEmit) and all test suites (pnpm test) cleanly.
```

---

### 5️⃣ معايير القفل النهائي وتوثيق الإنجاز (Final Lock Criteria)
1. اجتياز كافة الاختبارات الآلية بنسبة 100%.
2. إثبات عدم التراجع في أي من بوابات الجودة الـ 21 للمشروع.
3. تقديم تقرير إنجاز ميداني موثق في `docs/ai-execution-evidence/`.
4. طلب إذن القفل التشفيري الحرفي: **«نعم اقفل»** وفق دستور الحوكمة.
