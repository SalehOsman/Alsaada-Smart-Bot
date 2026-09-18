---
title: "🔐 السجل المرجعي الشامل للوظائف المقفلة والحصانة التشفيرية"
description: "المرجع الدستوري: البند 1.6 من AGENTS.md، البند 1.6 من GEMINI.md، ووثيقة خطة العمل PLAN-38."
sidebar:
  order: 9
---

# 🔐 السجل المرجعي الشامل للوظائف المقفلة والحصانة التشفيرية
## Cryptographic Immutability Lock & Protected Features Master Registry
**منظومة السعادة سمارت بوت — Al-Saada Enterprise Architecture (v2.0.0-alpha.1)**

> **المرجع الدستوري:** البند 1.6 من [`AGENTS.md`](/foundations/14-ai-agent-governance-and-file-rules/)، البند 1.6 من [`GEMINI.md`](/foundations/14-ai-agent-governance-and-file-rules/)، ووثيقة خطة العمل [`PLAN-38`](https://github.com/SalehOsman/Alsaada-Smart-Bot/blob/main/docs/work-plans/38-plan-flow-plugin-architecture-and-cryptographic-immutability-lock.md).  
> **ملف القفل التشفيري الحي (SSOT):** [`governance.lock.json`](/financial-and-governance/26-locked-flows-and-features-registry/)  
> **تاريخ آخر قفل وتحديث:** 17 سبتمبر 2026

---

### 1️⃣ الميثاق الدستوري للحصانة التشفيرية وقفل الوظائف
1. **مبدأ الحصانة المطلقة بعد الإنجاز (Strict Immutability):**
   - فور الانتهاء من بناء أي وظيفة أو شريحة رأسية أو شاشة لوحة تحكم واجتيازها لاختبارات الـ Zero-Regression بنسبة 100%، والحصول على موافقة المستخدم الحرفية **«نعم اقفل»**، يتم تشفير كافة ملفات الوظيفة واستخراج بصمة تجزئة جنائية `SHA-256` لكل ملف وتثبيتها في [`governance.lock.json`](/financial-and-governance/26-locked-flows-and-features-registry/).
2. **الحظر المعماري التلقائي (Anti-Tamper Hardening):**
   - أي محاولة لتعديل أو حذف أو إضافة أي حرف أو ملف داخل المجلد المقفل دون ترخيص صريح تؤدي إلى فشل فاحص الحوكمة `pnpm governance:tamper-check` فورياً بالخطأ:  
     `Cryptographic integrity violated (modified/tampered)`.
3. **بروتوكول فك القفل الإلزامي (Unlocking Protocol):**
   - يُحظر تماماً على أي وكيل ذكاء اصطناعي (AI Agent) أو مطور فتح أو تعديل أي ملف في المجلد المقفل قبل تقديم طلب رسمي والحصول على موافقة المستخدم الحرفية حصراً:  
     **«موافق على الفتح»** أو **«نعم موافق على التعديل»**.

---

### 2️⃣ جدول تدفقات البوت المقفلة تشفيرياً (`lockedFlows`)

| كود التدفق | مسمى التدفق بالعربية | المسار الموديولي المعتمد | تاريخ القفل والاعتماد | عدد الملفات المقفلة | ملف الإثبات الجنائي |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **`00.6`** | **محاكاة وتقمص الأدوار للمدير العام (Ghost Mode)** | [`modules/settings/src/flows/00.6-ghost-mode`](https://github.com/SalehOsman/Alsaada-Smart-Bot/blob/main/modules/settings/src/flows/00.6-ghost-mode) | `2026-09-17` | 15 ملفاً | [`2026-09-17-flow-00.6-closure.md`](https://github.com/SalehOsman/Alsaada-Smart-Bot/blob/main/docs/ai-execution-evidence/2026-09-17-flow-00.6-closure.md) |
| **`01.1`** | **تسجيل وتعيين عامل / موظف جديد (Worker Registration Wizard)** | [`modules/workforce/src/flows/01.1-worker-registration`](https://github.com/SalehOsman/Alsaada-Smart-Bot/blob/main/modules/workforce/src/flows/01.1-worker-registration) | `2026-09-17` | 15 ملفاً | [`2026-09-17-flow-01.1-closure.md`](https://github.com/SalehOsman/Alsaada-Smart-Bot/blob/main/docs/ai-execution-evidence/2026-09-17-flow-01.1-closure.md) |
| **`01.9`** | **مؤشر التزام وموثوقية العمال (Worker Commitment Index)** | [`modules/workforce/src/flows/01.9-worker-commitment-index`](https://github.com/SalehOsman/Alsaada-Smart-Bot/blob/main/modules/workforce/src/flows/01.9-worker-commitment-index) | `2026-09-17` | 17 ملفاً | [`2026-09-17-flow-01.9-closure.md`](https://github.com/SalehOsman/Alsaada-Smart-Bot/blob/main/docs/ai-execution-evidence/2026-09-17-flow-01.9-closure.md) |

---

### 3️⃣ جدول شاشات لوحة التحكم (الداشبورد) المقفلة تشفيرياً (`lockedDashboardFeatures`)

| معرف الشاشة | اسم الشاشة ووظيفتها | مسار الصفحة بالداشبورد | تاريخ القفل | عدد الملفات | ملف الإثبات الجنائي |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **`settings/preferences`** | **مركز تفضيلات لوحة التحكم (الوضع الليلي، التوقيت، الأرقام)** | [`apps/admin-dashboard/src/app/admin/settings/preferences`](https://github.com/SalehOsman/Alsaada-Smart-Bot/tree/main/apps/admin-dashboard/src/app/admin/settings/preferences) | `2026-09-16` | 1 ملف (`page.tsx`) | [`2026-09-16-dashboard-settings_preferences-closure.md`](https://github.com/SalehOsman/Alsaada-Smart-Bot/blob/main/docs/ai-execution-evidence/2026-09-16-dashboard-settings_preferences-closure.md) |
| **`workforce/evaluations`** | **⭐ مؤشر التزام وموثوقية العمال** | [`apps/admin-dashboard/src/app/admin/workforce/evaluations`](https://github.com/SalehOsman/Alsaada-Smart-Bot/tree/main/apps/admin-dashboard/src/app/admin/workforce/evaluations) | `2026-09-17` | 4 ملفات | [`2026-09-17-dashboard-workforce_evaluations-closure.md`](https://github.com/SalehOsman/Alsaada-Smart-Bot/blob/main/docs/ai-execution-evidence/2026-09-17-dashboard-workforce_evaluations-closure.md) |
| **`analytics`** | **تحليلات ومؤشرات الأداء التشغيلي وقوائم التصفية** | [`apps/admin-dashboard/src/app/admin/analytics`](https://github.com/SalehOsman/Alsaada-Smart-Bot/tree/main/apps/admin-dashboard/src/app/admin/analytics) | `2026-09-17` | 2 ملفات | [`2026-09-17-dashboard-analytics-closure.md`](https://github.com/SalehOsman/Alsaada-Smart-Bot/blob/main/docs/ai-execution-evidence/2026-09-17-dashboard-analytics-closure.md) |

---

### 4️⃣ جدول محركات السرعة الفائقة والبنية التحتية المقفلة (`lockedSpeedEngine` & `lockedDocker`)

| القسم / المحرك | المكونات والملفات المقفلة | البصمة التشفيرية SHA-256 | تاريخ القفل | الغرض الحاكم |
| :--- | :--- | :--- | :---: | :--- |
| **محرك السرعة المؤسسي الدائم (`speed-engine`)** | • `apps/bot-server/src/services/fast-cache.service.ts`<br>• `apps/bot-server/src/services/telemetry.service.ts`<br>• `apps/bot-server/src/services/screen-flow.service.ts`<br>• `tools/governance/verify-latency-anti-patterns.ts` | بصمات مطابقة بنسبة 100% | `2026-09-16` | منع تراجع سرعة البوت، وحظر تسريبات الذاكرة، وضمان استجابة البوت تحت 50ms. |
| **البنية التحتية وحاويات دوكر (`docker`)** | • `.dockerignore`<br>• `docker-compose.yml`<br>• `docker/Dockerfile`<br>• `docker/Dockerfile.dashboard`<br>• `docker/postgres/init-scripts/01-init-security.sql` | بصمات مطابقة بنسبة 100% | `2026-09-16` | منع العبث بإعدادات الحاويات وقواعد البيانات والأمان الجنائي للبيئة الإنتاجية. |

---

### 5️⃣ المسارات السيادية المحمية للحوكمة (`protectedPaths`)

تخضع الملفات والمجلدات التالية للحماية التشفيرية المباشرة ضد التعديل العشوائي:
- **الملفات الدستورية والمعمارية:**
  - `AGENTS.md`
  - `GEMINI.md`
  - `package.json`
  - `pnpm-workspace.yaml`
  - `.gitignore`
  - `docs/14-ai-agent-governance-and-file-rules.md`
  - `docs/15-universal-module-and-flow-standard.md`
  - `docs/21-mandatory-module-architecture-and-gates.md`
  - `docs/ai-execution-evidence/README.md`
- **المجلدات الهندسية المحمية:**
  - `tools/governance/` (كافة فواحص الحوكمة والتحقق المعماري).
  - `.github/workflows/` (خطوط أنابيب التكامل المستمر CI/CD).
  - `tools/scaffold/` (أدوات التوليد والقفل والفتح).
  - `.githooks/` (خطافات الحراسة المسبقة لـ Git).

---

### 6️⃣ أوامر إدارة القفل والفتح المعتمدة


```bash
# 1. إغلاق وقفل تدفق بعد موافقة المستخدم «نعم اقفل»:
pnpm flow:finish <flow-code>

# 2. فك قفل تدفق للتعديل بعد موافقة المستخدم «موافق على الفتح»:
pnpm flow:unlock <flow-code>

# 3. إغلاق وقفل شاشة داشبورد:
pnpm dashboard:finish <feature-id>

# 4. فك قفل شاشة داشبورد للتعديل:
pnpm dashboard:unlock <feature-id>

# 5. الفحص الجنائي لسلامة الأقفال ومنع التلاعب:
pnpm governance:tamper-check
```

