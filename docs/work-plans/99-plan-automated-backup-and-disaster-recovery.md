# خطة عمل رقم 99: منظومة النسخ الاحتياطي الكامل واستمرارية الأعمال واستعادة الكوارث
## Work Plan 99: Full Sovereign Backup & Disaster Recovery System (Database, Codebase, Assets & Cloud Sync)

> **الحالة:** 🟢 قيد التنفيذ المعتمد (Approved & In-Progress)  
> **الفرع المعزول المستهدف (OBOO Branch):** `plan/99-automated-backup-and-disaster-recovery`  
> **المرجع الدستوري:** ميثاق `GEMINI.md` البنود 3 و 5، نتائج التدقيق الدوري (المحور 13: 35%)، ومصفوفة بوابات الجودة (Gate G12, G13, G20)، ومعايير `Rulebook 12`  
> **السلطة الرقابية:** `/saleh` (Sovereign Stakeholder Proxy & Chief Strategy Auditor)  
> **النتيجة المستهدفة:** رفع ركيزة استمرارية الأعمال والنسخ الاحتياطي (المحور 13) من **35% إلى 100%** مع صفر فقدان للبيانات (RPO < 24h) وزمن استعادة فوري (RTO < 15m).

---

## 🎯 الأركان الستة الهندسية للخطة (The 6 Architectural Pillars)

### الركن الأول (Pillar 1): النطاق والهدف ومطابقة الأساس الوظيفي (Scope & Functional Baseline Parity)
- **Baseline Parity:** تغطية فجوة المحور 13 ومطابقة الأساس الوظيفي لاستمرارية الأعمال ومنظومة F:\HR مع صفر انحراف.
تأسيس منظومة نسخ احتياطي واستعادة كوارث سيادية ثلاثية الأبعاد:
1. **لقطات قاعدة البيانات (PostgreSQL Dump):** استخراج لقطات ذرية بصيغة Custom Archive مضغوطة ومشفرة، مع استبعاد المالك والصلاحيات وفرض المعاملة الواحدة لضمان مطابقة دفاتر الأستاذ المالية.
2. **لقطات الكود البرمجي (Git Bundle):** أرشفة كامل تاريخ المشروع البرمجي في حزمة `git bundle` مستقلة تمكّن من استعادة المستودع كاملاً حتى في حال فقدان خوادم GitHub.
3. **المرفقات الحيوية والأسرار (Assets & Secrets):** ضغط وتشفير صور البطاقات والعقود وملفات `.env` بمفتاح AES-256-GCM.
4. **التخزين المزدوج:** تخزين محلي على القرص الصلب المادي للجهاز المضيف خارج دوكر تماماً في `./backups/` وتخزين سحابي مشفر على Google Drive.

### الركن الثاني (Pillar 2): نطاق شريحة الـ 10 ملفات والواجهات
1. **شريحة البوت الرأسية (Flow 00.13):** في `modules/settings/src/flows/00.13-system-backup-recovery/`:
   - `flow.contract.json`
   - `flow.handler.ts`
   - `flow.keyboard.ts`
   - `flow.messages.ts`
   - `flow.service.ts`
   - `flow.repository.ts`
   - `flow.types.ts`
   - `flow.validators.ts`
   - `flow.telemetry.ts`
   - `flow.docs.md`
2. **قمرة لوحة التحكم (Admin Dashboard Cockpit):**
   - صفحة العرض: `apps/admin-dashboard/src/app/admin/settings/backup/page.tsx`
   - المكون التفاعلي: `apps/admin-dashboard/src/app/admin/settings/backup/backup-client.tsx`
   - واجهات الـ API: `apps/admin-dashboard/src/app/api/admin/backup/route.ts` و `restore/route.ts`
3. **أدوات النواة (Core Tools Suite):**
   - `tools/backup/backup-manager.ts`
   - `tools/backup/codebase-packer.ts`
   - `tools/backup/gdrive-sync.ts`
   - `tools/backup/verify-disaster-recovery.ts`
   - `tools/backup/tests/backup-suite.spec.ts`
4. **حاوية النسخ المؤتمت في Docker Compose:**
   - إضافة خدمة `postgres-backup` بصورة `prodrigestivill/postgres-backup-local:16-alpine`.

