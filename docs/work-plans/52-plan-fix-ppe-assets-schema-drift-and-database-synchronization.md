# 📋 خطة عمل رقم 52: معالجة الانحراف البنيوي لجدول مهمات الوقاية (PPE Assets) ومزامنة قاعدة البيانات الحية
## PPE Assets Schema Drift & Database Synchronization Remediation

> **مرجع الخطة الدائم:** `docs/work-plans/52-plan-fix-ppe-assets-schema-drift-and-database-synchronization.md`  
> **تاريخ التحرير:** 17-09-2026  
> **الحالة:** 🟢 مكتمل وموثق 100% (تم التطبيق والمزامنة بنجاح)  
> **رمز البلاغ المعالج:** `#ERR-998DB245` (CRITICAL - `cb:menu:wcs:main` - RESOLVED)

---

## 🔍 التحليل الجنائي وجذر المشكلة (Root Cause Forensic Analysis)

1. **طبيعة البلاغ الأمني (#ERR-998DB245):**
   - **المستخدم المتأثر:** `7594239391` (SUPER_ADMIN)
   - **الإجراء المسبب:** `cb:menu:wcs:main` (فتح القائمة الرئيسية لمؤشر التزام العمال)
   - **الخطأ الظاهر:**  
     `Invalid prisma.worker.findMany() invocation:`  
     `The column ppe_assets.siteId does not exist in the current database.`

2. **السبب الجذري المعماري (Architectural Root Cause):**
   - في نموذج Prisma (`packages/database/prisma/schema.prisma`):
     - تم تعريف حقول `siteId String?` و `status String @default("ACTIVE")` في نموذج `PPEAsset`.
     - تم تعريف نموذج `WorkerCommitmentScore` ضمن الخطة رقم 50 (`NEW-80`).
     - تم تعريف حقل `siteId String?` في نموذج `AdvanceRequest`.
   - في قاعدة بيانات PostgreSQL الحية (`alsaada_db`):
     - أنشئ جدول `ppe_assets` في الهجرة الأولى `20260911000000_init_enterprise_hash_ledger` بدون عمودي `siteId` و `status`.
     - لم يتم تطبيق الهجرة `20260916000000_telemetry_bot_performance_columns`.
     - لم يتم إنشاء هجرة رسمية لترقية جدول `ppe_assets` وإنشاء جدول `worker_commitment_scores` وفهارس الأداء المرتبطة بها في قاعدة البيانات الحية.
   - عند قيام تدفق تقييم العمال (`01.9-worker-commitment-index`) باستدعاء `prisma.worker.findMany({ include: { ppeAssets: true, commitmentScores: true } })`، قام Prisma Client بتوليد استعلام SQL يطلب حقول `ppe_assets.siteId` و `ppe_assets.status`، مما أدى إلى فشل الاستعلام فوراً بإنذار `#ERR-998DB245`.

---

## 🛠️ مراحل وخطة التنفيذ (Implementation Stages)

### المرحلة 1: إنشاء ملف الهجرة الرسمي الحصين (`20260917010000_add_ppe_site_and_worker_commitment_scores`)
- إنشاء مجلد وهجرة SQL داخل `packages/database/prisma/migrations/20260917010000_add_ppe_site_and_worker_commitment_scores/migration.sql` تشمل:
  1. إضافة عمود `siteId` وعمود `status` لجدول `ppe_assets` مع القيمة الافتراضية `'ACTIVE'`.
  2. إضافة عمود `siteId` لجدول `advance_requests`.
  3. إنشاء جدول `worker_commitment_scores` بكامل حقوله وفهارسه وقيوده الفريدة (`scoreNumber`, `[workerId, snapshotKey]`).
  4. إنشاء فهارس الأداء والعلاقات المرجعية Foreign Keys (`ppe_assets_siteId_fkey`, `worker_commitment_scores_workerId_fkey`, إلخ).
  5. استخدام عبارات `IF NOT EXISTS` لتفادي أي أخطاء تكرار وضمان الـ Idempotency.

### المرحلة 2: تطبيق الهجرات على قاعدة البيانات الحية (`prisma migrate deploy`)
- تنفيذ `pnpm --filter @alsaada/database db:migrate` لتطبيق كلٍ من:
  - `20260916000000_telemetry_bot_performance_columns`
  - `20260917010000_add_ppe_site_and_worker_commitment_scores`
- التحقق من نجاح المزامنة عبر `prisma migrate status`.

### المرحلة 3: إعادة توليد عميل بريزما (`prisma generate`)
- تشغيل `pnpm --filter @alsaada/database db:generate` لضمان مطابقة عميل Prisma بنسبة 100%.

### المرحلة 4: التحقق والاختبار البرمجي والتكاملي (Verification & Test)
- إجراء فحص استعلام حقيقي على قاعدة البيانات يتضمن `ppeAssets` و `commitmentScores`.
- تشغيل اختبارات التدفق `01.9-worker-commitment-index` للتأكد من عدم وجود أي خطأ أو استثناء.
- تشغيل الفحص البنائي `pnpm typecheck` وفاحص الحوكمة `pnpm arch:verify`.

---

## 📋 جدول متابعة المهام (Task Checklist)

- [x] إنشاء ملف الهجرة `20260917010000_add_ppe_site_and_worker_commitment_scores/migration.sql`.
- [x] تطبيق الهجرات المعلقة والجديدة على قاعدة بيانات PostgreSQL (`prisma migrate deploy`).
- [x] التحقق من استقرار حالة الهجرات (`prisma migrate status = Database schema is up to date`).
- [x] تشغيل اختبار استعلام `worker.findMany({ include: { ppeAssets: true, commitmentScores: true } })`.
- [x] تشغيل اختبارات الموديولات ذات الصلة (`vitest` - نجاح 18 اختباراً للتدفق و 10 اختبارات للمحرك).
- [x] التحقق من الفحص البنائي للتايب سكريبت (`pnpm typecheck` - خروج ناجح 0 أخطاء).
- [x] تحديث وثيقة سجل الترحيل ووثائق خطط العمل.

