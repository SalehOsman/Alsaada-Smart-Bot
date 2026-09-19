# خطة 84 — هندسة منظومة الإصدارات المؤتمتة ذاتياً وأدوات التحديثات الآمنة بنمط الأثر الصفري
## Al-Saada Smart Bot Enterprise Living Release Engine, Safe Upgrade Toolsuite & Gate 21

- **التاريخ:** 2026-09-19
- **الحالة:** 🟢 قيد التنفيذ والتطبيق الميداني (In Execution)
- **خط الأساس:** شجرة عمل نظيفة على `main` بعد دمج الخطة 83 (ترقية pnpm 12.4.2)
- **الفرع المخصص:** `plan/84-enterprise-safe-upgrade-and-living-release-engine`
- **الإصدار الناتج:** `v2.0.0-alpha.84`
- **المرجعية الدستورية:** `AGENTS.md`, `GEMINI.md`, `docs/28-enterprise-safe-upgrade-and-living-release-standard.md`
- **التفويض الدستوري:** مستوفى بالعبارة السيادية العليا: `«موافق على التعديل او الايقاف او الحذف»`.

---

### 1️⃣ خلفية المنهجية وأهداف الخطة (Context & Objectives)
استجابةً للرؤية المعمارية والمواءمة الصارمة عبر أداة `/grill-me`، تهدف هذه الخطة إلى إحداث تحول نوعي من "نظام الإصدارات الشكلي والمجمد عند alpha.1" إلى **منظومة إصدارات حية وفعالة أثناء مرحلة التطوير النشط (Active Pre-Release Management)**، مدمجة بأدوات برمجية متكاملة تضمن الأثر الصفري المطلق (**Zero Blast Radius**) وحماية التدفقات الـ 126 القائمة.

#### الأهداف التنفيذية:
1. الخروج الفوري من تجميد `alpha.1` وتدشين خط الأساس الفعلي المتطابق مع إنجاز 83 خطة عمل: **`v2.0.0-alpha.83`**.
2. بناء محرك الإصدارات الدلالي المؤتمت بالكامل (`tools/release/release-engine.ts`) لتنفيذ الترقيات الذرية بنمط الأثر اليدوي الصفري (Zero Manual Touch).
3. بناء وتفعيل **بوابة الحوكمة رقم 21 (`Gate 21: verify-release-sync`)** لمنع أي دمج لا يستوفي تطابق سجل التغييرات ورقم الإصدار.
4. بناء حزمة أدوات التحديث الآمنة في `tools/upgrade/`:
   - رادار فحص الأثر متعدد المتجهات (`impact-scanner.ts`).
   - مدير الارتداد الفوري (< 60 ثانية) (`rollback-manager.ts`).
   - مشغل بوابات الجودة الرباعية (`verify-upgrade.ts`).
   - المعالج التفاعلي الشامل (`wizard.ts`).
5. تدشين سجل التغييرات المؤسسي الموحد (`CHANGELOG.md`) بأثر رجعي شامل.
6. حقن النسخة التشغيلية الحية في البوت، ولوحة التحكم، وتليمتري الأخطاء.
7. ترقية إصدار المنظومة بنهاية الخطة إلى **`v2.0.0-alpha.84`**.

---

### 2️⃣ مصفوفة المكونات والملفات المنفذة (Execution Matrix)

| المكون البرمجي | الملف المستهدف | نوع الإجراء | الوظيفة الهندسية |
| :--- | :--- | :---: | :--- |
| **Telemetry** | `packages/telemetry/src/version.ts` | `NEW` | مزود النسخة المركزية والتليمتري الحية |
| **Telemetry** | `packages/telemetry/src/index.ts` | `MODIFY` | تصدير كائنات وأنواع الإصدار الحي |
| **Release Engine** | `tools/release/release-engine.ts` | `NEW` | محرك الأتمتة الذري للترقيات والـ SemVer |
| **Governance Gate**| `tools/governance/verify-release-sync.ts` | `NEW` | بوابة الحوكمة 21 لضمان تطابق سجل التغييرات |
| **Upgrade Tool** | `tools/upgrade/impact-scanner.ts` | `NEW` | رادار فحص الأثر الشجري متعدد المتجهات |
| **Upgrade Tool** | `tools/upgrade/rollback-manager.ts` | `NEW` | مدير الارتداد الفوري وتوثيق اللقطات |
| **Upgrade Tool** | `tools/upgrade/verify-upgrade.ts` | `NEW` | مشغل بوابات الجودة الرباعية للترقيات |
| **Upgrade Tool** | `tools/upgrade/wizard.ts` | `NEW` | المعالج التفاعلي الشامل للترقيات |
| **Audit Archive** | `docs/upgrade-records/README.md` | `NEW` | أرشيف وفهرس سجلات التحديثات الجنائية |
| **Audit Archive** | `docs/upgrade-records/UPG-TEMPLATE.md` | `NEW` | قالب توثيق وفحص عمليات الترقية |
| **Standard** | `docs/28-enterprise-safe-upgrade-and-living-release-standard.md` | `NEW` | المعيار والدستور الدائم للإصدارات والترقيات |
| **Changelog** | `CHANGELOG.md` | `NEW` | سجل التغييرات المؤسسي الموحد |
| **Monorepo** | `package.json` | `MODIFY` | ترقية النسخة وإضافة الأوامر التشغيلية والبوابة 21 |
| **Constitution** | `AGENTS.md` & `GEMINI.md` | `MODIFY` | إضافة البند الثامن (ميثاق الإصدارات والترقيات الآمنة) |
| **Governance** | `governance.lock.json` | `MODIFY` | حماية الملفات الجديدة وإعادة احتساب بصمات SHA-256 |
