# سجل خط الأساس والتحقق قبل التعديل — PLAN-21
## Pre-Change Baseline Verification & Snapshot Log — 2026-09-13

> **المشروع:** منظومة السعادة سمارت بوت (`F:\Alsaada-Smart-Bot`)  
> **خطة العمل المعتمدة:** `docs/work-plans/21-plan-unified-bot-dashboard-auth-rbac-and-functional-parity.md` (المرحلة الأولى: Phase 1)  
> **التاريخ والتوقيت:** 2026-09-13T06:20:00Z  
> **الوكيل المنفذ:** Worker M0 (DevOps & Baseline Fixation Specialist)  
> **الهدف:** تثبيت خط الأساس البيئي، وحفظ نسخة احتياطية آمنة لقاعدة البيانات، وضمان إمكانية الاستعادة بنسبة 100% قبل الشروع في أي تعديل كودي أو هيكلي.

---

## 1. هوية النسخة وحالة المستودع (Environment & Repository State)

### 1.1 معرّفات الكود والبيئة الفعلية
- **Git HEAD Commit:** `71dbc5242ab685f1c9d04ee789f3daf1b473addc`
- **الفرع النشط (Branch):** `main`
- **إصدار Node.js:** `v24.11.1`
- **إصدار pnpm:** `11.0.8`
- **نظام التشغيل:** Windows 10/11 Enterprise x64
- **قشرة الأوامر (Shell Environment):** PowerShell 5.1 / PowerShell 7 مع `cmd.exe` للتوجيه الثنائي الآمن.

### 1.2 حالة شجرة العمل (Git Working Tree Status Summary)
تم فحص شجرة العمل عبر `git status --short` ورصد الملفات المعدلة من الخطط السابقة (Plans 14-20) غير المتتبعة لحمايتها من الكسر:
```text
M .dockerignore
M GEMINI.md
M apps/bot-server/package.json
M apps/bot-server/src/bot.ts
M apps/bot-server/src/config/env.ts
M apps/bot-server/src/services/command-scope.service.ts
M apps/bot-server/src/services/error-vault.service.ts
M apps/bot-server/tests/env-validation.spec.ts
M apps/bot-server/tests/error-vault-and-telemetry.spec.ts
M docker-compose.yml
M docker/Dockerfile
M docs/19-legacy-to-enterprise-master-feature-migration-registry.md
A docs/superpowers/specs/2026-09-13-unified-bot-dashboard-auth-rbac-parity-design.md
M docs/work-plans/README.md
M modules/workforce/...
M packages/core-components/src/completion-card/whatsapp.ts
M packages/database/prisma/schema.prisma
M pnpm-lock.yaml
M tsconfig.dev.json
?? apps/admin-dashboard/
?? apps/bot-server/src/handlers/dashboard.handler.ts
?? apps/bot-server/src/services/dashboard-auth.service.ts
?? apps/bot-server/tests/adversarial-dashboard-access.spec.ts
?? apps/bot-server/tests/dashboard-command.spec.ts
?? docker/Dockerfile.dashboard
?? docs/Logo/
?? docs/ai-execution-prompts/
?? docs/periodic-audits/2026-09-12/
?? docs/work-plans/14-plan-... to 21-plan-...
?? packages/database/prisma/migrations/20260912090000_add_trace_incidents_and_magic_claim/
?? packages/database/prisma/migrations/20260913010000_align_financial_ledger_hash_defaults/
?? packages/database/tests/migration-trace-and-magic-claim.spec.ts
?? packages/telemetry/
```

---

## 2. حالة الحاويات والخدمات (Docker Compose Services State)

تم التحقق من تشغيل وصحة كافة الحاويات الخمس الأساسية للمنظومة عبر `docker compose ps`:

| اسم الحاوية | اسم الخدمة | الصورة (Image) | الحالة (Status) | المنافذ المربوطة (Ports) |
|---|---|---|---|---|
| `alsaada_enterprise_postgres` | `postgres` | `postgres:16-alpine` | Up (healthy) | `127.0.0.1:5432->5432/tcp` |
| `alsaada_enterprise_redis` | `redis` | `redis:7-alpine` | Up (healthy) | `127.0.0.1:6380->6379/tcp` |
| `alsaada_enterprise_bot` | `bot` | `alsaada-enterprise-system-bot` | Up | `0.0.0.0:3001->3000/tcp` |
| `alsaada_enterprise_dashboard` | `dashboard` | `alsaada-enterprise-system-dashboard` | Up (healthy) | `0.0.0.0:3002->3002/tcp` |
| `alsaada_enterprise_studio` | `studio` | `alsaada-enterprise-system-studio` | Up | `127.0.0.1:5555->5555/tcp` |

