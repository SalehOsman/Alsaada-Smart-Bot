# 📋 خطة العمل والتنفيذ رقم 21: التصميم الموحد لمطابقة البوت والداشبورد والمصادقة والصلاحيات
## Master Plan 21: Unified Bot–Dashboard Authentication, RBAC, Functional Parity, and Analytics Implementation Plan

> [!IMPORTANT]
> ### 📜 ميثاق الحوكمة ومرجعية خطة العمل (Governance & Execution Protocol)
> - **رقم الخطة:** `PLAN-21`
> - **التاريخ:** 13-09-2026
> - **الحالة:** 🟢 مكتمل وموثق 100% (Completed, Verified & Architecturally Sealed)
- **النطاق:** البوت، لوحة التحكم، المصادقة، الجلسات، الأدوار، الصلاحيات، جميع الوظائف الحالية والمستقبلية، التحليلات، التوثيق والحوكمة
- **المرجع الوظيفي الأول:** `F:\HR`
- **المشروع المستهدف:** `F:\Alsaada-Smart-Bot`
- **الوثيقة المعمارية المعتمدة (SSOT):** `docs/superpowers/specs/2026-09-13-unified-bot-dashboard-auth-rbac-parity-design.md`
- **البرومبت الصارم لتشغيل الوكلاء:** `docs/ai-execution-prompts/2026-09-13-plan-21-strict-execution-prompt.md`
- **الخطة السابقة المرتبطة:** `PLAN-20` — استعادة الإصدار والمصادقة والرصد الاحترافي
- **منهجية التتبع:** خطوات تنفيذية دقيقة تعتمد صيغة مربعات الاختيار (`- [ ]`)، وقوائم ملفات صريحة، واختبارات آلية مسبقة، وأوامر تحقق بخروج `Exit 0`.

---

## 1. الغرض والهدف المعماري (Goal & Architecture)

### 1.1 الهدف الأساسي (Goal)
إنهاء الازدواجية البرمجية والمعمارية بين بوت تيليجرام ولوحة التحكم، بحيث لا يكونان نظامين منفصلين، بل قناتي عرض وتشغيل لمحرك أعمال واحد (`Single Business Engine`)، وعقد وظائف وصلاحيات مركزي واحد (`Single Source of Truth`).

### 1.2 النتائج العشر الحتمية (The 10 Architectural Outcomes)
1. **المصادقة الحصرية من البوت:** إلغاء صفحة تسجيل الدخول (`/login`) وكافة بوابات الويب وTWA وOTP، وقصر الدخول حصراً على الروابط الصادرة من داخل شاشة إعدادات البوت.
2. **العمل المتزامن للرابطين (Local & Tunnel):** توليد رابط محلي (`http://localhost:3002`) ورابط نفق (`https://...`) متزامنين، برموز مستقلة أحادية الاستخدام صالحة لمدة 5 دقائق، دون تحويل تلقائي بينهما ودون اعتماد على `Host Header` غير موثوق.
3. **حصر الدخول في 3 أدوار إدارية:** دخول الداشبورد مقتصر حصراً على `SUPER_ADMIN` و`GENERAL_ADMIN` و`FIELD_ADMIN`. بقية الأدوار (`WORKER_SUPERVISOR`، `WORKER`، `SUPPLIER`، `GUEST`) تعامل كـ `DENY` في لوحة التحكم وتعمل عبر البوت فقط.
4. **الأدوار السبعة المعتمدة فقط:** تثبيت الأدوار السبعة (`SUPER_ADMIN`، `GENERAL_ADMIN`، `FIELD_ADMIN`، `WORKER_SUPERVISOR`، `WORKER`، `SUPPLIER`، `GUEST`) وترحيل `ADMIN` إلى `FIELD_ADMIN`، وتجميد الأدوار الملغاة (`EXECUTIVE`، `ACCOUNTANT`، إلخ) لحين إعادة التعيين اليدوي.
5. **رتبة العامل المشرف (`WORKER_SUPERVISOR`):** دور تشغيلي مشتق آلياً من وجود تفويض وظيفي دقيق فعال (على مستوى الوظيفة المحددة والموقع المسجل فقط)، ينشأ باعتماد أول تفويض ويسقط تلقائياً بسحب أو انتهاء آخر تفويض، ولا يمنح دخول الداشبورد.
6. **السرية التامة للمستحقات التعاقدية (Strict Compensation Masking):** حجب الراتب الأساسي، الراتب الإضافي، البدلات التعاقدية، وإجمالي المستحقات ومشتقاتها عن `FIELD_ADMIN` على مستوى الخادم والاستعلام وواجهات API والتصدير والإحصائيات.
7. **جلسات خادمية مؤمنة بقاعدة البيانات (8-Hour Server Sessions):** مدة الجلسة 8 ساعات مسجلة في جدول `dashboard_sessions` بـ `sessionHash` مشفر، قابلة للإبطال الفوري، مع إشعار تيليجرام قبل الانتهاء بـ 60 دقيقة يتيح التمديد 8 ساعات أو الإنهاء الفوري.
8. **التطابق الوظيفي الكامل (100% Functional Parity):** تطابق قواعد الأعمال، المدخلات، المخرجات، الحسابات، الحالات، والصلاحيات بين البوت والداشبورد لكافة الوظائف، مع إلزام كل ميزة مستقبلية بالمرور بدورة البوت ثم الداشبورد قبل الإغلاق التوثيقي.
9. **مركز إحصائيات موحد (Centralized Analytics Registry):** اكتشاف آلي لتعريفات التحليلات من عقود الوظائف، مع فلاتر موحدة (موديول، وظيفة، فترة، موقع) وحفظ الحالة في `Query Parameters` ومؤشرات حقيقية خالية من البيانات الوهمية.
10. **الربط مع منظومة الرصد الجنائي (Telemetry & Incident Vault Integration):** خضوع كافة أحداث الدخول، الرفض، التفويض، والتعديل لـ `traceId` موحد عبر حزمة `@alsaada/telemetry` دون استخدام `console.error` أو ابتلاع صامت للأخطاء.

---

## 2. جدول المرجعيات الوظيفية والمطابقة الفنية (SSOT Mapping)

| م | الميزة أو الوظيفة | المرجع في F:\HR | الحالة في البوت الحالي | الإجراء في PLAN-21 |
| :---: | :--- | :--- | :--- | :--- |
| 1 | المصادقة وتسجيل الدخول | البوت هو المصدر الوحيد | `/dashboard` رابط فردي مؤقت | رابطان متزامنان (محلي + نفق) بـ claim ذري خادمي واستئصال `/login` |
| 2 | الجلسات وانتهاء الصلاحية | صلاحية مرتبطة بالمصادقة | لا توجد جلسة خادمية مركزية | جلسات خادمية 8 ساعات بـ `dashboard_sessions` وإشعار تيليجرام قبل ساعة |
| 3 | الأدوار والصلاحيات | أدوار محددة بالرمز السري | 13 دوراً متضارباً وغير موحد | 7 أدوار معيارية، حظر الدخول لما دون الإداريين الثلاثة، حزمة `@alsaada/rbac` |
| 4 | العامل المشرف | تفويضات ميدانية موقعية | دور ثابت أو غير موجود | دور مشتق تلقائياً بوجود تفويض دقيق فعال وينتهي بانتهائه |
| 5 | سرية المستحقات والرواتب | محجوبة بالكامل عن المشرف | مكشوفة جزئياً في الداشبورد | حجب خادمي كامل عن `FIELD_ADMIN` في الصفحات وAPI والتصدير والتحليلات |
| 6 | تعديل بيانات العامل | شاشة البوت `01.2.D` بأربعة ألسنة | صفحة تعديل غير مطابقة | صفحة تعديل مطابقة للألسنة الأربعة مع حصر تعديل الراتب بالسوبر أدمن فقط |
| 7 | استعراض العمالة | دليل العامل `01.5` | قائمة ويب مع كشف الرواتب | مطابقة الدليل وإبراز اسم الشهرة وحجب الرواتب عن المشرف الميداني |
| 8 | تعيين وتفويض المشرفين | البوت `00.10` و `00.11` | غير متوفر بالداشبورد | صفحة إدارة تفويضات المشرفين مع قيود الوظيفة الدقيقة والموقع المعتمد |
| 9 | صندوق الاعتمادات | صندوق موافقات الإجازات والسلف | واجهة غير متزامنة تماماً | مطابقة الصندوق ومسارات الرفض والاعتماد مع النواة المشتركة وتوثيق AuditLog |
| 10 | تصدير إكسيل | تقارير إكسيل البوت | تصدير ويب بكشف الرواتب | تصدير RTL عبر `exceljs` مع حجب مستحقات الرواتب عن المشرف الميداني |
| 11 | مركز التحليلات | إحصائيات وتقارير البوت | شاشات ويب تجريبية | مركز إحصائيات موحد يكتشف العقود آلياً مع فلاتر حقيقية وحفظ المعاملات |
| 12 | الرصد والأعطال | الصندوق الأسود `errorVault` | لوحة أخطاء ويب غير موحدة | ربط كامل مع `@alsaada/telemetry` و `traceId` وتوثيق موحد |

---

## 3. مصفوفة الملفات المقفلة وخريطة النطاق (Locked File Map & Blast Radius)

