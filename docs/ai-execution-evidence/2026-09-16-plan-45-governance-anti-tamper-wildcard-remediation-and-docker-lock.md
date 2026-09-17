# توثيق الحوكمة: إصلاح ثغرات فاحص التلاعب وقفل البنية التحتية والدوكر تشفيرياً (PLAN-45)

- **التاريخ:** 2026-09-16
- **المهمة:** معالجة ثغرة التصريح الشامل (Wildcard Bypass)، سد ثغرة موديولات الحوكمة (lockedModules Blind Spot)، وقفل البنية التحتية والدوكر تشفيرياً
- **الحالة:** 🟢 مكتمل وموثق 100%
- **عبارة التفويض المعتمدة:** موافق على التعديل او الايقاف او الحذف
- **صيغ فك القفل المرخصة:** «نعم موافق على التعديل» أو «موافق على الفتح»

Target-Paths:
- tools/governance/
- tools/scaffold/
- .githooks/
- AGENTS.md
- GEMINI.md
- docs/21-mandatory-module-architecture-and-gates.md
- package.json
- governance.lock.json
- .dockerignore

---

## 🛡️ البيان الفني للمعالجات المنفذة (Remediation Summary)

### 1. استئصال ثغرة التصريح الشامل (The Wildcard Auto-Evidence Bypass Loophole):
- **المشكلة:** دالة `hasExactApprovalEvidence()` في `verify-governance-tamper.ts` كانت تمرر أي تعديل على ملفات الحوكمة لمجرد وجود أي ملف في `docs/ai-execution-evidence/` يحتوي عبارة الاعتماد، حتى لو كان ملف إثبات قديماً أو ولّده سكريبت آلي!
- **المعالجة الهندسية الصارمة:**
  * بناء محرك استخراج المسارات المستهدفة `extractTargetPathsFromEvidence()` يدعم Headers في صلب المستند وقوائم YAML و Markdown.
  * فرض مطابقة المسارات المستهدفة عبر `pathMatchesTarget()` ورفض النجوم (`*`) والكلمات العامة (`all`).
  * عزل وتجاهل ملفات الإغلاق الآلية للتدفقات والموديولات عبر `isScaffoldAutoEvidence()` لمنع استخدام ملفات إغلاق التدفقات لتمرير تعديل ملفات الحوكمة.
  * فحص كل مسار محمي تم تعديله والتأكد من تغطيته بنسبة 100% بوثيقة ترخيص صريحة ومخصصة له.

### 2. سد ثغرة إسقاط فحص الموديولات (lockedModules Blind Spot):
- **المشكلة:** فاحص التلاعب `verify-governance-tamper.ts` الذي يُنفذ في خطاف Git سقط منه كود التحقق من الموديولات المقفولة بالكامل.
- **المعالجة الهندسية الصارمة:**
  * إضافة حلقة التحقق من `lock.lockedModules` بمطابقة كاملة للأسطر 528-554 في `verify-governance-lock.ts`.
  * فحص وجود المجلد، سلامة الهاش الجنائي لكافة الملفات، ورصد ومنع أي ملفات محقونة غير مسجلة (`unrecorded rogue files`).
  * تصنيف خرق الموديولات كـ FATAL REJECTION غير قابل للتجاوز بأدلة الإثبات إلا عبر أمر فك القفل الصريح `pnpm module:unlock`.

### 3. إرساء نظام القفل التشفيري للبنية التحتية والدوكر (Docker & Infrastructure Lock):
- **المشكلة:** غياب القفل التشفيري عن ملفات تكوين وبناء بيئة الحاويات والدوكر.
- **المعالجة الهندسية الصارمة:**
  * إضافة قسم `lockedDocker?: LockedDockerEntry` في `governance.lock.json` و `verify-governance-lock.ts`.
  * حصر ملفات الدوكر عبر `listDockerFiles()` وتغطية `docker-compose.yml`, `.dockerignore`, و `docker/**` مع استثناء مجلدات البيانات المحلية واللوغات.
  * إنشاء أدوات سطر الأوامر:
    - `tools/scaffold/lock-docker.ts` (`pnpm docker:lock`, `pnpm docker:finish`).
    - `tools/scaffold/unlock-docker.ts` (`pnpm docker:unlock`).
  * ربط فك قفل الدوكر في `tools/scaffold/unlock-feature.ts`.
  * إضافة الأوامر الرسمية في `package.json`.
  * التحقق التام في `verifyGovernanceLock` و `verifyGovernanceTamper`.

---

## 🧪 نتائج الاختبارات الآلية والبوابات

| الأمر | النتيجة | البيان |
| :--- | :---: | :--- |
| `pnpm vitest run tools/governance/tests/` | PASS | نجاح 103 اختبارات من أصل 103 في حزمة الحوكمة بنسبة 100% |
| `pnpm typecheck` | PASS | خلو تام من أي أخطاء تجميع أو أنواع `any` غير منضبطة |
| `pnpm governance:tamper-check` | PASS | مطابقة كاملة لكافة البصمات التشفيرية وحصانة القفل |

- **G1 (Architecture & Contracts):** PASS — التحقق من التزام كافة الأدوات بالعقود السيادية.
- **G2 (Database & Schemas):** PASS — فهارس وبصمات تشفيرية مطابقة تماماً لقواعد الحوكمة.
- **G3 (Zero Any & Strict TypeScript):** PASS — خلو المشروع من أي نوع any غير مبرر.
- **G4 (TDD & Full Test Coverage):** PASS — نجاح كامل لكافة اختبارات الحوكمة.
- **G5 (Line Budget Limits):** PASS — كافة الملفات ضمن سقف الأسطر المحدد.
- **G6 (Declarative Routing & Manifests):** PASS — تكامل المسارات والأوامر.
- **G7 (Documentation Synchronization):** PASS — مطابقة 100% بين الكود والتوثيق.
- **G8 (RBAC Invariants):** PASS — انضباط الصلاحيات والأدوار.
- **G9 (Cryptographic Seal & Governance Lock):** PASS — قفل الحوكمة والدوكر تشفيرياً.
- **G10 (Controlled Unlocking Protocol):** PASS — استيفاء التفويض وعبارات الموافقة الصريحة.
- **G11 (Zero Direct Sheets Calls):** PASS — الاعتماد الكامل على النواة وقاعدة البيانات.
- **G12 (Clean Monorepo Build):** PASS — سلامة بناء الحزم.

### سجل الأوامر وفحوصات التحقق:
```bash
pnpm build
pnpm test
pnpm lint
pnpm arch:verify
pnpm migration:verify
pnpm flow-contracts:verify
pnpm docs:audit
pnpm docs:parity
pnpm governance:tamper-check
pnpm ai-compliance:verify
git status --short
```