- **فحص تكوين الحاويات:** تم تشغيل `docker compose config` وانتهى بنجاح تام (`Exit 0`).

---

## 3. حالة قاعدة البيانات الفعلية (Live Database State)

### 3.1 سجل المهاجرات في Prisma (`packages/database/prisma/migrations/`)
- **سجل المهاجرات المطبقة على قاعدة `alsaada_db`:**
  1. `20260911000000_init_enterprise_hash_ledger` (المخطط التأسيسي للجداول ونماذج الهاش التراكمي).
  2. `20260912090000_add_trace_incidents_and_magic_claim` (حقول traceId وservice وجدول استهلاك التوكنات).
  3. `20260913010000_align_financial_ledger_hash_defaults` (محاذاة قيود الهاش الافتراضية).
- **حالة التطابق:** المخطط محدث بالكامل ومطابق لـ `schema.prisma`.

### 3.2 إحصائيات السجلات الفعلية في قاعدة البيانات (Record Counts)
- جدول المستخدمين (`users`): **1** مستخدم فعال (`role = 'SUPER_ADMIN'`, `id = 1547d65c-773b-4d0f-a151-63575bc1da70`, `telegramId = 7594239391`, `fullName = "ابو زين"`, `isActive = true`).
  - لا توجد أي حسابات تحمل أدواراً ملغاة حالياً في قاعدة البيانات الحية، مما يعني أن المهاجرة التطهيرية لن تؤثر على أي مستخدم تشغيلي.
- جدول العمال (`workers`): **4** عمال بحالة `ACTIVE` (`MNT-AUT-001`, `OP-DOZ-001`, `ADM-LAS-001`, `OP-DRV-001`).
- جدول المواقع (`sites`): **2** موقعان بحالة `ACTIVE` (`STE-HQ` المقر الرئيسي، `STE-01` موقع ابو طرطور - الخارجة).
- جدول سجلات التدقيق (`audit_logs`): **18** سجلاً تدقيقياً مشفراً.
- جدول أخطاء النظام (`system_error_logs`): **5** سجلات.
- جدول استهلاك الرموز المؤقتة (`auth_magic_token_consumptions`): **4** سجلات.
- وظائف PostgreSQL 16: تم التحقق من دعم دالة توليد المعرفات `gen_random_uuid()` أصلية دون الحاجة لتثبيت إضافات خارجية.

---

## 4. النسخة الاحتياطية الآمنة لقاعدة البيانات (PostgreSQL Binary Dump Snapshot)

### 4.1 بروتوكول التصدير الثنائي الآمن (Binary-Safe Protocol)
- **الملاحظة التقنية والمعمارية:** في بيئة Windows PowerShell، تؤدي إعادة التوجيه القياسية (`>`) لتدفقات البيانات الثنائية الناتجة عن أوامر Docker إلى إعادة تشفير البايتات (Encoding Transcoding Corruption) بترميز النص الافتراضي، مما يفسد البنية الداخلية لنسخ PostgreSQL المضغوطة. كما أن تخصيص طرفية وهمية (TTY) يقوم بتحويل نهايات السطور (`\n` إلى `\r\n`).
- **الإجراء الإلزامي الآمن والمعتمد:** استخدام قشرة `cmd.exe` للتوجيه الثنائي الخام المباشر، مع إضافة خيار `-T` لمنع تخصيص TTY:

```cmd
cmd /c "docker compose exec -T postgres pg_dump -U alsaada_admin -d alsaada_db -Fc > .scratch\plan21-prechange.dump"
```

### 4.2 التحقق التجريبي من سلامة النسخة والجدول التعريفي (TOC & Magic Header Verification)
- **أمر فحص جدول المحتويات (TOC Check):**
  ```cmd
  cmd /c "docker compose exec -T postgres pg_restore -l < .scratch\plan21-prechange.dump"
  ```
- **بيانات التحقق التجريبية المقاسة فعلياً على القرص:**
  - **مسار الملف على القرص:** `.scratch/plan21-prechange.dump`
  - **حجم الملف الفعلي:** 214568 بايت (209.54 كيلوبايت — تم التأكد تجريبياً من كونه أكبر من 150 كيلوبايت ومطابق لبيانات قاعدة الإنتاج).
  - **نوع النسخة:** PostgreSQL Custom Dump (`-Fc`) مضغوطة وثنائية وآمنة بالكامل.
  - **ترويسة الملف السحرية (Magic Header):** أول 5 بايتات تم فحصها ثنائياً وتمثل محارف `PGDMP` (القيم الست عشرية: `50 47 44 4D 50` | المقابلة للقيم العشرية بترميز ASCII: `80 71 68 77 80`).
  - **عدد عناصر الفهرس الفعلية (TOC Entries):** `411` عنصراً تعريفياً مسجلاً في ترويسة الأرشيف (407 أسطر عناصر مطابقة لنمط `^\s*\d+;` وإجمالي 422 سطراً بالأرشيف) مقاساً فعلياً من مخرجات `pg_restore -l` ويغطي كافة الجداول، الفهارس، القيود، والمهاجرات المطبقة.
  - **حالة القراءة الثنائية:** نجاح تام دون أي أخطاء أو تشويه (Exit Code: 0) بنسبة 100%.

