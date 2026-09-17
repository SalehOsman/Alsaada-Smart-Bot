# خطة عمل رقم 65 (المعدلة والمحصنة): تأسيس منظومة نظافة Git، الترقيم المتزامن، ومحرك الإصدارات المؤتمت (Changesets & Release Pipeline)

## 📌 خلفية الخطة وسياقها المعماري (Architectural Context)
بناءً على جلسة المراجعة الجنائية والتحقيق المعماري (`/grill-me`) وتطبيق النقد الهندسي الصارم من منظور خبير إدارة الإصدارات و Git/GitHub:
تبين وجود فجوة تنظيمية أدت إلى تراكم 344 ملفاً في شجرة العمل (Working Tree) على فرع `main` منذ آخر كومت رسمي `b79950b` (الخاص بالخطتين 24 و 25).
رغم أن كافة بوابات الجودة الـ 16 ناجحة بنسبة 100%، وكافة الاختبارات الـ 1661 في 213 ملف اختبار ناجحة بامتياز، إلا أن غياب وسوم Git، وغياب محرك مؤتمت للإصدارات، وغياب بوابة تلزم بعمل Commit مع كل خطة عمل، سمح بحدوث هذا التراكم والانفصال بين واقع الكود وواقع تاريخ Git.

---

## 🔍 التقرير النقدي واكتشاف الثغرات المعمارية (Adversarial Critique Findings)

1. **ثغرة الحزم الخاصة في Changesets (`privatePackages` Trap):**
   - كافة تطبيقات وحزم المونوريبو مسجلة كـ `"private": true`. أداة Changesets تتجاهل الحزم الخاصة افتراضياً عند الترقيم ولا تنشئ لها وسوماً ما لم يتم تفعيل خيار `"privatePackages": { "version": true, "tag": true }` في `.changeset/config.json`.
   - استخدام الـ Wildcard مثل `"@alsaada/*"` في حقل `fixed` غير مدعوم في بنية Changesets؛ ويجب سرد أسماء كافة الحزم الـ 11 صراحة داخل المصفوفة.
2. **ثغرة إسقاط موديول الإعدادات (`@alsaada/settings`):**
   - إغفال موديول الإعدادات في الترقيم وتركه عند `1.0.0` يكسر مبدأ المزامنة الكاملة. يجب ضم `@alsaada/settings` مع `@alsaada/workforce` وكافة الحزم والتطبيقات.
3. **فخ كسر الـ Pre-Commit التشفيري (Governance Lock Circular Trap):**
   - تعديل `package.json` أو ملفات الحوكمة يكسر البوابة 16 فوراً عند محاولة الـ Commit. الحل الحتمي هو تنفيذ `pnpm governance:lock` قبل الـ Commit وتحديث بصمات الـ 178+ ملفاً.
4. **فخ التصميم الساذج لبوابة النظافة (`verify-git-hygiene.ts`):**
   - منع وجود أي ملفات معدلة محلياً أثناء التطوير اليومي يعطل المطور؛ لذلك تم تصميم البوابة لتفحص:
     - تطابق أرقام الإصدارات بين كافة الحزم والجذر بنسبة 100% (Version Parity).
     - خلو جذر المشروع من أي ملفات سكراتش أو اختبارات ميتة (`temp.*`, `scratch.*`, `test.ts`).
     - اشتراط النظافة التامة لشجرة العمل حصراً في بيئة التكامل المستمر (`CI=true`).
5. **أذونات GitHub Actions وفخ النشر الخارجي:**
   - ضبط `permissions: contents: write, pull-requests: write` في سير عمل `release.yml`، مع تعطيل محاولة النشر لـ npm registry الخارجي لكون النظام مستودعاً داخلياً مغلقاً (Internal Enterprise Monorepo).

---

## 🎯 الأهداف الرئيسية المعدلة (Key Objectives)