| المسار | العملية | الوصف والمسؤولية |
|---|---|---|
| `packages/rbac/` | إنشاء | حزمة الصلاحيات والعقود المركزية النقية `@alsaada/rbac` (صفر تبعيات خارجية). |
| `packages/database/prisma/schema.prisma` | تعديل | نماذج `WorkerDelegation` و`DashboardAuthLink` و`DashboardSession` وتحديث علاقات `User` و`Worker` و`Site`. |
| `packages/database/prisma/migrations/` | إنشاء | ملف المهاجرة التراكمي لترقية قاعدة بيانات PostgreSQL 16 وحفظ السجل الجنائي للأدوار الملغاة. |
| `packages/database/tests/` | إنشاء | اختبارات المهاجرة وتدقيق القيود الفريدة وSoft Delete وسجل مراجعة الأدوار الملغاة. |
| `apps/bot-server/package.json` | تعديل | إضافة تبعية الحزمة المركزية `@alsaada/rbac: "workspace:*"`. |
| `apps/bot-server/src/config/env.ts` | تعديل | قراءة متغيرات الرابط المحلي والنفق ومدة الجلسات والأمان. |
| `apps/bot-server/src/services/dashboard-auth.service.ts` | تعديل | إصدار الرابطين المتزامنين وحفظ الرموز بالهاش والتحقق الأمني للأدوار الثلاثة. |
| `apps/bot-server/src/handlers/dashboard.handler.ts` | تعديل | معالجة طلب لوحة التحكم وعرض البطاقات الإدارية وأزرار الرابطين وإدارة الجلسات. |
| `apps/bot-server/src/handlers/start.handler.ts` | تعديل | معالجة رابط البدء العميق `startPayload === 'dashboard_access'` للتحويل المباشر لبطاقة الدخول. |
| `apps/bot-server/src/services/session-monitor.service.ts` | إنشاء | خدمة رصد انتهاء الجلسات وإرسال إشعارات التمديد الآمنة (< 64 bytes callback_data). |
| `apps/bot-server/src/services/command-scope.service.ts` | تعديل | تنقيح مصفوفة أوامر البوت للأدوار السبعة المعتمدة وإضافة `WORKER_SUPERVISOR`. |
| `apps/admin-dashboard/package.json` | تعديل | إضافة تبعية `@alsaada/rbac: "workspace:*"` و `exceljs` و `@types/exceljs`. |
| `apps/admin-dashboard/src/lib/env.ts` | تعديل | تكوين متغيرات بيئة لوحة التحكم والأصول المعتمدة للنفق والمحلي. |
| `apps/admin-dashboard/src/app/api/auth/claim/route.ts` | إنشاء | نقطة النهاية الذرية لاستهلاك رمز الدخول وإصدار جلسة الـ 8 ساعات. |
| `apps/admin-dashboard/src/app/api/auth/logout/route.ts` | تعديل | إنهاء الجلسة خادمياً وحذف الكوكيز والتحويل لرابط البوت العميق. |
| `apps/admin-dashboard/src/app/login/` | حذف كامل | استئصال صفحة الدخول القديمة وملفاتها بعد إثبات البديل والتحقق المرجعي. |
| `apps/admin-dashboard/src/app/api/auth/telegram/` | حذف كامل | حذف نقطة نهاية مصادقة ويدجت تيليجرام القديمة. |
| `apps/admin-dashboard/src/app/api/auth/twa/` | حذف كامل | حذف نقطة نهاية مصادقة Telegram WebApp initData. |
| `apps/admin-dashboard/src/app/api/auth/otp/` | حذف كامل | حذف نقطة نهاية OTP وكلمات المرور المتوقفة. |
| `apps/admin-dashboard/src/app/api/auth/magic/` | حذف كامل | استبدال وحذف الرابط السحري القديم بنقطة `claim` الذرية الجديدة. |
| `apps/admin-dashboard/src/middleware.ts` | تعديل | التحقق الخادمي من الجلسة في PostgreSQL، والتحويل للبوت عند غياب الجلسة (صفر تحويل لـ `/login`). |
| `apps/admin-dashboard/src/lib/rbac.ts` | تعديل | استيراد الصلاحيات من `@alsaada/rbac` وحذف الأدوار الملغاة وتحديث القائمة الجانبية. |
| `apps/admin-dashboard/src/lib/data-fetchers.ts` | تعديل | تطبيق حجب الرواتب الخادمي الصارم لمشرف الموقع عبر دالة الإسقاط `projectSafeWorkerFields`. |
| `apps/admin-dashboard/src/app/admin/page.tsx` | تعديل | صفحة الملخص الديناميكية حسب الدور (`SUPER_ADMIN`، `GENERAL_ADMIN`، `FIELD_ADMIN`). |
| `apps/admin-dashboard/src/lib/analytics-registry.ts` | إنشاء | سجل اكتشاف التحليلات المركزي المرتبط بعقود الوظائف. |
| `apps/admin-dashboard/src/app/admin/analytics/page.tsx` | إنشاء | واجهة مركز الإحصائيات والتحليلات الموحد وحفظ معلمات الاستعلام. |
| `apps/admin-dashboard/src/app/admin/workforce/` | تعديل | مطابقة شاشات شؤون العاملين مع موديول البوت وحجب الرواتب عن مشرف الموقع. |
| `apps/admin-dashboard/src/app/admin/settings/` | تعديل | مطابقة شاشات الإعدادات وتفويض العمال المشرفين وسجل الحوادث. |
| `apps/admin-dashboard/src/app/admin/approvals/` | تعديل | حماية شاشة الموافقات بـ RBAC وربطها بنموذج `ApprovalTicket`. |
| `apps/admin-dashboard/src/app/admin/finance/` | تعديل | حماية شاشات المالية بـ RBAC وتنقية البيانات الوهمية وتوثيق حالة التدفقات كـ قيد الإنجاز. |
| `apps/admin-dashboard/src/app/admin/operations/` | تعديل | حماية شاشات العمليات بـ RBAC وتنقية البيانات الوهمية وتوثيق حالة التدفقات كـ قيد الإنجاز. |
| `apps/admin-dashboard/src/app/api/export/excel/route.ts` | إنشاء | مسار تصدير إكسيل الآمن مع الحجب الخادمي للمستحقات التعاقدية لمشرف الموقع. |
| `apps/admin-dashboard/src/app/api/export/pdf/route.ts` | إنشاء | مسار تصدير PDF الآمن مع الحجب الخادمي للرواتب. |
| `modules/settings/src/flows/00.12-user-rbac-management/` | تعديل | إضافة إدارة تفويضات العامل المشرف وتعديل الأدوار وفق المنظومة السبعة. |
| `modules/workforce/` | تعديل | تعزيز فحص الصلاحيات وعزل المستحقات التعاقدية في البوت. |
| `apps/admin-dashboard/tests/parity/` | إنشاء | اختبارات التطابق الوظيفي بين البوت والداشبورد لموديولات العمالة والإعدادات. |
| `tools/governance/verify-rbac-matrix.ts` | إنشاء | أداة فحص آلية لضمان غياب الأدوار الملغاة وتطبيق المنع الافتراضي. |
| `tools/governance/verify-field-masking.ts` | إنشاء | أداة فحص آلية لضمان عدم تسرب المستحقات التعاقدية لمشرف الموقع. |
| `tools/governance/verify-observability-contract.ts` | إنشاء / فحص | أداة فحص آلية لضمان صفر console.error وصفر ابتلاع صامت للأخطاء وتكامل traceId. |
| `docs/19-legacy-to-enterprise-master-feature-migration-registry.md` | تعديل | تحديث السجل المرجعي بالوظائف المستحدثة (`NEW-60` إلى `NEW-63`) وحالات التطابق. |
| `docs/work-plans/README.md` | تعديل | تحديث فهرس خطط العمل ونتائج الإنجاز. |

---

## 4. المعايير الصارمة للقبول والإغلاق (Definition of Done - DoD)

