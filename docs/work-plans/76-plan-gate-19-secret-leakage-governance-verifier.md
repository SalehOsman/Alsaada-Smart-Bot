# خطة عمل رقم 76: إنشاء بوابة الحوكمة التاسعة عشرة لفحص ومنع تسريب الأسرار (Gate 19: Secret Leakage Gate)
## Work Plan 76: Enterprise Governance Gate 19 - Secret Leakage & Gitleaks Verification

---

### 1️⃣ خلفية وأهداف البوابة (Context & Architecture)
* **الموقع المعماري:** إضافة بوابة حوكمة رسمية جديدة برقم **(19)** داخل مجلد `tools/governance/verify-secret-leakage.ts`.
* **الربط الإلزامي:**
  - إضافة أمر مستقل في `package.json`: `"secrets:verify": "tsx tools/governance/verify-secret-leakage.ts"`.
  - تضمين البوابة ضمن سلسلة بوابات الحوكمة الشاملة `pnpm governance:verify`.
* **مخرجات جلسة المقابلة وتوافق التصميم (/grill-me Alignment):**
  1. **تموضع مستقل:** بوابة حوكمة مستقلة كاملة الصلاحيات (Gate 19) تطبق واجهة `VerificationResult` الرسمية للمنظومة.
  2. **فحص مزدوج ذكي (Dual-Scope Scan):** فحص كامل لسجل المستودع (Commit History) وفحص متزامن للتعديلات غير المثبتة بشجرة العمل (Staged / Working Tree).
  3. **إلزامية الأداة وتوجيه ذكي:** إذا لم تكن أداة `gitleaks` مثبتة، تفشل البوابة فوراً بـ `Exit 1` مع طباعة أمر التثبيت المناسب لنظام التشغيل (`winget` لويندوز، `brew` لماك، `curl/tar` للينكس).
  4. **حجب الأسرار التلقائي (Redaction by Default):** تفعيل خاصية `--redact` تلقائياً لضمان عدم تسريب أي أسرار في مخرجات الكونسول أو سجلات الـ CI.

---

### 2️⃣ ملفات التعديل والتنفيذ (Scope of Implementation)

1. **[NEW] ملف كود البوابة المعمارية:**
   - `tools/governance/verify-secret-leakage.ts`:
     - استيراد محركات الحوكمة الأساسية من `./common.js` (`createResult`, `fail`, `warn`, `printAndExit`, `isCliEntrypoint`).
     - التحقق من وجود `gitleaks` عبر `where.exe` (ويندوز) أو `command -v` (يونكس).
     - تنفيذ فحص الكوميتات وفحص شجرة العمل.
     - استخراج تقرير الحوكمة المنظم.

2. **[MODIFY] تحديث `package.json`:**
   - إضافة السكريبت `"secrets:verify": "tsx tools/governance/verify-secret-leakage.ts"`.
   - إضافة `pnpm secrets:verify` داخل السلسلة الإلزامية لأمر `"governance:verify"`.

3. **[MODIFY] تحديث التوثيق الدستوري:**
   - توثيق البوابة رقم 19 في سجل بوابات الحوكمة الدائم.

---

### 3️⃣ خطة التحقق والاعتماد (Verification Plan)
1. **تشغيل البوابة بشكل منفرد:**
   `pnpm secrets:verify` -> استجابة منسقة `secrets:verify: PASS (Checked: 3)`.
2. **تشغيل اختبارات الوحدة التلقائية للبوابة:**
   `pnpm vitest run tools/governance/tests/verify-secret-leakage.spec.ts` -> اجتياز 11 اختبار وحدة وعقود بنسبة 100%.
3. **فحص الأنواع وتماسك الكود عبر المونوريبو:**
   `pnpm typecheck` -> متطابق تماماً بنسبة 100%.

---

### 4️⃣ مصفوفة الحالة والتسليم (Status & Sign-off)
* **الحالة:** 🟢 مكتمل وموثق 100% (Completed & Verified).
* **التاريخ:** 2026-09-19
* **الملفات المنفذة والمحدثة:**
  - `tools/governance/verify-secret-leakage.ts` (كود البوابة 19 المعمارية مع دعم `options.root` وحارس الـ Entrypoint).
  - `tools/governance/tests/verify-secret-leakage.spec.ts` (11 اختبار وحدة وعقود ومحاكاة حتمية متقدمة).
  - `docs/ai-execution-evidence/2026-09-19-plan-76-gate-19-secret-leakage-verifier.md` (وثيقة إثبات التنفيذ وفق معيار Doc 21).
  - `package.json` (إضافة سكريبت `secrets:verify` ودمجه بسلسلة `governance:verify`).
  - `AGENTS.md` & `GEMINI.md` (تثبيت ميثاق حظر الأسرار وبوابة الحوكمة 19 دستورياً عبر /learn).
  - `docs/work-plans/76-plan-gate-19-secret-leakage-governance-verifier.md` (توثيق خطة العمل ومصفوفة الإغلاق).

