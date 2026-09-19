# خطة عمل رقم 77: دمج محرك الفحص الأمني Semgrep وبناء بوابة الحوكمة العشرون (Gate 20: SAST Code Security Gate)
## Work Plan 77: Enterprise Governance Gate 20 - Semgrep SAST & Code Security Verifier

---

### 1️⃣ خلفية وأهداف الخطة (Context & Baseline Audit)
* **نتائج الفحص الاستكشافي الأولي (Semgrep Baseline Scan):**
  - تم فحص **957 ملفاً** عبر المونوريبو بنجاح وتحليل ~99.9% من أسطر الكود.
  - تم استخدام حزم القواعد القياسية العالمية:
    - `p/typescript` (أمان لغة TypeScript ومنع حقن المدخلات وثغرات المسارات).
    - `p/owasp-top-ten` (أخطر 10 ثغرات أمنية في تطبيقات الويب والـ APIs).
    - `p/nodejs` (أمان بيئة تشغيل Node.js و crypto).
  - **المخرجات الأمنية المكتشفة (11 ملاحظة دقيقة):**
    1. **تحسين تشفيري حقيقي وعالي القيمة في `cipher.ts`:**
       رصد Semgrep أن دالة فك التشفير `crypto.createDecipheriv` في خوارزمية `aes-256-gcm` تفتقر لتحديد طول وسم المصادقة الصريح `{ authTagLength: 16 }`، مما قد يتيح نظرياً للمهاجم التلاعب بطول الوسم (GCM tag truncation vulnerability).
    2. **توصيات حماية سلاسل التوريد في `pnpm-workspace.yaml`:**
       توصية بتفعيل إعدادات pnpm v10 الحديثة لمنع التبعيات الفرعية المشبوهة (`blockExoticSubdeps: true`).
    3. **تثبيت تجزئات SHA لإجراءات GitHub Actions في الـ Workflows:**
       توصية بتثبيت أرقام الـ Commit SHAs بدلاً من الـ Tags المتحركة (`@v4`).

---

### 2️⃣ نطاق التعديلات المعمارية والبرمجية (Scope of Changes)

1. **ملف تكوين واستثناءات Semgrep ([`.semgrepignore`](file:///f:/Alsaada-Smart-Bot/.semgrepignore)):**
   - استثناء ملفات البناء المؤقتة (`.next/`, `dist/`, `.turbo/`, `node_modules/`).
   - استثناء الملفات المولدة من Prisma (`packages/database/src/generated/`).
   - استثناء ملفات القفل التشفيري (`governance.lock.json`, `pnpm-lock.yaml`).

2. **بوابة الحوكمة العشرون ([`tools/governance/verify-code-security.ts`](file:///f:/Alsaada-Smart-Bot/tools/governance/verify-code-security.ts)):**
   - تطبيق معيار `VerificationResult` الرسمي.
   - التحقق من توفر أداة `semgrep` على نظام التشغيل، وإصدار أمر التثبيت المناسب (`pip install semgrep`) في حال عدم وجودها.
   - تشغيل الفحص على حزم القواعد الأمنية المعتمدة (`p/typescript`, `p/owasp-top-ten`, `p/nodejs`).
   - حصر ومعالجة الثغرات بدرجة `ERROR` وتوليد تقرير الحوكمة المنظم.

3. **جناح الاختبارات المعمارية للـ Gate 20:**
   - إنشاء [`tools/governance/tests/verify-code-security.spec.ts`](file:///f:/Alsaada-Smart-Bot/tools/governance/tests/verify-code-security.spec.ts) لاختبار كافة حالات الفحص والـ Mocking والأخطاء.

4. **تحديث سكريبتات المونوريبو في [`package.json`](file:///f:/Alsaada-Smart-Bot/package.json):**
   - إضافة السكريبت المستقل: `"sast:verify": "tsx tools/governance/verify-code-security.ts"`.
   - إضافة أمر الفحص السريع: `"security:semgrep": "semgrep scan --config auto"`.
   - إدراج `pnpm sast:verify` ضمن السلسلة الإلزامية لأمر `"governance:verify"` (ليصبح إجمالي البوابات 20 بوابة حوكمة).

5. **التحصين التشفيري لكود `cipher.ts`:**
   - تحديث `packages/database/src/crypto/cipher.ts` لضبط `{ authTagLength: 16 }` صراحة، بما يغلق ملاحظة Semgrep ويرفع أمان التشفير إلى الدرجة القصوى.

---

### 3️⃣ خطة التحقق والاعتماد (Verification Plan)
1. تشغيل الفحص المستقل للبوابة: `pnpm sast:verify` للتأكد من خروج الفاحص بنتيجة `PASS`.
2. تشغيل جناح الاختبارات: `pnpm vitest run tools/governance/tests/verify-code-security.spec.ts`.
3. تشغيل فحص الحوكمة الشامل: `pnpm governance:verify`.

---

### 4️⃣ مصفوفة الحالة والتسليم (Status & Sign-off)
* **الحالة:** 🟢 مكتمل وموثق 100% (Completed & Verified).
* **التاريخ:** 2026-09-19
* **الملفات المنفذة والمحدثة:**
  - `.semgrepignore` (استثناء الملفات المؤقتة والمولدة والمقفلة تشفيرياً).
  - `packages/database/src/crypto/cipher.ts` (تحصين خوارزمية فك التشفير GCM بطول وسم المصادقة الصريح `{ authTagLength: 16 }`).
  - `tools/governance/verify-code-security.ts` (كود بوابة الحوكمة العشرون SAST Code Security Verifier).
  - `tools/governance/tests/verify-code-security.spec.ts` (12 اختبار وحدة وعقود تفصيلية تغطي كافة الفروع).
  - `package.json` (إضافة سكريبتات `sast:verify` و `security:semgrep` ودمجها بسلسلة `governance:verify`).
  - `docs/ai-execution-evidence/2026-09-19-plan-77-gate-20-sast-semgrep-verifier.md` (وثيقة إثبات التنفيذ الحتمي).
  - `docs/work-plans/77-plan-gate-20-sast-semgrep-code-security-verifier.md` (تحديث خطة العمل ومصفوفة التسليم).
