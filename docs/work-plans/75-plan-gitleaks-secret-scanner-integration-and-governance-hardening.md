# خطة عمل رقم 75: دمج وتفعيل صمام الأمان Gitleaks لحماية الأسرار وتأمين الحوكمة
## Work Plan 75: Gitleaks Secret Scanner Integration & Enterprise Governance Hardening

---

### 1️⃣ خلفية وأهداف الخطة (Context & Objectives)
* **الهدف الرئيسي:** تأمين مشروع **Al-Saada Smart Bot** ضد تسريب أي أسرار، مفاتيح API، توكنات تليجرام (`BOT_TOKEN`)، بيانات قواعد البيانات (`DATABASE_URL`)، أو مفاتيح تشفير الجلسات، سواء محلياً على جهاز المطور أو آلياً في بيئة الـ CI/CD.
* **نتائج الفحص الاستكشافي الأولي (Baseline Audit):**
  - تم فحص 121 كومت سابق عبر `gitleaks detect`.
  - كشف الفحص عن 15 نتيجة، وبعد التدقيق الجنائي تبين أنها **إيجابيات كاذبة 100% (False Positives)** في ملفات النماذج والاختبارات:
    1. نموذج الإعدادات `.env.example` (مفتاح وهمي للتوضيح).
    2. ملفات اختبارات الاختراق والمحاكاة (`**/tests/**/*.spec.ts`) التي تحوي توكنات وهمية لاختبار صمامات الحجب والـ RBAC.
    3. ملف اختبار إخفاء البيانات `packages/telemetry/tests/redaction.spec.ts` (مفتاح خاص تجريبي للتحقق من قدرة الـ Logger على تشفيره).
  - المستودع خالٍ تماماً من أي تسريب حقيقي للأسرار.

---

### 2️⃣ نطاق التعديلات البرمجية (Scope of Changes)

1. **ملف التكوين المعياري للمشروع (`.gitleaks.toml`):**
   - اعتماد القواعد الافتراضية الرسمية لـ Gitleaks.
   - ضبط قائمة الاستثناءات الدقيقة (`[allowlist]`):
     - استثناء ملفات الاختبارات (`**/tests/**`, `**/*.spec.ts`).
     - استثناء `.env.example`.
     - استثناء السلسلة النمطية للمفاتيح التجريبية (`0123456789abcdef...`).
     - استثناء ملفات القفل والبناء (`governance.lock.json`, `pnpm-lock.yaml`, `dist/**`, `.next/**`).

2. **تحديث صمام الـ Pre-Commit (`.githooks/`):**
   - تحديث `.githooks/pre-commit` (النسخة المتوافقة مع Linux/macOS/Git Bash).
   - تحديث `.githooks/pre-commit.cmd` (النسخة المتوافقة مع Windows cmd/powershell).
   - تنفيذ فحص `gitleaks protect --staged --verbose` قبل إتمام أي كوميت، ورفض العملية فورياً إذا تم رصد أي مفتاح سري في الملفات المجهزة.

3. **تحديث خط أنابيب التكامل المستمر (`.github/workflows/ci.yml`):**
   - إضافة خطوة فحص `gitleaks/gitleaks-action@v2` لضمان الفحص التلقائي الإلزامي لكافة الكوميتات والفروع والـ Pull Requests.

4. **تحديث أوامر الـ Monorepo في `package.json`:**
   - إضافة السكريبتات المعيارية:
     - `"security:gitleaks": "gitleaks detect --verbose"`
     - `"security:gitleaks:staged": "gitleaks protect --staged --verbose"`

---

### 3️⃣ خطة التحقق والاعتماد (Verification Plan)

1. **التحقق من ملف التكوين (Baseline Clean Pass):**
   - تشغيل `gitleaks detect --verbose` والتأكد من خروج الفحص بنتيجة `0 leaks found` بنجاح تام.
2. **التحقق من صمام الـ Pre-Commit (Staged Protection Guard):**
   - تشغيل `gitleaks protect --staged --verbose`.
3. **التحقق من تكامل بوابات الحوكمة:**
   - تشغيل `pnpm governance:verify` للتأكد من عدم تأثر أي من البوابات الـ 18 الأخرى.
   - تشغيل `pnpm typecheck` واختبارات النظام.

---

### 4️⃣ مصفوفة الحالة والتسليم (Status & Sign-off)
* **الحالة:** 🟡 قيد المناقشة والاعتماد (Draft - Awaiting Approval).
* **التاريخ:** 2026-09-19
