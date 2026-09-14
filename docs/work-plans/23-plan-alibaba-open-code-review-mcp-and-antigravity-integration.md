# 📋 خطة العمل التنفيذية المعتمدة: PLAN-23
## تكامل منظومة Alibaba Open Code Review مع بيئة Antigravity ومشروع السعادة سمارت بوت
### Alibaba Open Code Review (OCR) Native MCP, Antigravity Agent Skill, and Code Quality Remediation

**تاريخ الخطة:** 14-09-2026  
**الحالة:** 🟢 مكتمل وموثق 100% (COMPLETED & VERIFIED)  
**النطاق:** ربط أداة Alibaba Open Code Review عبر بروتوكول MCP، إنشاء مهارة Antigravity المتخصصة، إضافة أوامر package.json، وإصلاح الملاحظات الـ 8 المستخرجة من الفحص الأول.  
**المشروع المستهدف:** `F:\Alsaada-Smart-Bot`  
**الخطط السابقة المرتبطة:** `PLAN-22` (إصلاح الدخول الحصري للداشبورد والجلسات الخادمية)

---

### 1️⃣ الأهداف ونطاق العمل
1. **تكوين خادم MCP العام (`mcp_config.json`):** تسجيل خادم `@opencodereview/mcp-server` في `C:\Users\saleh\.gemini\config\mcp_config.json` لتمكين Antigravity من استدعاء أدوات الفحص المباشر (`ocr_scan`, `ocr_diff`, `ocr_heal`).
2. **إنشاء مهارة مخصصة في Antigravity:** حفظ `.agents/skills/open-code-review/SKILL.md` لتعليم الوكلاء قواعد مراجعة كود السعادة، وضبط معدل التوازي على `--concurrency 2` لتفادي أخطاء 429 Too Many Requests مع Google Gemini Free Tier.
3. **أوامر التشغيل الميسرة:** إضافة `ocr:review`, `ocr:preview`, و `ocr:viewer` في `package.json`.
4. **تنظيف وإصلاح الملاحظات المستخرجة من فحص OCR:**
   - **[bug · high] في `dashboard.handler.ts`:** معالجة احتمال رفض عملاء تليجرام لروابط `http://localtest.me` في الأزرار التفاعلية وإضافة هبوط سلس (Graceful Fallback) يعرض الرابط ككود نصي مع زر النفق.
   - **[maintainability · low] في `dashboard.handler.ts`:** حذف التحقق المكرر `Array.isArray(fetched)`.
   - **[maintainability · low] في `env.ts`:** إزالة الـ `.replace(/\/+$/, '')` الزائد من خاصية `DASHBOARD_LOCAL_URL`.

---

### 2️⃣ سجل التعديلات الميدانية
| الملف | التعديل | الحالة |
| :--- | :--- | :--- |
| `C:\Users\saleh\.gemini\config\mcp_config.json` | تسجيل خادم MCP لـ `open-code-review` | 🟢 منجز |
| `.agents/skills/open-code-review/SKILL.md` | مهارة المراجعة المعمارية وحقن القواعد الحاكمة | 🟢 منجز |
| `package.json` | إضافة أوامر `ocr:review`, `ocr:preview`, `ocr:viewer` | 🟢 منجز |
| `apps/bot-server/src/handlers/dashboard.handler.ts` | هبوط سلس لرفض روابط الزر + تنظيف `Array.isArray` | 🟢 منجز |
| `apps/admin-dashboard/src/lib/env.ts` | تنظيف استدعاء الـ replace الزائد | 🟢 منجز |

---

### 3️⃣ نتائج التحقق والاختبار (Verification)
1. **فحص الـ Typecheck والبناء:** التأكد من خلو المشروع من أي أخطاء تجميع أو أنواع مكسورة.
2. **إعادة تشغيل الفحص الميداني:** تشغيل `pnpm ocr:review` والتحقق من تلاشي الملاحظات السابقة وسرعة الأداء تحت سقف التوازي `--concurrency 2`.