لا تُعتبر الخطة `PLAN-21` مكتملة نهائياً ما لم تتحقق الشروط التالية بنسبة 100%:
- [x] خروج كافة أوامر الفحص والبناء والاختبار بنتيجة `Exit 0`:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm governance:verify`
  - `docker build -f docker/Dockerfile .`
  - `docker build -f docker/Dockerfile.dashboard .`
  - `docker compose config`
- [x] استئصال كامل وشامل لصفحة `/login` ونقاط نهاية `twa` و`telegram` و`otp` و`magic` دون ترك ملفات ميتة.
- [x] عمل الرابطين المحلي والنفق في الوقت نفسه مع رموز مشفرة صالحة 5 دقائق لمرة واحدة فقط.
- [x] تسجيل جلسات الداشبورد لمدة 8 ساعات في PostgreSQL والتحقق منها خادمياً في كل طلب.
- [x] عمل دورة إشعار تيليجرام قبل انتهاء الجلسة بساعة مع زر تمديد 8 ساعات وزر إنهاء الجلسة.
- [x] قصر الدخول على `SUPER_ADMIN` و`GENERAL_ADMIN` و`FIELD_ADMIN` ورفض ما دونهم بإعادة التوجيه لرابط البوت العميق.
- [x] الحجب الخادمي الكامل للمستحقات التعاقدية (أساسي، إضافي، بدلات، إجمالي) عن `FIELD_ADMIN` في كافة الصفحات، واجهات API، التصدير، والتحليلات.
- [x] عمل دورة حياة العامل المشرف `WORKER_SUPERVISOR` على مستوى الوظيفة الدقيقة والموقع فقط، والتحول التلقائي بين `WORKER` و`WORKER_SUPERVISOR`.
- [x] تطابق كامل بين البوت والداشبورد لكافة موديولات ووظائف المنظومة الحالية.
- [x] توثيق السجل المرجعي `docs/19` بالوظائف المستحدثة وتحديث كافة الوثائق التابعة.

---

## 4. خطة المهام التفصيلية (Task-by-Task Implementation Plan)

---

### المرحلة الأولى: تثبيت خط الأساس وسجل التحقق قبل التعديل
### Phase 1: Baseline Verification & Pre-Change Audit Log

#### Task 1: تثبيت خط الأساس وحفظ نسخة احتياطية لقاعدة البيانات
**المسؤولية:** وكيل المعمارية وDevOps (Architecture & DevOps Agent)  
**الملفات المستهدفة:**
- إنشاء: `docs/periodic-audits/2026-09-13/pre-change-verification-log.md`
- فحص فقط: `docker-compose.yml`, `packages/database/prisma/schema.prisma`

- [ ] **Step 1: تسجيل حالة المستودع والبيئة الفعلية.**
  تشغيل أوامر فحص Git وحالة الحاويات وإصدارات الأدوات وتدوينها في سجل التدقيق:
  ```powershell
  git rev-parse HEAD
  git status --short
  node --version
  pnpm --version
  docker compose ps
  ```

- [ ] **Step 2: أخذ نسخة احتياطية آمنة لقاعدة بيانات PostgreSQL وحساب SHA-256.**
  إنشاء مجلد `.scratch` مؤقت، وتصدير نسخة ثنائية كاملة من قاعدة بيانات الإنتاج/التطوير:
  ```powershell
  New-Item -ItemType Directory -Force .scratch
  docker compose exec -T postgres pg_dump -U alsaada_admin -d alsaada_db -Fc > .scratch/plan21-prechange.dump
  Get-FileHash .scratch/plan21-prechange.dump -Algorithm SHA256 | Select-Object -ExpandProperty Hash
  ```
  *المتوقع:* الحصول على هاش SHA-256 صالح وتدوينه في ملف الدليل لضمان إمكانية الاستعادة بنسبة 100%.

- [ ] **Step 3: فحص حالة المهاجرات وجداول الصلاحيات الحالية.**
  ```powershell
  pnpm --filter @alsaada/database exec prisma migrate status --schema prisma/schema.prisma
  docker compose exec -T postgres psql -U alsaada_admin -d alsaada_db -c "SELECT role, count(*) FROM users GROUP BY role;"
  ```

- [ ] **Step 4: توثيق النتائج والـ Commit الأولي للدليل فقط.**
  ```powershell
  git add docs/periodic-audits/2026-09-13/pre-change-verification-log.md
  git commit -m "docs(audit): record plan 21 pre-change baseline and snapshot hash"
  ```

---

### المرحلة الثانية: جرد الأدوار والوظائف والمسارات والمطابقة المرجعية
### Phase 2: Inventory & Audit of Actual Roles, Features, Routes & Legacy Parity

#### Task 2: الجرد الميداني الشامل للأدوار والميزات الموروثة والمستحدثة
**المسؤولية:** وكيل QA والترحيل (Legacy Parity & QA Agent)  
**الملفات المستهدفة:**
- إنشاء: `docs/periodic-audits/2026-09-13/legacy-and-current-inventory-audit.md`
- قراءة وفحص:
  - `F:\HR\src\config\constants.ts`
  - `apps/admin-dashboard/src/lib/rbac.ts`
  - `apps/admin-dashboard/src/app/api/auth/`
  - `modules/workforce/`
  - `modules/settings/`
  - `docs/19-legacy-to-enterprise-master-feature-migration-registry.md`

- [ ] **Step 1: جرد كافة مواضع استخدام الأدوار في الكود الحالي ومقارنتها بـ F:\HR.**
  حصر جميع ملفات المشروع التي تذكر أدواراً ملغاة (`EXECUTIVE`, `ACCOUNTANT`, `PROJECT_MANAGER`, `SITE_ENGINEER`, `ADMIN` القديم):
  - رصد `apps/admin-dashboard/src/lib/rbac.ts` (11 دوراً حالياً بحاجة لتقليصها إلى 7 أدوار معتمدة).
  - رصد `apps/admin-dashboard/src/lib/data-fetchers.ts` (تحقق `canViewFinances` و `canViewFullNationalId`).
  - رصد `apps/bot-server/src/handlers/dashboard.handler.ts` و `dashboard-auth.service.ts` (`AUTHORIZED_DASHBOARD_ROLES`).
  - تدوين خطة الاستبدال والترحيل لكل ملف.

- [ ] **Step 2: جرد مسارات لوحة التحكم الحالية ومطابقتها مع وظائف البوت.**
  - فحص موديول القوى العاملة: دليل العاملين (`/admin/workforce/directory`)، التعيين (`/admin/workforce/new`)، المخالصات (`/admin/workforce/clearances`)، التصدير (`/admin/workforce/export`).
  - فحص موديول الإعدادات: المراكز الـ 10 الحالية ومقارنتها بالتدفقات 00.1 إلى 00.12 في البوت.
  - حصر الفجوات في موديولات المالية (السلف والعهد) والعمليات اللوجستية وتوثيقها بدقة.

- [ ] **Step 3: توثيق تقرير الجرد الكامل والالتزام بالحقائق 100%.**
  تدوين تقرير الجرد في `docs/periodic-audits/2026-09-13/legacy-and-current-inventory-audit.md` مع أرقام الأسطر والمسارات، وحفظه في Git:
  ```powershell
  git add docs/periodic-audits/2026-09-13/legacy-and-current-inventory-audit.md
  git commit -m "docs(audit): document exhaustive role, route, and functional parity inventory"
  ```

---

### المرحلة الثالثة: إنشاء حزمة عقود الصلاحيات والوظائف المركزية (@alsaada/rbac)
### Phase 3: Central Feature & RBAC Permissions Contract Package (`@alsaada/rbac`)

#### Task 3: بناء حزمة `@alsaada/rbac` المعزولة وعقود الصلاحيات الموحدة
**المسؤولية:** وكيل المعمارية وDevOps ووكيل المالية والأمان (Architecture & Security Agents)  
**الملفات المستهدفة:**
- إنشاء: `packages/rbac/package.json`
- إنشاء: `packages/rbac/tsconfig.json`
- إنشاء: `packages/rbac/src/types.ts`
- إنشاء: `packages/rbac/src/roles.ts`
- إنشاء: `packages/rbac/src/permissions.ts`
- إنشاء: `packages/rbac/src/evaluator.ts`
- إنشاء: `packages/rbac/src/catalog.ts`
- إنشاء: `packages/rbac/src/index.ts`
- إنشاء: `packages/rbac/tests/rbac.spec.ts`
- تعديل: `pnpm-workspace.yaml` (التحقق من شمول `packages/*`)

- [ ] **Step 1: تهيئة حزمة `@alsaada/rbac` المستقلة.**
  إنشاء هيكل الحزمة النظيفة بصفر تبعيات تشغيلية خارجية:
  ```json
  {
    "name": "@alsaada/rbac",
    "version": "2.0.0-alpha.1",
    "type": "module",
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "scripts": {
      "build": "tsc",
      "test": "vitest run",
      "typecheck": "tsc --noEmit"
    },
    "devDependencies": {
      "typescript": "^5.9.3",
      "vitest": "^3.0.8"
    }
  }
  ```

- [ ] **Step 2: كتابة اختبارات الصلاحيات الفاشلة أولاً (TDD).**
  إنشاء `packages/rbac/tests/rbac.spec.ts` للتحقق من:
  1. الأدوار السبعة المعتمدة فقط، ورفض أي دور غير معروف (`DENY_BY_DEFAULT`).
  2. قصر دخول الداشبورد على `SUPER_ADMIN` و`GENERAL_ADMIN` و`FIELD_ADMIN`.
  3. حجب المستحقات التعاقدية (`basicSalary`, `overtimeRate`, `allowances`, `totalCompensation`) حتماً عن `FIELD_ADMIN` وعن العمال لغير قسائمهم.
  4. فحص التفويض الوظيفي للعامل المشرف `WORKER_SUPERVISOR` في موقعه فقط، ورفض تفويض الوظائف السيادية.
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { evaluateAccess, canAccessDashboard, isFieldMasked, CanonicalRole } from '../src/index.js';

  describe('Central RBAC Engine Specification', () => {
    it('strictly permits only SUPER_ADMIN, GENERAL_ADMIN, and FIELD_ADMIN into dashboard', () => {
      expect(canAccessDashboard('SUPER_ADMIN')).toBe(true);
      expect(canAccessDashboard('GENERAL_ADMIN')).toBe(true);
      expect(canAccessDashboard('FIELD_ADMIN')).toBe(true);
      expect(canAccessDashboard('WORKER_SUPERVISOR')).toBe(false);
      expect(canAccessDashboard('WORKER')).toBe(false);
      expect(canAccessDashboard('SUPPLIER')).toBe(false);
      expect(canAccessDashboard('GUEST')).toBe(false);
      expect(canAccessDashboard('EXECUTIVE' as any)).toBe(false);
    });

    it('strictly masks contractual compensation fields for FIELD_ADMIN', () => {
      const sensitiveFields = ['basicSalary', 'overtimeRate', 'allowances', 'totalCompensation'];
      for (const field of sensitiveFields) {
        expect(isFieldMasked('FIELD_ADMIN', 'workforce.compensation.view', field)).toBe(true);
      }
      expect(isFieldMasked('SUPER_ADMIN', 'workforce.compensation.view', 'basicSalary')).toBe(false);
      expect(isFieldMasked('GENERAL_ADMIN', 'workforce.compensation.view', 'basicSalary')).toBe(false);
    });

    it('validates worker supervisor delegation boundaries', () => {
      const decision = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-KHA',
        delegations: [{ permissionKey: 'inventory.fuel.level.create', siteId: 'STE-KHA', isActive: true }]
      });
      expect(decision.granted).toBe(true);
      
      const deniedDifferentSite = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-ASW',
        delegations: [{ permissionKey: 'inventory.fuel.level.create', siteId: 'STE-KHA', isActive: true }]
      });
      expect(deniedDifferentSite.granted).toBe(false);
    });
  });
  ```

- [ ] **Step 3: بناء محرك الصلاحيات وعقد الوظيفة الموحد في `@alsaada/rbac`.**
  - تعريف الأنواع الثابتة: `CanonicalRole`, `PermissionAction`, `DataScope`, `SensitiveFieldPolicy`.
  - تطبيق دالة `evaluateAccess(context)` المعتمدة على مبدأ المنع الافتراضي (`DENY_BY_DEFAULT`).
  - بناء جدول عقود الوظائف (`FeatureContractRegistry`) الذي يربط كل `FlowCode` بمسارات البوت والداشبورد وحقول الرصد وقواعد التفويض.

- [ ] **Step 4: بناء الحزمة وتشغيل الاختبارات.**
  ```powershell
  pnpm --filter @alsaada/rbac test
  pnpm --filter @alsaada/rbac build
  ```
  *المتوقع:* نجاح كافة الاختبارات بنسبة 100% وخروج الأمر بـ `Exit 0`.

- [ ] **Step 5: الـ Commit للحزمة المركزية.**
  ```powershell
  git add packages/rbac
  git commit -m "feat(rbac): create sovereign rbac contract and evaluation package"
  ```

---

### المرحلة الرابعة: ترقية وتجهيز قاعدة البيانات (Prisma Migrations & Roles)
### Phase 4: Database Migration for 7 Roles, Worker Supervisor Delegations, Auth Link Claims, and Dashboard Sessions

#### Task 4: ترقية Schema وإضافة نماذج الجلسات والتفويضات وترحيل الأدوار
**المسؤولية:** وكيل المالية والأمان ووكيل المعمارية (Security & Architecture Agents)  
**الملفات المستهدفة:**
- تعديل: `packages/database/prisma/schema.prisma`
- إنشاء: `packages/database/prisma/migrations/20260913100000_unified_rbac_auth_links_and_sessions/migration.sql`
- إنشاء: `packages/database/tests/migration-rbac-and-sessions.spec.ts`
- تعديل: `packages/database/src/client.ts`

- [ ] **Step 1: كتابة اختبار Schema والتكامل الفاشل أولاً.**
  إنشاء اختبار للتحقق من:
  - وجود وإنشاء جلسة لوحة تحكم `DashboardSession` وحساب وقت الانتهاء.
  - التحقق الذري من استهلاك رابط الدخول `DashboardAuthLink` لمرة واحدة عبر `jtiHash`.
  - تسجيل تفويض العامل المشرف `WorkerDelegation` وربطه بالموقع والمستخدم.
  - ترحيل الأدوار القديمة واختبار الحذف الناعم (`Soft Delete`).
  ```typescript
  import { describe, it, expect, beforeAll } from 'vitest';
  import { prisma } from '../src/index.js';

  describe('Database RBAC, Sessions & Delegation Schema', () => {
    it('creates a dashboard auth link and prevents duplicate claim via jtiHash', async () => {
      const jtiHash = 'sample-sha256-hash-auth-link-1';
      await prisma.dashboardAuthLink.create({
        data: {
          jtiHash,
          actorTelegramId: 12345678n,
          targetOrigin: 'LOCAL',
          expiresAt: new Date(Date.now() + 300_000),
        }
      });
      await expect(prisma.dashboardAuthLink.create({
        data: {
          jtiHash,
          actorTelegramId: 12345678n,
          targetOrigin: 'LOCAL',
          expiresAt: new Date(Date.now() + 300_000),
        }
      })).rejects.toThrow();
    });

    it('persists a durable 8-hour dashboard session and allows atomic revocation', async () => {
      const sessionHash = 'sample-sha256-session-hash-1';
      const session = await prisma.dashboardSession.create({
        data: {
          sessionHash,
          userId: 'test-user-uuid',
          actorTelegramId: 12345678n,
          originKind: 'TUNNEL',
          deviceSummary: 'Mozilla/5.0 Windows NT 10.0',
          expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
        }
      });
      expect(session.id).toBeDefined();
      expect(session.revokedAt).toBeNull();

      const revoked = await prisma.dashboardSession.update({
        where: { sessionHash },
        data: { revokedAt: new Date(), revocationReason: 'USER_LOGOUT' }
      });
      expect(revoked.revokedAt).not.toBeNull();
    });
  });
  ```

- [ ] **Step 2: تحديث `packages/database/prisma/schema.prisma`.**
  إضافة النماذج التالية بعد مراجعة الأمان:
  ```prisma
  // -------------------------------------------------------------
  // 14. Dashboard Authentication, Sessions & RBAC Delegations
  // -------------------------------------------------------------

  model DashboardAuthLink {
    id              String    @id @default(uuid())
    jtiHash         String    @unique @db.VarChar(64)
    actorTelegramId BigInt
    targetOrigin    String    @default("LOCAL") // LOCAL, TUNNEL
    expiresAt       DateTime
    claimedAt       DateTime?
    claimTraceId    String?   @db.VarChar(36)
    createdAt       DateTime  @default(now())

    @@index([expiresAt])
    @@index([actorTelegramId])
    @@map("dashboard_auth_links")
  }

  model DashboardSession {
    id                 String    @id @default(uuid())
    sessionHash        String    @unique @db.VarChar(64)
    userId             String
    actorTelegramId    BigInt
    originKind         String    @default("LOCAL") // LOCAL, TUNNEL
    deviceSummary      String?   @db.VarChar(255)
    userAgentHash      String?   @db.VarChar(64)
    lastSeenAt         DateTime  @default(now())
    expiresAt          DateTime
    noticeSentAt       DateTime?
    revokedAt          DateTime?
    revocationReason   String?   @db.VarChar(100)
    permissionsVersion Int       @default(1)
    createdAt          DateTime  @default(now())
    updatedAt          DateTime  @updatedAt

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, revokedAt])
    @@index([actorTelegramId])
    @@index([expiresAt])
    @@map("dashboard_sessions")
  }

  model WorkerDelegation {
    id                   String    @id @default(uuid())
    userId               String
    workerId             String
    permissionKey        String    @db.VarChar(100)
    siteId               String
    resourceId           String?
    startsAt             DateTime  @default(now())
    endsAt               DateTime?
    status               String    @default("ACTIVE") // ACTIVE, REVOKED, EXPIRED
    requestedByTelegramId BigInt
    approvedByTelegramId  BigInt
    revokedByTelegramId   BigInt?
    reason               String?   @db.VarChar(255)
    createdAt            DateTime  @default(now())
    updatedAt            DateTime  @updatedAt

    user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
    worker Worker @relation(fields: [workerId], references: [id], onDelete: Cascade)
    site   Site   @relation(fields: [siteId], references: [id], onDelete: Restrict)

    @@index([userId, status])
    @@index([workerId, status])
    @@index([siteId, status])
    @@index([permissionKey])
    @@map("worker_delegations")
  }
  ```
  وتحديث النماذج المرتبطة في `schema.prisma` بإضافة العلاقات العكسية الإلزامية لتجنب أخطاء تجميع Prisma:
  ```prisma
  // في نموذج User:
  dashboardSessions  DashboardSession[]
  workerDelegations  WorkerDelegation[]

  // في نموذج Worker:
  delegations        WorkerDelegation[]

  // في نموذج Site:
  workerDelegations  WorkerDelegation[]
  ```

- [ ] **Step 3: إنشاء مهاجرة SQL وتطبيق ترحيل الأدوار البياناتي مع الحفظ الجنائي.**
  إنشاء ملف المهاجرة `packages/database/prisma/migrations/20260913100000_unified_rbac_auth_links_and_sessions/migration.sql` متضمناً أوامر DDL وتعديل البيانات:
  ```sql
  -- CreateTable dashboard_auth_links
  CREATE TABLE "dashboard_auth_links" (
      "id" TEXT NOT NULL,
      "jtiHash" VARCHAR(64) NOT NULL,
      "actorTelegramId" BIGINT NOT NULL,
      "targetOrigin" TEXT NOT NULL DEFAULT 'LOCAL',
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "claimedAt" TIMESTAMP(3),
      "claimTraceId" VARCHAR(36),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "dashboard_auth_links_pkey" PRIMARY KEY ("id")
  );
  CREATE UNIQUE INDEX "dashboard_auth_links_jtiHash_key" ON "dashboard_auth_links"("jtiHash");
  CREATE INDEX "dashboard_auth_links_expiresAt_idx" ON "dashboard_auth_links"("expiresAt");
  CREATE INDEX "dashboard_auth_links_actorTelegramId_idx" ON "dashboard_auth_links"("actorTelegramId");

  -- CreateTable dashboard_sessions
  CREATE TABLE "dashboard_sessions" (
      "id" TEXT NOT NULL,
      "sessionHash" VARCHAR(64) NOT NULL,
      "userId" TEXT NOT NULL,
      "actorTelegramId" BIGINT NOT NULL,
      "originKind" TEXT NOT NULL DEFAULT 'LOCAL',
      "deviceSummary" VARCHAR(255),
      "userAgentHash" VARCHAR(64),
      "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "noticeSentAt" TIMESTAMP(3),
      "revokedAt" TIMESTAMP(3),
      "revocationReason" VARCHAR(100),
      "permissionsVersion" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "dashboard_sessions_pkey" PRIMARY KEY ("id")
  );
  CREATE UNIQUE INDEX "dashboard_sessions_sessionHash_key" ON "dashboard_sessions"("sessionHash");
  CREATE INDEX "dashboard_sessions_userId_revokedAt_idx" ON "dashboard_sessions"("userId", "revokedAt");
  CREATE INDEX "dashboard_sessions_actorTelegramId_idx" ON "dashboard_sessions"("actorTelegramId");
  CREATE INDEX "dashboard_sessions_expiresAt_idx" ON "dashboard_sessions"("expiresAt");

  -- CreateTable worker_delegations
  CREATE TABLE "worker_delegations" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "workerId" TEXT NOT NULL,
      "permissionKey" VARCHAR(100) NOT NULL,
      "siteId" TEXT NOT NULL,
      "resourceId" TEXT,
      "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "endsAt" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "requestedByTelegramId" BIGINT NOT NULL,
      "approvedByTelegramId" BIGINT NOT NULL,
      "revokedByTelegramId" BIGINT,
      "reason" VARCHAR(255),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "worker_delegations_pkey" PRIMARY KEY ("id")
  );
  CREATE INDEX "worker_delegations_userId_status_idx" ON "worker_delegations"("userId", "status");
  CREATE INDEX "worker_delegations_workerId_status_idx" ON "worker_delegations"("workerId", "status");
  CREATE INDEX "worker_delegations_siteId_status_idx" ON "worker_delegations"("siteId", "status");
  CREATE INDEX "worker_delegations_permissionKey_idx" ON "worker_delegations"("permissionKey");

  -- Foreign Keys
  ALTER TABLE "dashboard_sessions" ADD CONSTRAINT "dashboard_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "worker_delegations" ADD CONSTRAINT "worker_delegations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "worker_delegations" ADD CONSTRAINT "worker_delegations_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "worker_delegations" ADD CONSTRAINT "worker_delegations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

  -- Data Migration & Forensic Preservation Rules:
  -- 1. Migrate legacy ADMIN to FIELD_ADMIN
  UPDATE "users" SET "role" = 'FIELD_ADMIN' WHERE "role" = 'ADMIN';

  -- 2. Preserve forensic audit record for all deprecated roles BEFORE deactivating/remapping
  INSERT INTO "audit_logs" ("id", "traceId", "actorTelegramId", "action", "entityType", "entityId", "beforePayload", "afterPayload", "timestamp")
  SELECT 
    gen_random_uuid()::text,
    'migration-plan-21-legacy-roles',
    "telegramId",
    'ROLE_DEPRECATION_MIGRATION',
    'User',
    "id",
    json_build_object('legacyRole', "role", 'isActive', "isActive"),
    json_build_object('newRole', 'GUEST', 'isActive', false, 'status', 'AWAITING_SUPER_ADMIN_REASSIGNMENT'),
    CURRENT_TIMESTAMP
  FROM "users"
  WHERE "role" IN ('EXECUTIVE', 'EXECUTIVE_DIRECTOR', 'ACCOUNTANT', 'PROJECT_MANAGER', 'SITE_ENGINEER')
     OR "role" NOT IN ('SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR', 'WORKER', 'SUPPLIER', 'GUEST');

  -- 3. Deactivate obsolete and unknown roles and map to GUEST for review
  UPDATE "users" 
  SET "role" = 'GUEST', "isActive" = false 
  WHERE "role" IN ('EXECUTIVE', 'EXECUTIVE_DIRECTOR', 'ACCOUNTANT', 'PROJECT_MANAGER', 'SITE_ENGINEER')
     OR "role" NOT IN ('SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR', 'WORKER', 'SUPPLIER', 'GUEST');
  ```

- [ ] **Step 4: تطبيق المهاجرة وتوليد عميل Prisma واختبارها.**
  ```powershell
  pnpm --filter @alsaada/database exec prisma migrate deploy --schema prisma/schema.prisma
  pnpm --filter @alsaada/database exec prisma generate --schema prisma/schema.prisma
  pnpm --filter @alsaada/database test -- migration-rbac-and-sessions.spec.ts
  ```
  *المتوقع:* اجتياز الاختبار بنجاح وتحديث جداول قاعدة البيانات.

- [ ] **Step 5: خطة الطوارئ والرجوع (Rollback Procedure).**
  في حال حدوث أي فشل في تطبيق المهاجرة، يتم تشغيل أمر الاستعادة الفورية من النسخة المحفوظة في Task 1:
  ```powershell
  docker compose exec -T postgres dropdb -U alsaada_admin alsaada_db
  docker compose exec -T postgres createdb -U alsaada_admin alsaada_db
  Get-Content .scratch/plan21-prechange.dump | docker compose exec -T postgres pg_restore -U alsaada_admin -d alsaada_db
  ```

- [ ] **Step 6: Commit الترقية القاعدية.**
  ```powershell
  git add packages/database/prisma packages/database/tests
  git commit -m "fix(database): add auth links, sessions, delegations, and 7-role migration with forensic audit log"
  ```

---

### المرحلة الخامسة: بناء المصادقة الحصرية من البوت وإدارة الجلسات الخادمية
### Phase 5: New Bot-Only Auth Issuance, Dual-Token Claim & Server-Side 8-Hour Sessions

#### Task 5: بناء موزع الروابط المتزامنة في البوت ونقطة الاستهلاك الذرية في الداشبورد
**المسؤولية:** وكيل التنفيذ وتجربة الاستخدام ووكيل المالية والأمان (Implementation & Security Agents)  
**الملفات المستهدفة:**
- تعديل: `apps/bot-server/src/config/env.ts`
- تعديل: `apps/bot-server/src/services/dashboard-auth.service.ts`
- تعديل: `apps/bot-server/src/handlers/dashboard.handler.ts`
- تعديل: `apps/bot-server/src/handlers/start.handler.ts`
- إنشاء: `apps/admin-dashboard/src/app/api/auth/claim/route.ts`
- تعديل: `apps/admin-dashboard/src/lib/env.ts`
- إنشاء: `apps/admin-dashboard/tests/auth-claim.spec.ts`
- إنشاء: `apps/admin-dashboard/tests/auth-claim-concurrency.spec.ts`
- تعديل: `apps/bot-server/tests/dashboard-command.spec.ts`

- [ ] **Step 1: كتابة اختبارات إصدار الرابطين المتزامنين واستهلاك التوكن الفاشلة أولاً.**
  التحقق من:
  1. توليد رابط محلي ورابط نفق متزامنين برمزين عشوائيين مستقلين لكل مستخدم مصرح له.
  2. صلاحية التوكن 5 دقائق واستخدامه مرة واحدة فقط ذرياً (`single-use atomic claim`).
  3. حظر هجمات السباق المتزامن (Concurrency Race Attack): عند وصول طلبين متزامنين بنفس التوكن، ينجح أحدهما فقط ويفشل الآخر بـ 409 Conflict أو 401 Unauthorized، مع صفر ازدواجية في الجلسات.
  4. حظر التلاعب بالـ Host Header: التحقق من بناء الـ Redirect حصراً من الإعداد الموثوق الثابت (`DASHBOARD_LOCAL_URL` أو `DASHBOARD_TUNNEL_URL`) دون أدنى اعتماد على Headers غير موثوقة.
  5. إنشاء جلسة 8 ساعات مسجلة في `dashboard_sessions`.
  6. رفض أي محاولة من دور غير مصرح له أو مستخدم معطل.
  7. تعيين كوكيز `alsaada_session` بخصائص `HttpOnly` و`SameSite=Lax` و`Secure` للنفق.
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { dashboardAuthService } from '../src/services/dashboard-auth.service.js';

  describe('Bot Dashboard Access Dispatcher', () => {
    it('generates two distinct cryptographically secure tokens for local and tunnel access', async () => {
      const result = await dashboardAuthService.issueDualDashboardAccess({
        telegramId: 999999n,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.localUrl).toContain('http://localhost:3002/api/auth/claim?token=');
        expect(result.tunnelUrl).toContain('/api/auth/claim?token=');
        expect(result.localToken).not.toBe(result.tunnelToken);
        expect(result.expiresInMinutes).toBe(5);
      }
    });

    it('strictly denies dashboard link issuance to WORKER or GUEST roles', async () => {
      const result = await dashboardAuthService.issueDualDashboardAccess({
        telegramId: 111111n, // Worker ID
      });
      expect(result.success).toBe(false);
      expect((result as any).reason).toBe('UNAUTHORIZED_ROLE');
    });
  });
  ```

- [ ] **Step 2: تحديث قراءة متغيرات البيئة في خادم البوت ولوحة التحكم.**
  إضافة المتغيرات المعيارية المعتمدة في `apps/bot-server/src/config/env.ts` و `apps/admin-dashboard/src/lib/env.ts`:
  ```typescript
  DASHBOARD_LOCAL_URL: process.env.DASHBOARD_LOCAL_URL || 'http://localhost:3002',
  DASHBOARD_TUNNEL_URL: process.env.DASHBOARD_TUNNEL_URL || 'https://tunnel.alsaada.example',
  TELEGRAM_BOT_USERNAME: (process.env.TELEGRAM_BOT_USERNAME || 'Al_Saada_smart_bot').replace(/^@/, '').trim(),
  DASHBOARD_AUTH_LINK_SECRET: process.env.DASHBOARD_AUTH_LINK_SECRET || process.env.DATABASE_ENCRYPTION_KEY || 'sovereign-dashboard-secret-32-chars',
  DASHBOARD_AUTH_LINK_TTL_MINUTES: parseInt(process.env.DASHBOARD_AUTH_LINK_TTL_MINUTES || '5', 10),
  DASHBOARD_SESSION_TTL_HOURS: parseInt(process.env.DASHBOARD_SESSION_TTL_HOURS || '8', 10),
  DASHBOARD_SESSION_NOTICE_MINUTES: parseInt(process.env.DASHBOARD_SESSION_NOTICE_MINUTES || '60', 10),
  DASHBOARD_SESSION_EXTENSION_HOURS: parseInt(process.env.DASHBOARD_SESSION_EXTENSION_HOURS || '8', 10),
  ```

- [ ] **Step 3: تطوير خدمة إصدار الروابط المزدوجة `dashboardAuthService`.**
  - توليد رمز عشوائي 32 بايت مشفر بـ HMAC-SHA256 لكل رابط.
  - تخزين `sha256(token)` في جدول `DashboardAuthLink` لكل من `LOCAL` و`TUNNEL`.
  - التحقق الصارم من صلاحية الحساب (`isActive = true`, `isBanned = false`, `role in ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN']`).
  - تسجيل محاولات الرفض والإصدار في `audit_logs` برقم `traceId`.

- [ ] **Step 4: تحديث معالج البوت `dashboard.handler.ts` و `start.handler.ts`.**
  - تحديث `dashboard.handler.ts`: استبدال الرابط الفردي ببطاقة أزرار تحتوي الرابطين المتزامنين:
    1. `[ 💻 فتح لوحة التحكم محلياً (Localhost) ]`
    2. `[ 🌐 فتح لوحة التحكم عبر النفق (Tunnel) ]`
  - تحديث `start.handler.ts`: إضافة فحص `if (startPayload === 'dashboard_access')` لتحويل المستخدم القادم من رابط المتصفح العميق إلى `handleDashboardCommand(ctx)` فوراً، لفتح بطاقة الدخول دون تشتت.

- [ ] **Step 5: بناء نقطة النهاية الذرية للاستهلاك في الداشبورد (`/api/auth/claim`).**
  إنشاء `apps/admin-dashboard/src/app/api/auth/claim/route.ts`:
  - استخراج التوكن وحساب الهاش `sha256(rawToken)`.
  - تنفيذ عملية استهلاك ذرية في Transaction:
    ```typescript
    const link = await prisma.$transaction(async (tx) => {
      const candidate = await tx.dashboardAuthLink.findUnique({
        where: { jtiHash },
      });
      if (!candidate || candidate.claimedAt || candidate.expiresAt < new Date()) {
        throw new Error('TOKEN_INVALID_OR_EXPIRED');
      }
      return tx.dashboardAuthLink.update({
        where: { id: candidate.id },
        data: { claimedAt: new Date(), claimTraceId: traceId },
      });
    });
    ```
  - إعادة فحص حالة المستخدم وصلاحية دوره من جدول `users`.
  - توليد معرف جلسة خادمي آمن، وحفظ `sha256(sessionId)` في `dashboard_sessions` لمدة 8 ساعات.
  - تعيين الكوكيز `alsaada_session` وإعادة التوجيه (302) مباشرة إلى `/admin` (باستخدام الأصل الموثوق في الإعدادات لمنع Open Redirect).

- [ ] **Step 6: تشغيل اختبارات المصادقة.**
  ```powershell
  pnpm --filter @alsaada/bot-server test -- dashboard-command.spec.ts
  pnpm --filter @alsaada/admin-dashboard test -- auth-claim.spec.ts
  pnpm --filter @alsaada/admin-dashboard test -- auth-claim-concurrency.spec.ts
  ```
  *المتوقع:* نجاح كافة الاختبارات.

- [ ] **Step 7: الـ Commit لمرحلة المصادقة.**
  ```powershell
  git add apps/bot-server/src apps/admin-dashboard/src apps/bot-server/tests apps/admin-dashboard/tests
  git commit -m "feat(auth): implement dual-link issuance, atomic claim, start deep-link, and 8-hour db session"
  ```

---

#### Task 6: حماية المسارات في Middleware وإدارة وتمديد الجلسات عبر تيليجرام
**المسؤولية:** وكيل المعمارية ووكيل التنفيذ وتجربة الاستخدام (Architecture & UX Agents)  
**الملفات المستهدفة:**
- تعديل: `apps/admin-dashboard/src/middleware.ts`
- إنشاء: `apps/bot-server/src/services/session-monitor.service.ts`
- تعديل: `apps/bot-server/src/handlers/dashboard.handler.ts`
- تعديل: `apps/admin-dashboard/src/app/api/auth/logout/route.ts`
- إنشاء: `apps/admin-dashboard/tests/middleware-session-guard.spec.ts`

- [ ] **Step 1: كتابة اختبار حماية المسارات والفحص الخادمي للجلسة.**
  التحقق من:
  1. السماح للمستخدم المصرح له بالدخول إذا كانت جلسته نشطة في قاعدة البيانات.
  2. طرد المستخدم فوراً وإلغاء الجلسة إذا تم تغيير دوره أو موقعه أو تعطيل حسابه أثناء الجلسة (`Mid-session role change`).
  3. إعادة أي طلب غير مصادق عليه إلى رابط البوت العميق `https://t.me/<BOT_USERNAME>?start=dashboard_access` بدلاً من صفحة `/login`.
  4. التحقق من خلو الاستجابة من كشف تفاصيل الأخطاء أو استثناءات قاعدة البيانات.

- [ ] **Step 2: تحديث `apps/admin-dashboard/src/middleware.ts`.**
  - فحص وجود كوكيز `alsaada_session`.
  - التحقق التشفيري السريع واستعلام الجلسة الفعالة من جدول `dashboard_sessions`:
    - التأكد أن `revokedAt IS NULL`.
    - التأكد أن `expiresAt > NOW()`.
    - التأكد أن دور المستخدم لا يزال ضمن الأدوار الثلاثة المعتمدة.
  - إذا فشل التحقق: توجيه المتصفح فوراً لرابط البوت العميق `https://t.me/<BOT_USERNAME>?start=dashboard_access` وتدوين الحدث الأمني.

- [ ] **Step 3: بناء خدمة مراقبة انتهاء الجلسات `session-monitor.service.ts` في خادم البوت.**
  - جدولة فحص دوري للجلسات المتبقي عليها أقل من 60 دقيقة ولم يُرسل لها إشعار بعد (`noticeSentAt IS NULL`).
  - إرسال رسالة تيليجرام تنبيهية للمستخدم مرة واحدة فقط تحتوي:
    - تفاصيل الجلسة (المصدر: محلي/نفق، الجهاز والمتصفح، آخر نشاط).
    - زر تمديد 8 ساعات: `[ ⏳ تمديد الجلسة 8 ساعات إضافية ]` (`sess_ext:<sessionUuid>`).
    - زر إنهاء الجلسة فوراً: `[ 🛑 تسجيل الخروج وإنهاء الجلسة ]` (`sess_rev:<sessionUuid>`).
    - زر إدارة الجلسات: `[ 📋 جلساتي النشطة ]` (`sess_list`).
  - **الالتزام الحاسم بسقف تيليجرام:** استخدام `session.id` (UUID: 36 حرفاً) لضمان أن طول `callback_data` لا يتجاوز سقف 64 بايت الإلزامي (`sess_ext:<uuid>` = 9 + 36 = 45 بايت <= 64 بايت)، لتجنب خطأ `BUTTON_DATA_INVALID`.
  - وضع علامة `noticeSentAt = NOW()` لمنع تكرار الإشعار.

- [ ] **Step 4: معالجة التمديد والإبطال الفوري في معالج البوت.**
  - عند الضغط على زر التمديد (`sess_ext:<uuid>`): التأكد الحصري من أن ضاغط الزر هو صاحب معرف التيليجرام الأصلي، وإعادة فحص الحساب في قاعدة البيانات، وتحديث `expiresAt` بإضافة 8 ساعات وتصفير `noticeSentAt = null`، وتدوين الحدث في `audit_logs`، وتحديث رسالة البوت لتأكيد التمديد وإبطال الأزرار القديمة.
  - توفير لوحة كاملة لإدارة الجلسات للمستخدم لعرض كافة جلساته النشطة وإنهائها فردياً أو جماعياً.
  - تمكين السوبر أدمن من إنهاء جلسات أي مستخدم آخر من داخل البوت.

- [ ] **Step 5: تحديث نقطة تسجيل الخروج `/api/auth/logout`.**
  - استخراج كوكيز الجلسة ووسمها بـ `revokedAt = NOW()` و `revocationReason = 'USER_LOGOUT'`.
  - حذف كوكيز `alsaada_session`.
  - إعادة التوجيه لرابط البوت العميق `https://t.me/<BOT_USERNAME>?start=dashboard_access`.

- [ ] **Step 6: تشغيل اختبارات إدارة الجلسات.**
  ```powershell
  pnpm --filter @alsaada/admin-dashboard test -- middleware-session-guard.spec.ts
  pnpm --filter @alsaada/bot-server test -- dashboard-command.spec.ts
  ```

- [ ] **Step 7: Commit إدارة الجلسات.**
  ```powershell
  git add apps/admin-dashboard/src/middleware.ts apps/bot-server/src apps/admin-dashboard/src/app/api/auth/logout apps/admin-dashboard/tests
  git commit -m "feat(auth): secure middleware session guard and telegram 8-hour extension workflow with compliant callback payloads"
  ```

---

### المرحلة السادسة: الإزالة الكاملة لمنظومة الدخول القديمة
### Phase 6: Complete Removal of Legacy Login Mechanisms

#### Task 7: الاستئصال الشامل لصفحة الدخول القديمة وبوابات TWA و OTP و Magic Link القديم
**المسؤولية:** وكيل المعمارية ووكيل التنفيذ (Architecture & Implementation Agents)  
**الملفات المستهدفة:**
- حذف كامل: `apps/admin-dashboard/src/app/login/`
- حذف كامل: `apps/admin-dashboard/src/app/api/auth/telegram/`
- حذف كامل: `apps/admin-dashboard/src/app/api/auth/twa/`
- حذف كامل: `apps/admin-dashboard/src/app/api/auth/otp/`
- حذف كامل: `apps/admin-dashboard/src/app/api/auth/magic/`
- تعديل: `apps/admin-dashboard/next.config.ts` (إضافة Redirect دائم لمسار `/login` القديم نحو رابط البوت)
- حذف/تعديل الاختبارات المرتبطة بالطرق القديمة:
  - `apps/admin-dashboard/tests/adversarial-auth.spec.ts`
  - `apps/admin-dashboard/tests/telegram-auth.spec.ts`
  - `apps/admin-dashboard/tests/magic-auth.spec.ts`
- إنشاء: `apps/admin-dashboard/tests/legacy-auth-elimination.spec.ts`

- [ ] **Step 1: إجراء فحص مرجعي شامل (Reference Audit) قبل الحذف.**
  التأكد من عدم وجود أي استيراد نشط لصفحة `/login` أو نقاط نهاية `twa` أو `telegram` في شاشات لوحة التحكم:
  ```powershell
  git grep -n "api/auth/telegram" apps/admin-dashboard/src
  git grep -n "api/auth/twa" apps/admin-dashboard/src
  git grep -n "api/auth/otp" apps/admin-dashboard/src
  git grep -n "api/auth/magic" apps/admin-dashboard/src
  ```
  *المتوقع:* عدم وجود أي استدعاء داخل كود لوحة التحكم الإدارية الفعالة.

- [ ] **Step 2: حذف ملفات ومجلدات المصادقة القديمة فيزيائياً.**
  حذف المجلدات التالية بالكامل:
  ```powershell
  Remove-Item -Recurse -Force apps/admin-dashboard/src/app/login
  Remove-Item -Recurse -Force apps/admin-dashboard/src/app/api/auth/telegram
  Remove-Item -Recurse -Force apps/admin-dashboard/src/app/api/auth/twa
  Remove-Item -Recurse -Force apps/admin-dashboard/src/app/api/auth/otp
  Remove-Item -Recurse -Force apps/admin-dashboard/src/app/api/auth/magic
  ```

- [ ] **Step 3: توجيه أي طلب قديم لـ `/login` إلى رابط البوت العميق.**
  إضافة معالج توجيه في `apps/admin-dashboard/next.config.ts` أو مسار بديل لإعادة أي طلب لـ `/login` فورياً إلى:
  `https://t.me/<BOT_USERNAME>?start=dashboard_access` (302 Redirect).

- [ ] **Step 4: كتابة اختبار إثبات استئصال الدخول القديم.**
  إنشاء `apps/admin-dashboard/tests/legacy-auth-elimination.spec.ts`:
  - إثبات أن طلب `/login` يعيد التحويل لرابط البوت (أو 404).
  - إثبات أن طلبات `/api/auth/telegram` و `/api/auth/twa` و `/api/auth/otp` غير موجودة (404 Not Found).
  - إثبات استحالة تسجيل الدخول بكلمة مرور أو محاكاة أو bypass.
  ```powershell
  pnpm --filter @alsaada/admin-dashboard test -- legacy-auth-elimination.spec.ts
  ```

- [ ] **Step 5: تنظيف ملفات الاختبارات القديمة وتحديث الاختبارات المتأثرة.**
  حذف أو ترقية ملفات الاختبارات التي كانت تختبر المنظومة الملغاة لتعمل مع المنظومة الحصرية الجديدة.

- [ ] **Step 6: الـ Commit لمرحلة التطهير.**
  ```powershell
  git add apps/admin-dashboard
  git commit -m "refactor(auth): completely remove legacy login page, twa, otp, and telegram auth routes"
  ```

---

### المرحلة السابعة: تأسيس معمارية لوحة التحكم وصفحة الملخص حسب الدور
### Phase 7: Dashboard Foundation Architecture, Role-Based Overview & Analytics Registry

#### Task 8: بناء شاشات الملخص المخصصة للأدوار الثلاثة ومركز الإحصائيات الموحد
**المسؤولية:** وكيل التنفيذ وتجربة الاستخدام ووكيل المعمارية (Implementation & Architecture Agents)  
**الملفات المستهدفة:**
- تعديل: `apps/admin-dashboard/src/lib/rbac.ts`
- تعديل: `apps/admin-dashboard/src/components/layout/sidebar.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/page.tsx`
- إنشاء: `apps/admin-dashboard/src/components/dashboard/super-admin-overview.tsx`
- إنشاء: `apps/admin-dashboard/src/components/dashboard/general-admin-overview.tsx`
- إنشاء: `apps/admin-dashboard/src/components/dashboard/field-admin-overview.tsx`
- إنشاء: `apps/admin-dashboard/src/lib/analytics-registry.ts`
- إنشاء: `apps/admin-dashboard/src/app/admin/analytics/page.tsx`
- تعديل: `apps/bot-server/src/services/command-scope.service.ts`
- إنشاء: `apps/admin-dashboard/tests/role-overview.spec.ts`

- [ ] **Step 1: كتابة اختبار الملخص حسب الدور والقائمة الجانبية الفاشل أولاً.**
  التحقق من:
  1. عرض ملخص السوبر أدمن بالكامل شاملاً المستحقات، الاعتمادات، وحالة النظام.
  2. عرض الملخص التشغيلي للجينرال أدمن دون الأدوات السيادية.
  3. حصر ملخص مشرف الموقع `FIELD_ADMIN` على موقعه المسجل فقط، وحظر أي حقل أو بطاقة تخص الرواتب أو البدلات أو التكاليف التعاقدية.
  4. فلترة القائمة الجانبية مسبقاً (`Pre-render RBAC Masking`) وفق صلاحيات المستخدم المستمدة من `@alsaada/rbac`.

- [ ] **Step 2: ترقية `apps/admin-dashboard/src/lib/rbac.ts` و `command-scope.service.ts`.**
  - استبدال تعريف `UserRole` القديم بالأنواع المستوردة من `@alsaada/rbac`.
  - تنقيح `DASHBOARD_NAV_ITEMS` لتعتمد حصرياً على الأدوار الثلاثة المعتمدة.
  - إخفاء الأقسام غير المصرح بها من القائمة الجانبية وقائمة الأوامر (`Command Palette`).
  - تحديث `apps/bot-server/src/services/command-scope.service.ts` لحذف أوامر الأدوار الملغاة (`ACCOUNTANT`, `PROJECT_MANAGER`, `SITE_ENGINEER`) وإضافة مصفوفة أوامر `WORKER_SUPERVISOR_COMMANDS`.

- [ ] **Step 3: تقسيم وتطوير صفحة الملخص `/admin/page.tsx` حسب الدور.**
  - إنشاء مكون `SuperAdminOverview`: يغطي كافة المواقع، مؤشرات الحوادث الجنائية، ملخص الرواتب، واختصارات الإعدادات السيادية.
  - إنشاء مكون `GeneralAdminOverview`: يغطي الرقابة التشغيلية، السلف، العهد، الموردين، والطلبات المعلقة.
  - إنشاء مكون `FieldAdminOverview`: يغطي عمليات الموقع المسجل فقط، السلف والمسحوبات، العهد، والمخازن، مع حجب تام للمستحقات التعاقدية.

- [ ] **Step 4: بناء مركز الإحصائيات والتحليلات المركزي (`/admin/analytics`).**
  - إنشاء `apps/admin-dashboard/src/lib/analytics-registry.ts` لاكتشاف تعريفات التحليلات آلياً من عقود `@alsaada/rbac`.
  - بناء صفحة `apps/admin-dashboard/src/app/admin/analytics/page.tsx`:
    - قائمة منسدلة لاختيار الموديول.
    - قائمة منسدلة لاختيار الوظيفة التابعة.
    - محدد الفترة الزمنية (اليوم، الأسبوع، الشهر، فترة مخصصة).
    - محدد الموقع (متاح للسوبر والجينرال، وموقع ثابت للقراءة فقط لمشرف الموقع).
    - بطاقات KPIs ورسوم بيانية وجدول تفاصيل قابل للبحث والتصفية.
    - حفظ حالة الاختيارات في `Query Parameters`.
    - حالة فارغة حقيقية وأنيقة عند غياب البيانات دون أي تزييف أو موك.

- [ ] **Step 5: تشغيل الاختبارات.**
  ```powershell
  pnpm --filter @alsaada/admin-dashboard test -- role-overview.spec.ts
  ```

- [ ] **Step 6: Commit مرحلة تأسيس لوحة التحكم والتحليلات.**
  ```powershell
  git add apps/admin-dashboard/src apps/bot-server/src
  git commit -m "feat(dashboard): implement role-based overview, rbac sidebar, and centralized analytics center"
  ```

---

### المرحلة الثامنة: التطابق الوظيفي المنهجي لموديولات المنظومة الحالية
### Phase 8: Systematic Functional Parity for Current Bot Modules

#### Task 9: تحقيق التطابق الكامل لموديول القوى العاملة (Workforce Module)
**المسؤولية:** وكيل التنفيذ وتجربة الاستخدام ووكيل QA والترحيل (Implementation & QA Agents)  
**الملفات المستهدفة:**
- تعديل: `apps/admin-dashboard/src/app/admin/workforce/directory/page.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/workforce/new/page.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/workforce/clearances/page.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/workforce/export/page.tsx`
- إنشاء: `apps/admin-dashboard/src/app/admin/workforce/[id]/edit/page.tsx`
- تعديل: `apps/admin-dashboard/src/lib/data-fetchers.ts`
- تعديل: `modules/workforce/src/flows/01.5-worker-directory/`
- تعديل: `modules/workforce/src/flows/01.8-worker-offboarding/`
- إنشاء: `apps/admin-dashboard/tests/parity/workforce-parity.spec.ts`

- [ ] **Step 1: كتابة اختبارات التطابق الوظيفي للقوى العاملة.**
  التحقق من:
  1. تطابق شاشات وحقول تسجيل وتعيين العامل الجديد (`01.1`) بين البوت والداشبورد.
  2. تطابق تعديل العامل (`01.2.D`) بالتبويبات الأربعة وحصر تعديل الراتب بالسوبر أدمن.
  3. إبراز اسم الشهرة (`Nickname`) كعنوان رئيسي للعامل في كافة القوائم.
  4. إظهار الرقم القومي كاملاً للسوبر أدمن والجينرال أدمن، وحجبه لمشرف الموقع عبر `maskEgyptianNationalId`.
  5. تطابق دورة المخالصة وإنهاء الخدمة (`01.8`) وتصفية العهد والمديونيات.

- [ ] **Step 2: مطابقة شاشة دليل وبطاقة العامل 360° (`/admin/workforce/directory`).**
  - اعتماد خدمة البيانات المشتركة من `packages/database` واستخدام دالة الإسقاط `projectSafeWorkerFields`.
  - تطبيق الحجب الخادمي للرواتب عند استعلام مشرف الموقع (`assignedSiteId`).
  - توفير أزرار الإجراءات الميدانية (واتساب بنسخ نقرة واحدة، مخالصة، تعديل).

- [ ] **Step 3: بناء شاشة تعديل العامل بـ 4 تبويبات في الداشبورد (`01.2.D`).**
  - البيانات الأساسية، بيانات الوظيفة والموقع، البدلات ومخصص السجائر، التأمينات.
  - قفل تعديل الراتب الأساسي والإضافي لغير السوبر أدمن.

- [ ] **Step 4: مطابقة دورة إنهاء الخدمة والمخالصات (`/admin/workforce/clearances`).**
  - فحص العهد المفتوحة، رادار الرصيد السالب وقائمة الحظر (`Blacklist Radar`).
  - توليد سند المخالصة الرسمي المشفر بـ SHA-256 برقم `#CLR-YYYY-XXX`.

- [ ] **Step 5: تشغيل اختبارات التطابق.**
  ```powershell
  pnpm --filter @alsaada/admin-dashboard test -- workforce-parity.spec.ts
  ```

- [ ] **Step 6: Commit تطابق القوى العاملة.**
  ```powershell
  git add apps/admin-dashboard/src/app/admin/workforce apps/admin-dashboard/src/lib/data-fetchers.ts modules/workforce apps/admin-dashboard/tests/parity
  git commit -m "feat(parity): achieve 100% functional parity for workforce module flows"
  ```

---

#### Task 10: مطابقة موديول الإعدادات وتفويض العمال المشرفين (Settings & Delegations)
**المسؤولية:** وكيل التنفيذ وتجربة الاستخدام ووكيل المالية والأمان (Implementation & Security Agents)  
**الملفات المستهدفة:**
- تعديل: `modules/settings/src/flows/00.12-user-rbac-management/`
- تعديل: `apps/admin-dashboard/src/app/admin/settings/users/page.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/settings/sites/page.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/settings/audit-vault/page.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/settings/telemetry/page.tsx`
- إنشاء: `apps/admin-dashboard/tests/parity/settings-and-delegations-parity.spec.ts`

- [ ] **Step 1: كتابة اختبار تفويض العامل المشرف `WORKER_SUPERVISOR` الفاشل أولاً.**
  التحقق من:
  1. تقديم مشرف الموقع طلب تفويض لعامل داخل موقعه فقط.
  2. حظر اعتماد مشرف الموقع للطلب الذي قدمه (`Self-Approval Prohibition`).
  3. اعتماد أو رفض السوبر أدمن والجينرال أدمن للتفويض.
  4. التحول التلقائي لدور العامل إلى `WORKER_SUPERVISOR` فور اعتماد أول تفويض.
  5. عودة دور العامل تلقائياً إلى `WORKER` فور سحب أو انتهاء آخر تفويض.
  6. حظر تفويض أي وظيفة سيادية تحمل `delegatable: false`.

- [ ] **Step 2: تطوير إدارة تفويضات العامل المشرف في البوت (`00.12`).**
  - إضافة شاشة تفويضات العامل في معالج `00.12-user-rbac-management`.
  - ربط التفويض بـ `FlowCode` محدد والموقع المسجل للعامل.
  - إيقاف التفويضات تلقائياً عند نقل العامل إلى موقع آخر.

- [ ] **Step 3: تطوير شاشة إدارة المستخدمين والتفويضات في الداشبورد (`/admin/settings/users`).**
  - استعراض المستخدمين والأدوار السبعة المعتمدة فقط.
  - تبويب خاص بالتفويضات النشطة والمعلقة مع إمكانية السحب والاعتماد الفوري.
  - عرض قائمة تدقيق ومراجعة أصحاب الأدوار الملغاة لإعادة تعيينهم من قبل السوبر أدمن.

- [ ] **Step 4: مطابقة شاشات خزانة الحوادث الجنائية ومراقبة الأداء APM.**
  - ربط `/admin/settings/audit-vault` بسجل الحوادث `system_error_logs` و`audit_logs` برقم `traceId`.
  - ربط `/admin/settings/telemetry` بمؤشرات APM والعمليات البطيئة الحقيقية.

- [ ] **Step 5: تشغيل الاختبارات.**
  ```powershell
  pnpm --filter @alsaada/admin-dashboard test -- settings-and-delegations-parity.spec.ts
  ```

- [ ] **Step 6: Commit تطابق الإعدادات والتفويضات.**
  ```powershell
  git add modules/settings apps/admin-dashboard/src/app/admin/settings apps/admin-dashboard/tests/parity
  git commit -m "feat(parity): implement worker supervisor delegations and settings parity"
  ```

---

#### Task 11: تحصين شاشات الموافقات والمالية والعمليات بالصلاحيات وتطهير البيانات الوهمية
**المسؤولية:** وكيل المالية والأمان ووكيل التنفيذ (Security & Implementation Agents)  
**الملفات المستهدفة:**
- تعديل: `apps/admin-dashboard/src/app/admin/approvals/page.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/approvals/approvals-client.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/finance/page.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/finance/treasury/page.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/operations/page.tsx`
- تعديل: `apps/admin-dashboard/src/app/admin/logistics/page.tsx`
- إنشاء: `apps/admin-dashboard/tests/parity/approvals-security-guard.spec.ts`

- [ ] **Step 1: كتابة اختبار الصلاحيات ودورة الحالات لشاشات الموافقات والمالية.**
  التحقق من:
  1. قصر شاشة الخزينة والإدارة المالية على `SUPER_ADMIN` و`GENERAL_ADMIN`؛ ورفض وصول `FIELD_ADMIN` إلى الخزينة المركزية.
  2. في شاشة الموافقات: تمكين `FIELD_ADMIN` من تقديم أو سحب طلباته المعلقة (`PENDING`)، وحظر اعتماده لأي طلب.
  3. حظر إنشاء أي أثر مالي نهائي في حساب العامل قبل اعتماد السوبر أدمن (`APPROVED`).
  4. استئصال أي بيانات وهمية (Mock Data) وعرض الحالة الفارغة النظيفة (`Empty State`) عند عدم وجود سجلات.

- [ ] **Step 2: ربط شاشة الموافقات (`/admin/approvals`) بجدول `approval_tickets`.**
  - استبدال البيانات الثابتة باستعلام حقيقي من نموذج `ApprovalTicket` في PostgreSQL.
  - تطبيق دورة الحالات الصارمة (`PENDING` -> `UNDER_REVIEW` -> `APPROVED` / `REJECTED` / `WITHDRAWN`).

- [ ] **Step 3: تحصين شاشات المالية والعمليات واللوجستيات بقواعد RBAC الصارمة.**
  - فرض حجب المستحقات التعاقدية في أي جدول أو ملخص.
  - ربط شاشات العهد والعمليات بالنماذج المتاحة في قاعدة البيانات (`FinancialCustody`, `FuelTank`, `Equipment`).
  - توثيق دقيق في `docs/19`: شاشات المالية والعمليات بالداشبورد محصنة وتعمل على مستوى Staging / Foundation، بينما تسجل حالة التدفقات المرتبطة بها كـ `DASHBOARD_IN_PROGRESS` حتى يتم بناء تدفقات البوت التابعة لها في خطط مستقلة لاحقة وفق مبدأ البوت أولاً (Section 13.1).

- [ ] **Step 4: تشغيل الاختبارات.**
  ```powershell
  pnpm --filter @alsaada/admin-dashboard test -- approvals-security-guard.spec.ts
  ```

- [ ] **Step 5: Commit تحصين الشاشات التمهيدية.**
  ```powershell
  git add apps/admin-dashboard/src/app/admin apps/admin-dashboard/tests/parity
  git commit -m "feat(security): harden approvals, finance, and operations dashboard screens with strict rbac"
  ```

---

### المرحلة التاسعة: ميزات المتصفح الاحترافية والتصدير مع حجب الحقول
### Phase 9: Enterprise Browser Features, Filtering & Secure Exports

#### Task 12: محرك التصفية، البحث الشامل، والتصدير الآمن المحصن ضد تسرب الرواتب
**المسؤولية:** وكيل التنفيذ وتجربة الاستخدام ووكيل المالية والأمان (UX & Security Agents)  
**الملفات المستهدفة:**
- إنشاء: `apps/admin-dashboard/src/app/api/export/excel/route.ts`
- إنشاء: `apps/admin-dashboard/src/app/api/export/pdf/route.ts`
- تعديل: `apps/admin-dashboard/src/lib/data-fetchers.ts`
- إنشاء: `apps/admin-dashboard/src/components/ui/data-table.tsx`
- إنشاء: `apps/admin-dashboard/tests/secure-export.spec.ts`

- [ ] **Step 1: كتابة اختبار التصدير الآمن وحجب الرواتب الفاشل أولاً.**
  التحقق من:
  1. عند طلب `FIELD_ADMIN` تصدير ملف إكسيل أو PDF لكشف العمال، يتم استئصال أعمدة الراتب الأساسي والإضافي والبدلات وإجمالي المستحقات بالكامل من الملف الناتج على الخادم.
  2. عند طلب `SUPER_ADMIN` أو `GENERAL_ADMIN` تصدير الكشف، تظهر الأعمدة المصرح بها.
  3. التحقق من تطبيق التصفية والفرز والتقسيم على الخادم (`Server-Side Pagination & Sorting`).

- [ ] **Step 2: بناء مكون الجدول التفاعلي المعياري `DataTable`.**
  - يدعم البحث الفوري، الفرز متعدد الأعمدة، تقسيم الصفحات، واختيار الأعمدة المرئية المسموحة.
  - يمنع عرض أي حقل محجوب في خيارات الأعمدة أو التصفية.

- [ ] **Step 3: بناء نقطة نهاية التصدير المالي والإداري لإكسيل (`/api/export/excel`).**
  - استخدام `exceljs` لتوليد مصنفات متوافقة مع الهوية الرسمية (RTL).
  - تمرير طلب التصدير عبر `FieldProjectionPolicy` المستوردة من `@alsaada/rbac`:
    ```typescript
    const userRole = session.role;
    const columns = getPermittedExportColumns(userRole, featureKey);
    // basicSalary, overtimeRate, allowances are completely stripped for FIELD_ADMIN
    ```

- [ ] **Step 4: بناء نقطة نهاية التصدير والطباعة الرسمية لـ PDF (`/api/export/pdf`).**
  - توليد مستندات رسمية ذات ترويسة معتمدة وأرقام مرجعية جنائية مع تطبيق نفس سياسة حجب الحقول.

- [ ] **Step 5: تشغيل الاختبارات.**
  ```powershell
  pnpm --filter @alsaada/admin-dashboard test -- secure-export.spec.ts
  ```

- [ ] **Step 6: Commit ميزات المتصفح والتصدير الآمن.**
  ```powershell
  git add apps/admin-dashboard/src
  git commit -m "feat(exports): implement secure excel/pdf exports with server-side field masking"
  ```

---

### المرحلة العاشرة: مواصفات التحليل والذكاء لكل وظيفة
### Phase 10: Professional Dashboard Intelligence Specification per Feature

#### Task 13: تفعيل مواصفات التحليل الذكي والمؤشرات الحقيقية لكل وظيفة
**المسؤولية:** وكيل التنفيذ وتجربة الاستخدام ووكيل التحكيم والحوكمة (Implementation & Governance Agents)  
**الملفات المستهدفة:**
- تعديل: `packages/rbac/src/catalog.ts`
- تعديل: `apps/admin-dashboard/src/lib/analytics-registry.ts`
- تعديل: `apps/admin-dashboard/src/app/admin/analytics/page.tsx`
- إنشاء: `apps/admin-dashboard/tests/dashboard-intelligence.spec.ts`

- [ ] **Step 1: كتابة اختبار التحليل الذكي الفاشل أولاً.**
  التحقق من:
  1. توثيق معادلة ومصدر كل مؤشر KPI وحسابها خادمياً.
  2. منع ظهور أي مؤشر يسمح لمشرف الموقع باستنتاج الرواتب أو التكاليف التعاقدية.
  3. عرض شاشات خالية حقيقية (`Empty States`) أنيقة عند عدم توفر بيانات دون استخدام بيانات وهمية (Zero-Mock).
  4. دعم الانتقال التفصيلي (`Drill-down`) من الرسم أو المؤشر إلى السجلات الفعلية.

- [ ] **Step 2: تسجيل مواصفات التحليل الذكي للوظائف في عقود `@alsaada/rbac`.**
  - منسوبات السولار: معدل الاستهلاك اليومي، توقع موعد النفاد، كشف القراءات الشاذة.
  - مخزن المطبخ: معدل الصرف، الأصناف الحرجة، وتوقع النفاد.
  - السلف والمسحوبات: إجمالي الموقع، رادار التكرار، مقارنة الفترات.
  - العهد: الأرصدة المفتوحة، أعمار العهد، وفروق التسوية.
  - شؤون العاملين: نسبة التواجد، توزيع المهن، رادار انتهاء العقود ونواقص البيانات.
  - موثوقية النظام: معدل الأخطاء لكل traceId، زمن الاستجابة P95، ونسبة نجاح الجلسات.

- [ ] **Step 3: ربط واجهة التحليلات بالاستعلامات الحقيقية في PostgreSQL.**
  تطبيق دوال حساب المؤشرات في `apps/admin-dashboard/src/lib/data-fetchers.ts` بناءً على تجميعات SQL حقيقية.

- [ ] **Step 4: تشغيل الاختبارات.**
  ```powershell
  pnpm --filter @alsaada/admin-dashboard test -- dashboard-intelligence.spec.ts
  ```

- [ ] **Step 5: Commit مواصفات التحليلات الذكية.**
  ```powershell
  git add packages/rbac apps/admin-dashboard/src
  git commit -m "feat(analytics): register dashboard intelligence specs and live aggregated queries"
  ```

---

### المرحلة الحادية عشرة: بوابات التحقق الشاملة واختبارات الجودة
### Phase 11: Comprehensive Verification Gates & Automated Quality Assurance

#### Task 14: تشغيل بوابات فحص الأمان والحوكمة والتايب سكريبت والدوكر
**المسؤولية:** وكيل المعمارية وDevOps ووكيل التحكيم والحوكمة (DevOps & Governance Agents)  
**الملفات المستهدفة:**
- إنشاء: `tools/governance/verify-rbac-matrix.ts`
- إنشاء: `tools/governance/verify-field-masking.ts`
- إنشاء / فحص: `tools/governance/verify-observability-contract.ts`
- تعديل: `package.json` (إضافة سكريبتات الفحص المتقدمة)
- فحص كامل: شجرة المشروع والـ Dockerfiles

- [ ] **Step 1: بناء وتشغيل سكريبت فحص مصفوفة الأدوار والصلاحيات الآلي.**
  إنشاء `tools/governance/verify-rbac-matrix.ts` للتحقق الحتمي من:
  - عدم وجود أي إشارة للأدوار الملغاة في مسارات الإنتاج.
  - حصر دخول الداشبورد في الأدوار الثلاثة فقط في 100% من المسارات.
  ```powershell
  pnpm tsx tools/governance/verify-rbac-matrix.ts
  ```
  *المتوقع:* خروج الأمر بـ `Exit 0`.

- [ ] **Step 2: بناء وتشغيل سكريبت فحص حجب الحقول المالية (Field Masking Gate).**
  إنشاء `tools/governance/verify-field-masking.ts` للتحقق من عدم تسرب أي حقل مالي حساس لمشرف الموقع عبر API أو الصفحات أو التصدير:
  ```powershell
  pnpm tsx tools/governance/verify-field-masking.ts
  ```
  *المتوقع:* خروج الأمر بـ `Exit 0`.

- [ ] **Step 3: تشغيل سكريبت التحقق من عقد الرصد الجنائي (Observability & Anti-Silent Failure Gate).**
  إنشاء أو تشغيل `tools/governance/verify-observability-contract.ts` للتأكد من:
  - صفر `console.error` وصفر `catch` صامت في كود المصادقة والجلسات والتصدير.
  - تمرير كافة الحوادث عبر `ErrorVaultService` مع `traceId` موحد وفق Section 30 من وثيقة التصميم.
  ```powershell
  pnpm tsx tools/governance/verify-observability-contract.ts
  ```
  *المتوقع:* خروج الأمر بـ `Exit 0`.

- [ ] **Step 4: تشغيل فحص TypeScript الصارم عبر كامل المستودع.**
  ```powershell
  pnpm typecheck
  ```
  *المتوقع:* خروج الفحص بـ `Exit 0` ودون أي خطأ تجميع.

- [ ] **Step 5: تشغيل حزمة الاختبارات الشاملة للمستودع.**
  ```powershell
  pnpm test
  ```
  *المتوقع:* نجاح 100% لكافة الاختبارات.

- [ ] **Step 6: بناء حاويات Docker للتحقق من سلامة النشر والإنتاج.**
  ```powershell
  docker build -f docker/Dockerfile -t alsaada-bot:plan21-verify .
  docker build -f docker/Dockerfile.dashboard -t alsaada-dashboard:plan21-verify .
  docker compose config
  ```
  *المتوقع:* اكتمال البناء بنجاح وصلاحية ملفات Compose.

- [ ] **Step 7: تشغيل بوابة الحوكمة الشاملة.**
  ```powershell
  pnpm governance:verify
  ```
  *المتوقع:* اجتياز كافة فواحص الحوكمة والـ Tamper check بنجاح تام.

- [ ] **Step 8: Commit أدوات وبوابات التحقق.**
  ```powershell
  git add tools/governance package.json
  git commit -m "chore(governance): add automated rbac matrix, field masking, and observability verification gates"
  ```

---

### المرحلة الثانية عشرة: تحديث سجل الترحيل وإغلاق الخطة بالأدلة
### Phase 12: Master Migration Registry Update, Documentation Cleanup & DoD Sign-Off

#### Task 15: توثيق الوظائف المستحدثة في docs/19 وإغلاق الخطة رسمياً
**المسؤولية:** الوكيل الرئيسي ووكيل QA والترحيل (Main Integrator & QA Agent)  
**الملفات المستهدفة:**
- تعديل: `docs/19-legacy-to-enterprise-master-feature-migration-registry.md`
- تعديل: `docs/08-rbac-roles-permissions-and-security.md`
- تعديل: `docs/10-authentication-sessions-and-credentials-governance.md`
- تعديل: `docs/20-settings-administration-and-sovereign-control.md`
- تعديل: `docs/21-mandatory-module-architecture-and-gates.md`
- تعديل: `docs/22-telegram-ux-ergonomics-and-design-system.md`
- تعديل: `docs/work-plans/README.md`
- تعديل: `docs/work-plans/21-plan-unified-bot-dashboard-auth-rbac-and-functional-parity.md` (تحديث نسب الإنجاز وجدول DoD)

- [ ] **Step 1: قيد الوظائف المؤسسية المستحدثة في السجل المرجعي `docs/19`.**
  إدراج الوظائف الأربع الجديدة في جدول "✨ الوظائف والتحسينات المستحدثة":
  - **`NEW-60`**: **المصادقة الحصرية السيادية من البوت والرابطان المتزامنان (Localhost & Tunnel)**.
  - **`NEW-61`**: **جلسات لوحة التحكم الخادمية لمدة 8 ساعات ونظام تمديد وإدارة الجلسات عبر تيليجرام**.
  - **`NEW-62`**: **عقد الصلاحيات المركزي وتفويضات العامل المشرف الدقيقة وحجب المستحقات التعاقدية**.
  - **`NEW-63`**: **مركز التحليلات الموحد ومطابقة وظائف البوت والداشبورد بالخدمات المشتركة**.
  وتحديث حالة التدفقات المنتقلة إلى `🟢 مكتمل وموثق 100%`.

- [ ] **Step 2: تطهير الوثائق من مصطلحات المنظومة القديمة الملغاة.**
  تحديث وثائق المشروع في `docs/` لحذف أي ذكر لـ:
  - صفحة `/login` أو تسجيل الدخول من الويب.
  - Telegram Mini App / TWA initData login.
  - OTP وكلمات المرور المتوقفة.
  - الأدوار الملغاة (`EXECUTIVE`, `ACCOUNTANT`, إلخ).

- [ ] **Step 3: تحديث فهرس خطط العمل `docs/work-plans/README.md`.**
  تعديل حالة `PLAN-21` في الجدول إلى `🟢 مكتمل وموثق 100%` وتدوين رقم الـ Commit النهائي وتاريخ الاعتماد.

- [ ] **Step 4: استعراض الفحص النهائي لـ Git ونظافة جذر المشروع.**
  ```powershell
  git diff --check
  git status --short
  ```
  *المتوقع:* عدم وجود أي مسافات زائدة أو ملفات مؤقتة عشوائية في جذر المشروع.

- [ ] **Step 5: الـ Commit النهائي للإغلاق التوثيقي.**
  ```powershell
  git add docs/
  git commit -m "docs(plan-21): finalize unified auth, rbac, and parity master plan with DoD sign-off"
  ```

---

## 5. جدول متابعة وتوقيع معايير القبول النهائية (Master DoD Sign-Off)

| # | بند القبول الحاسم | المرجع المعماري | دليل التحقق والاختبار | الحالة |
|:---:|---|---|---|:---:|
| 1 | المصادقة الحصرية من البوت فقط | Section 18 | `apps/admin-dashboard/tests/legacy-auth-elimination.spec.ts` | 🟢 مكتمل وموثق 100% |
| 2 | الرابط المحلي ورابط النفق يعملان متزامنين | Section 19 | `apps/bot-server/tests/dashboard-command.spec.ts` | 🟢 مكتمل وموثق 100% |
| 3 | رمز الدخول صالح 5 دقائق ولمرة واحدة ذرياً | Section 20 | `apps/admin-dashboard/tests/auth-claim.spec.ts` | 🟢 مكتمل وموثق 100% |
| 4 | الجلسة خادمية 8 ساعات مسجلة بـ PostgreSQL | Section 21 | `packages/database/tests/migration-rbac-and-sessions.spec.ts` | 🟢 مكتمل وموثق 100% |
| 5 | إشعار تيليجرام قبل الانتهاء بساعة مع التمديد | Section 22 | `apps/bot-server/src/services/session-monitor.service.ts` | 🟢 مكتمل وموثق 100% |
| 6 | قصر الدخول على 3 أدوار فقط (سوبر، جينرال، مشرف موقع) | Section 8 | `packages/rbac/tests/rbac.spec.ts` | 🟢 مكتمل وموثق 100% |
| 7 | تثبيت الأدوار السبعة المعتمدة فقط وترحيل ADMIN | Section 5, 26 | `packages/database/prisma/migrations/` | 🟢 مكتمل وموثق 100% |
| 8 | رتبة العامل المشرف مشتقة تلقائياً من التفويض | Section 9 | `apps/admin-dashboard/tests/parity/settings-and-delegations-parity.spec.ts` | 🟢 مكتمل وموثق 100% |
| 9 | الحجب الخادمي التام للمستحقات عن مشرف الموقع | Section 10 | `tools/governance/verify-field-masking.ts` | 🟢 مكتمل وموثق 100% |
| 10 | دورة طلبات المكافآت والجزاءات لمشرف الموقع | Section 11 | `apps/admin-dashboard/tests/parity/approvals-security-guard.spec.ts` | 🟢 مكتمل وموثق 100% |
| 11 | الحذف التام لصفحة /login و TWA و OTP القديمة | Section 25 | `apps/admin-dashboard/tests/legacy-auth-elimination.spec.ts` | 🟢 مكتمل وموثق 100% |
| 12 | صفحة الملخص مخصصة حسب الدور | Section 14.1 | `apps/admin-dashboard/tests/role-overview.spec.ts` | 🟢 مكتمل وموثق 100% |
| 13 | مركز الإحصائيات الموحد بالاكتشاف الآلي | Section 15 | `apps/admin-dashboard/tests/dashboard-intelligence.spec.ts` | 🟢 مكتمل وموثق 100% |
| 14 | التطابق الوظيفي بنسبة 100% بين البوت والداشبورد | Section 13 | `apps/admin-dashboard/tests/parity/workforce-parity.spec.ts` | 🟢 مكتمل وموثق 100% |
| 15 | التصدير الآمن لإكسيل وPDF مع حجب الحقول | Section 17 | `apps/admin-dashboard/tests/secure-export.spec.ts` | 🟢 مكتمل وموثق 100% |
| 16 | خروج كافة أوامر الفحص والبناء بـ Exit 0 | Section 32 | `pnpm typecheck && pnpm test && pnpm governance:verify` | 🟢 مكتمل وموثق 100% |
| 17 | تحديث السجل المرجعي docs/19 بنسبة 100% | Section 34 | `docs/19-legacy-to-enterprise-master-feature-migration-registry.md` | 🟢 مكتمل وموثق 100% |
| 18 | الصفر التام لـ console.error والابتلاع الصامت | Section 30 | `tools/governance/verify-observability-contract.ts` | 🟢 مكتمل وموثق 100% |

---

> [!NOTE]
> **التوقيع والاعتماد:** تبدأ الفرق البرمجية تنفيذ هذه المهام task-by-task وفق تسلسل المراحل الـ 12 المعتمد بعد الاعتماد الكتابي الصريح لهذه الخطة من المستخدم.