1. **مزامنة الترقيم الموحد لـ 11 حزمة وتطبيق (Synchronized Versioning 2.0.0-alpha.1):**
   - ترقية وتوحيد إصدارات التطبيقات (`apps/*`)، الحزم المشتركة (`packages/*`)، والموديولات (`modules/*`) لتتطابق عند `2.0.0-alpha.1`.
2. **تثبيت وتهيئة محرك Changesets المخصص للـ Private Monorepo:**
   - تهيئة `.changeset/config.json` مع دعم كامل لـ `fixed packages` بدون أقنعة عامة، وتفعيل `privatePackages` وترقية التبعيات الداخلية.
   - صياغة أول Changeset يوثق اكتمال النواة وبوابات الجودة ومحرك السرعة.
3. **تأسيس بوابة الحوكمة السابعة عشرة المحصنة (Gate 17: `verify-git-hygiene.ts`):**
   - فحص تطابق الإصدارات، تطهير الجذر من الملفات العشوائية، وفحص سلامة شجرة العمل في CI.
   - ربط البوابة بـ `package.json` وأمر `governance:verify`، وكتابة اختباراتها الشاملة في `tools/governance/tests/verify-git-hygiene.spec.ts`.
4. **أتمتة سير العمل على GitHub Actions (`release.yml`):**
   - إنشاء workflow احترافي يدير طلبات السحب الخاصة بالإصدارات (Release PRs) ويولد وسوم Git آلياً عند الدمج في `main`.
   - دمج البوابة 17 في `.github/workflows/ci.yml`.
5. **تحديث ميثاق الحوكمة ودستور العمل (`AGENTS.md` و `GEMINI.md`):**
   - إضافة البند الإلزامي التاسع: **ميثاق النظافة الحتمية لـ Git وحظر تراكم شجرة العمل (Zero Working-Tree Drift & Mandatory Commit Protocol)**.
6. **تحديث القفل التشفيري واعتماد الـ Milestone Commit وتدشين الوسم `v2.0.0-alpha.1`:**
   - تشغيل `pnpm governance:lock` لتحديث الحماية التشفيرية لكافة الملفات.
   - تنفيذ الـ Commit الشامل المهيكل للملفات الـ 344.
   - تدشين أول وسم Git رسمي في تاريخ المستودع: `v2.0.0-alpha.1`.

---

## 🛠️ مراحل التنفيذ التفصيلية (Implementation Phases)

### المرحلة 1: مزامنة أرقام الإصدارات في الـ 11 حزمة وتطبيق
تعديل ملفات `package.json` ليصبح حقل `"version": "2.0.0-alpha.1"` متطابقاً فيها جميعاً:
1. `package.json` (الجذر)
2. `apps/bot-server/package.json`
3. `apps/admin-dashboard/package.json`
4. `packages/rbac/package.json`
5. `packages/core-components/package.json`
6. `packages/database/package.json`
7. `packages/regional-engine/package.json`
8. `packages/national-id-engine/package.json`
9. `packages/telemetry/package.json`
10. `packages/ai-vision-engine/package.json`
11. `modules/settings/package.json`
12. `modules/workforce/package.json`

### المرحلة 2: تثبيت وتهيئة منظومة Changesets للحزم الخاصة
1. تثبيت `@changesets/cli`:
   `pnpm add -Dw @changesets/cli`
2. إنشاء `.changeset/config.json`:
   ```json
   {
     "$schema": "https://unpkg.com/@changesets/config/schema.json",
     "changelog": "@changesets/cli/changelog",
     "commit": false,
     "fixed": [
       [
         "alsaada-smart-bot",
         "@alsaada/bot-server",
         "@alsaada/admin-dashboard",
         "@alsaada/rbac",
         "@alsaada/core-components",
         "@alsaada/database",
         "@alsaada/regional-engine",
         "@alsaada/national-id-engine",
         "@alsaada/telemetry",
         "@alsaada/ai-vision-engine",
         "@alsaada/settings",
         "@alsaada/workforce"
       ]
     ],
     "linked": [],
     "access": "restricted",
     "baseBranch": "main",
     "updateInternalDependencies": "patch",
     "ignore": [],
     "privatePackages": {
       "version": true,
       "tag": true
     }
   }
   ```