### الركن الثالث (Pillar 3): بوابات الجودة الإلزامية (Mandatory Quality Gates)
- **Gate G1 (Type Safety):** خلو كافة الملفات من أي أخطاء تيبسكربت أو `any`.
- **Gate G2 (10-File Slice Architecture):** التطبيق الصارم لشريحة الـ 10 ملفات لتدفق البوت.
- **Gate G5 (Telegram Ergonomics Budget):** الالتزام بميزانية (36/16/7/3) لكافة الأزرار ولوحات المفاتيح.
- **Gate G9 (Observability & Telemetry):** توثيق كافة العمليات في خزانة الأعطال وعدم ابتلاع الأخطاء.
- **Gate G12 (Financial Ledger Invariant):** استعادة البيانات واختبار السلسلة المحاسبية `verify-financial-integrity.ts`.
- **Gate G13 (Cryptographic Tamper Guard):** قفل كافة المكونات في `governance.lock.json`.
- **Gate G22 (Mobile Viewport Ergonomics):** مطابقة الواجهات للشاشات الصغيرة وحظر تجاوز الأسطر.

### الركن الرابع (Pillar 4): الثوابت الهندسية وتحصينات JEV الستة (The 6 Critical JEV Hardenings)
1. **حل مفارقة المفتاح وعبارة الطوارئ الباردة (Cold Emergency Recovery Passphrase):**
   - توليد واستخدام عبارة استرجاع باردة رئيسية (Master Mnemonic / Key) مستقلة عن ملف `.env` لفك تشفير النسخ واستعادتها حتى عند الفقدان التام لملف البيئة، مع اشتقاق مفاتيح PBKDF2.
2. **التدفق غير المتزامن للبوت (Asynchronous Telegram Flow):**
   - استجابة تدفق 00.13 في أقل من 500ms ببطاقة انتظار جارية مع التحديث الموضعي (In-place edit) لمنع مهلة Telegram Webhook الـ 10 ثوانٍ.
3. **التفريغ الذري في معاملة واحدة لقاعدة البيانات (Atomic Single-Transaction DB Dump):**
   - فرض الوسوم الصارمة: `pg_dump --single-transaction --no-owner --no-privileges --clean --if-exists -F c`.
4. **مقاومة انقطاع الشبكة والتجزئة الموزعة (Resilient Network Backoff & Chunking):**
   - تطبيق خوارزمية التراجع الأسي ثلاثية المراحل (2s -> 4s -> 8s) مع دعم الرفع المجزأ المتواصل (Resumable Chunked Upload).
5. **بوابة التحقق الصارم بعد الاستعادة (Post-Restore Verification Gate):**
   - الفحص التلقائي الإلزامي لسلامة دفاتر الأستاذ وسلاسل الهاش المالية عبر `verify-financial-integrity.ts` والتأكد من مطابقة سجل هجرات بريزما `_prisma_migrations`.
6. **مصفوفة اختبارات النطاق العميقة (Deep Domain Test Matrix):**
   - كشف النسخ الفاسدة والمعدلة، التحقق من حجم الكود <30MB، واكتشاف التلاعب بالتشفير وسلسلة الهاش.

### الركن الخامس (Pillar 5): ميثاق الاستبعاد الصارم للتبعيات (Zero-Bloat Exclusion Rule)
- الحظر التام لتضمين مجلدات `node_modules` و `.pnpm-store` و `dist` و `.next` و `.astro` و `build` و `.turbo` و `coverage` و `backups` و `*.log`.
- النتيجة: حزمة الكود خفيفة وسريعة (<15MB إلى <30MB) وتُنتج وتُرفع في ثوانٍ معدودة.

### الركن السادس (Pillar 6): خطة الفحص والتحقق والأوامر التنفيذية
- `pnpm typecheck` (صفر أخطاء)
- `pnpm test` (اجتياز كافة الاختبارات)
- `pnpm backup:create` (إنشاء نسخة محلية كاملة)
- `pnpm backup:list` (استعراض اللقطات ومطابقة بصمات الهاش)
- `pnpm backup:drill` (تدريب محاكاة الكارثة الآلي)
- `pnpm backup:verify` (الفحص الجنائي الشامل)
- `pnpm lock:all` / `pnpm lock` (القفل التشفيري التام)
- التوثيق في `docs/19` وسجل `docs/work-plans/README.md`.
