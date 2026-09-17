# خطة العمل 45: معالجة ثغرات فاحص التلاعب وقفل البنية التحتية والدوكر تشفيرياً (Anti-Tamper Hardening, Module Audit & Docker Lock)

بناءً على التكليف المباشر وتوجيهات الحوكمة الصارمة، تهدف هذه الخطة إلى استئصال 3 ثغرات أمنية وحوكمية تم رصدها في منظومة فحص التلاعب (`verify-governance-tamper.ts` و `verify-governance-lock.ts`):

---

## 🎯 الأهداف ونطاق العمل (Objectives & Scope)

1. **معالجة ثغرة التصريح الشامل (The Wildcard Auto-Evidence Bypass Loophole):**
   - دالة `hasExactApprovalEvidence()` في `tools/governance/verify-governance-tamper.ts` كانت تمرر أي تعديل على ملفات الحوكمة لمجرد وجود ملف في `docs/ai-execution-evidence/` يحتوي عبارة الاعتماد، حتى لو كان ملف إثبات قديم أو ولّده سكريبت آلي!
   - **الحل الجذري:**
     * تقييد صلاحية أدلة الاعتماد بحيث تُلزم كل ملف إثبات باستهداف المسارات المحددة صراحة (`Target-Paths: ...`).
     * منع ملفات إغلاق التدفقات والشاشات الآلية (`*-closure.md` و `*-unlock-*.md`) من منح أي تصريح بتعديل ملفات الحوكمة العامة المحمية.
     * حظر استخدام النجوم (`*`) أو الكلمات العامة (`all`) للتصريح الشامل.
     * التحقق من أن كافة الملفات المعدلة مغطاة بنسبة 100% بأدلة إثبات معتمدة وموجهة لها حصراً.

2. **سد ثغرة إسقاط فحص الموديولات المقفولة (lockedModules Blind Spot):**
   - سقط من فاحص التلاعب `verify-governance-tamper.ts` كود التحقق من الموديولات المقفولة بالكامل (`lock.lockedModules`).
   - **الحل الجذري:**
     * إضافة حلقة تدقيق الهاش الجنائي وكشف التعديل/الحذف والملفات غير المسجلة لـ `lock.lockedModules` بمطابقة كاملة لما هو منفذ في `verify-governance-lock.ts` (الأسطر 528-554).
     * تصنيف أي انتهاك لبصمات الموديولات كخرق تشفيري غير قابل للتجاوز بأدلة الإثبات (`NON-BYPASSABLE`).

3. **إرساء منظومة القفل التشفيري للبنية التحتية والدوكر (Docker Infrastructure Cryptographic Lock):**
   - إضافة قسم `lockedDocker?: LockedDockerEntry` في `governance.lock.json` و `verify-governance-lock.ts`.
   - تغطية ملفات Compose (`docker-compose.yml`)، ملف التجاهل المعماري (`.dockerignore`)، ومجلد `docker/` مع استبعاد مجلدات البيانات المحلية واللوغات.
   - إنشاء أدوات سطر الأوامر:
     * `tools/scaffold/lock-docker.ts` (`pnpm docker:lock`).
     * `tools/scaffold/unlock-docker.ts` (`pnpm docker:unlock`).
   - إضافة السكريبتات الرسمية في `package.json`.
   - حماية ملفات الدوكر داخل فاحص التلاعب `verify-governance-tamper.ts` ومنع تعديلها أو حقن ملفات دون فك القفل المسبق.

---

## 📋 مصفوفة التنفيذ خطوة بخطوة (Execution Steps)

- [x] تحليل وتدقيق كافة الملفات والاختبارات ذات الصلة.
- [x] إنشاء `.dockerignore` وفق معايير الحاويات المؤسسية في Plan 39.
- [x] تحديث `tools/governance/verify-governance-lock.ts`:
  - تعريف `LockedDockerEntry` وربط `lockedDocker` في `GovernanceLock`.
  - إضافة `listDockerFiles`, `lockDockerEntry`, `unlockDockerEntry`.
  - فحص نزاهة وبصمات الدوكر داخل `verifyGovernanceLock`.
- [x] تحديث `tools/governance/verify-governance-tamper.ts`:
  - هندسة دالة فحص أدلة الاعتماد الصريحة واستخراج المسارات المستهدفة (`extractTargetPathsFromEvidence`).
  - عزل وتجاهل ملفات الإغلاق الآلية للتدفقات والموديولات (`isScaffoldAutoEvidence`).
  - إضافة حلقة فحص `lock.lockedModules`.
  - إضافة حلقة فحص `lock.lockedDocker`.
- [x] إنشاء `tools/scaffold/lock-docker.ts` و `tools/scaffold/unlock-docker.ts`.
- [x] تحديث `tools/scaffold/unlock-feature.ts` لتمكين فك قفل الدوكر بسلاسة.
- [x] تحديث `package.json` لإضافة `docker:lock` و `docker:unlock` و `docker:finish`.
- [x] كتابة اختبارات شاملة في `tools/governance/tests/`:
  - اختبارات فحص التصريح المستهدف ومنع التجاوز العشوائي.
  - اختبارات فحص الموديولات المقفولة في فاحص التلاعب.
  - اختبارات قفل وفك قفل ملفات الدوكر والبنية التحتية.
- [x] تشغيل الاختبارات وفحص التايب سكريبت بنجاح تام (103/103 اختبارات ناجحة، Zero Type Errors).
- [ ] إنشاء وثيقة الإثبات المعتمدة بعبارة الاعتماد والمسارات المستهدفة.
- [ ] تشغيل وإقفال `governance.lock.json`، والتحقق التام من اجتياز `pnpm governance:tamper-check`.