3. إنشاء ملف التغييرات الأولي `.changeset/v2-0-0-alpha-1-initial-core.md`.

### المرحلة 3: بناء بوابة الحوكمة السابعة عشرة (`verify-git-hygiene.ts`) واختباراتها
1. إنشاء `tools/governance/verify-git-hygiene.ts`:
   - التحقق من تطابق حقل `version` في كافة ملفات `package.json` مع نسخة الجذر.
   - مسح جذر المشروع للتأكد من عدم وجود ملفات مهملة خارج النطاق.
   - فحص بيئة CI والتأكد من خلوها من أي تغييرات غير مدرجة.
2. إضافة اختبارات شاملة في `tools/governance/tests/verify-git-hygiene.spec.ts`.
3. ربط السكريبت في `package.json` وتحديث `pnpm governance:verify` ليشمل البوابات الـ 17.

### المرحلة 4: أتمتة خط الإنتاج والإصدارات في GitHub Actions
1. إنشاء `.github/workflows/release.yml` مع تحديد أذونات `contents: write` و `pull-requests: write`.
2. تحديث `.github/workflows/ci.yml` لتضمين `pnpm git-hygiene:verify`.

### المرحلة 5: تحديث الدستور وميثاق العمل (`AGENTS.md` و `GEMINI.md`)
إضافة البند التاسع في الميثاق:
* **ميثاق النظافة الحتمية لـ Git وحظر تراكم شجرة العمل (Zero Working-Tree Drift & Mandatory Commit Protocol):**
  1. يُحظر تماماً الانتقال إلى خطة عمل جديدة أو بدء أي ميزة قبل إتمام كومت رسمي موثق للخطة السابقة فور قفلها تشفيرياً.
  2. يُمنع وجود أي فجوة بين إصدارات حزم المونوريبو (Synchronized Versioning Enforced).
  3. تدوين رقم الـ Commit في سجل الميزات `docs/19` وخطة العمل.

### المرحلة 6: تحديث القفل التشفيري، الكومت المعياري، وتدشين الوسم
1. تشغيل `pnpm governance:lock` لتحديث الهاشات التشفيرية لكافة الملفات الـ 178+ بما فيها أدوات الحوكمة والملفات الجديدة.
2. تشغيل فحص شامل للبوابات الـ 17 عبر `pnpm governance:verify`.
3. إضافة كافة الملفات للـ Staging: `git add .`
4. تنفيذ الـ Milestone Commit المهيكل:
   ```bash
   git commit -m "feat(milestone): harden enterprise core, lock 17 governance gates, and establish synchronized changesets release system (v2.0.0-alpha.1)"
   ```
5. إنشاء الوسم الرسمي الأول في المستودع:
   ```bash
   git tag -a v2.0.0-alpha.1 -m "Release v2.0.0-alpha.1: Enterprise Core Hardened, 17 Quality Gates, and Synchronized Monorepo"
   ```

---

## 🛡️ خطة التحقق والضمان (Verification Plan)
1. `pnpm typecheck`: التحقق من التايب سكريبت لكافة الحزم والتطبيقات (Exit 0).
2. `pnpm vitest run tools/governance/tests/verify-git-hygiene.spec.ts`: نجاح كافة اختبارات البوابة 17.
3. `pnpm git-hygiene:verify`: تشغيل فاحص البوابة والتأكد من مطابقة إصدارات الحزم الـ 11.
4. `pnpm governance:verify`: نجاح البوابات الـ 17 بنسبة 100%.
5. `git status`: التأكد من أن شجرة العمل أصبحت نظيفة بنسبة 100% (`working tree clean`).
6. `git tag -l`: التأكد من وجود وظهور الوسم `v2.0.0-alpha.1`.