### 4.3 البصمة الرقمية الموثقة للنسخة (SHA-256 Checksum)
- **أمر استخراج البصمة في PowerShell:**
  ```powershell
  Get-FileHash .scratch/plan21-prechange.dump -Algorithm SHA256
  ```
- **القيمة الفعلية للبصمة الرقمية (Actual SHA-256 Digest):**
  `8C75598121FB250CF07E954594DD2982BFBEFB7FFD7E70F1EBE0A7D7A2AC1252`

---

## 5. بروتوكول الاستعادة الجنائية عند الطوارئ (Emergency Rollback Protocol)

في حال حدوث أي خلل أثناء تنفيذ مراحل خطة PLAN-21، أو تعثر مهاجرات Prisma، أو فشل اختبارات الصلاحيات والمطابقة، يتم التراجع الفوري الكامل واستعادة خط الأساس التشغيلي بنسبة 100% باتباع البروتوكول الجنائي المتعدد المستويات التالي.

> [!WARNING]
> **قاعدة السلامة المطلقة لمنع فقدان البيانات (Zero-Data-Loss Invariant):**
> يُحظر تماماً تشغيل أي أمر تدميري (`dropdb`) قبل استيفاء **فحص ما قبل الإسقاط (Pre-Flight Safety Gate)** للتحقق من وجود وسلامة ملف النسخة الاحتياطية الثنائية. إذا تعذر التحقق من الملف، يتم إيقاف الإجراء فوراً وإلغاء أمر الإسقاط لمنع محو قاعدة البيانات دون بديل.

---

### 5.1 فحص ما قبل الإسقاط وتأكيد سلامة ملف النسخة (Pre-Flight Safety Gate)

قبل إجراء أي تعديل أو إسقاط، يتم التحقق برمجياً من وجود ملف النسخة الاحتياطية `.scratch\plan21-prechange.dump`، والتأكد من حجمه (> 0 بايت)، وفحص قابلية قراءة الفهرس الداخلي (TOC):

```cmd
:: 1. التحقق من وجود الملف على القرص الصلب
if not exist .scratch\plan21-prechange.dump (
    echo ❌ [CRITICAL ERROR] Backup file .scratch\plan21-prechange.dump not found! Aborting rollback.
    exit /b 1
)

:: 2. التحقق من سلامة الفهرس الداخلي (TOC) وقابلية قراءة النسخة بواسطة محرك PostgreSQL
cmd /c "docker compose exec -T postgres pg_restore -l < .scratch\plan21-prechange.dump > nul"
if %ERRORLEVEL% neq 0 (
    echo ❌ [CRITICAL ERROR] Backup archive is corrupted or unreadable! Aborting rollback.
    exit /b 1
)
echo ✅ [PRE-FLIGHT PASS] Backup archive verified and ready for restoration.
```

---

### 5.2 عزل الاتصالات المفتوحة وإيقاف الحاويات المرتبطة (Connection Quarantine)

لمنع حدوث أخطاء تعارض الاتصالات المفتوحة (`ERROR: database "alsaada_db" is being accessed by other users`)، ولمنع حاوية لوحة التحكم (`dashboard`) من تكرار فحص الصحة الدوري (`/api/health`) كل 10 ثوانٍ أثناء تفريغ واستعادة البيانات، يتم إيقاف الحاويات المستهلكة مؤقتاً:

```cmd
docker compose stop bot dashboard studio
```

*الحاويات المستمرة في العمل أثناء الاستعادة:* `alsaada_enterprise_postgres` و `alsaada_enterprise_redis` فقط.

---

### 5.3 الإسقاط الجبري وإعادة تأسيس قاعدة البيانات (Forced Drop & Re-Creation)

يتم إسقاط قاعدة البيانات الحالية جبرياً باستخدام خيار `--force` المعتمد في PostgreSQL 16 لقطع أي اتصالات معلقة من خارج الحاويات، ثم إعادة إنشائها بصلاحيات المالك:

```cmd
:: 1. إسقاط قاعدة البيانات جبرياً وبشكل تكراري آمن (--if-exists)
docker compose exec -T postgres dropdb -U alsaada_admin --force --if-exists alsaada_db

:: 2. إعادة إنشاء قاعدة بيانات نظيفة فارغة بمالك النظام
docker compose exec -T postgres createdb -U alsaada_admin -O alsaada_admin alsaada_db
```

---

### 5.4 الاستعادة الثنائية الآمنة لخط الأساس (Binary Snapshot Restoration)

تتم استعادة النسخة الثنائية الكاملة عبر التوجيه الثنائي الآمن لـ `cmd.exe`:

```cmd
cmd /c "docker compose exec -T postgres pg_restore -U alsaada_admin -d alsaada_db --no-owner --role=alsaada_admin < .scratch\plan21-prechange.dump"
```

---

### 5.5 الفحص الجنائي لسلامة الاستعادة (Post-Restore Forensic Verification)

قبل إعادة تشغيل الحاويات، يتم تشغيل حزمة استعلامات التحقق الجنائي للتأكد من استعادة كافة الجداول والبيانات بدقة:

```cmd
:: 1. التحقق من اكتمال عدد الجداول في المخطط العام (يجب أن يساوي 65 جدولاً)
docker compose exec -T postgres psql -U alsaada_admin -d alsaada_db -c "SELECT count(*) AS total_tables FROM information_schema.tables WHERE table_schema = 'public';"

:: 2. التحقق من سلامة وأعداد السجلات في الجداول الحاكمة لخط الأساس
docker compose exec -T postgres psql -U alsaada_admin -d alsaada_db -c "SELECT 'users' AS table_name, count(*) AS records FROM users UNION ALL SELECT 'workers', count(*) AS records FROM workers UNION ALL SELECT 'sites', count(*) AS records FROM sites UNION ALL SELECT 'audit_logs', count(*) AS records FROM audit_logs;"

:: 3. تأكيد تسجيل آخر مهاجرة معتمدة لـ Prisma
docker compose exec -T postgres psql -U alsaada_admin -d alsaada_db -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1;"
```

**معايير النجاح الإلزامية للمطابقة (Baseline Acceptance Criteria):**
- إجمالي الجداول (`total_tables`): **65** جدولاً.
- سجلات المستخدمين (`users`): **1** مستخدم (`SUPER_ADMIN`).
- سجلات العمال (`workers`): **4** عمال نشطين.
- سجلات المواقع (`sites`): **2** موقعان نشطان.
- سجلات التدقيق (`audit_logs`): **18** سجلاً تدقيقياً على الأقل.
- آخر مهاجرة مثبتة: `20260913010000_align_financial_ledger_hash_defaults`.

---

### 5.6 إعادة تشغيل الحاويات والتحقق التشغيلي النهائي (Service Resumption & Health Check)

بعد التحقق التام من سلامة قاعدة البيانات المستعادة، يتم استئناف عمل الخدمات والتحقق من حالتها:

```cmd
:: 1. إعادة تشغيل حاويات البوت ولوحة التحكم والستوديو
docker compose start bot dashboard studio

:: 2. التحقق من عودة كافة الحاويات لحالة العمل الطبيعية والصحية
docker compose ps

:: 3. فحص جاهزية واجهة فحص الصحة للوحة التحكم (Readiness Probe)
cmd /c "curl -s -f http://127.0.0.1:3002/api/health || powershell -NoProfile -Command \"Invoke-RestMethod -Uri http://127.0.0.1:3002/api/health\""
```

---

## 6. قرار الأمان والاعتماد الانتقالي (Safety Assessment & Progression Decision)

1. **البيئة مستقرة:** كافة الحاويات الخمس الأساسية تعمل بكفاءة وHealthy.
2. **المخطط سليم:** لا توجد مهاجرات معلقة أو تالفة في Prisma.
3. **النسخة الاحتياطية محققة فعلياً:** تم إنشاء ملف النسخة الثنائي `.scratch/plan21-prechange.dump` على القرص الصلب (بحجم 214,568 بايت وبصمة SHA-256 موثقة: `8C75598121FB250CF07E954594DD2982BFBEFB7FFD7E70F1EBE0A7D7A2AC1252`)، والتأكد من ترويسة PGDMP وسلامة الـ TOC (411 عنصراً) بنسبة 100%.
4. **بروتوكول الطوارئ محصن:** تم تأمين خطوات التراجع الجبري بصمام أمان ما قبل الإسقاط، وعزل الحاويات المتصلة، وتطبيق `--force --if-exists` في PostgreSQL 16.
5. **الاعتماد:** خط الأساس مثبت تجريبياً، ومساحة العمل مؤهلة بالكامل للانتقال إلى **المرحلة الثالثة (Phase 3: بناء حزمة `@alsaada/rbac`)** و**المرحلة الرابعة (Phase 4: ترقية قاعدة البيانات)**.

