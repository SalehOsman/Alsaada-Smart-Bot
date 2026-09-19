# خطة عمل رقم 78: استئصال أداة context-mode وتطهير القواعد والمهارات وخادم MCP من المنهجية
## Work Plan 78: Decommissioning context-mode MCP, Purging Rules, Skills & Preserving Methodology Hygiene

---

### 1️⃣ خلفية وأهداف الخطة (Context & Baseline Audit)
* قام المستخدم بإلغاء تثبيت حزمة `context-mode` عالمياً من بيئة التشغيل عبر الأمر:
  ```powershell
  npm uninstall -g context-mode
  ```
* وبناءً على ذلك، طلب المستخدم صراحة عبر أمر `/learn` حذف الأداة من المنهجية المعتمدة لمنع استدعاء أدوات غير موجودة وضمان النظافة الشاملة للمنظومة (`Zero Clutter & Zero Dead Code`).
* **الفحص الاستكشافي الميداني لمواضع تواجد الأداة:**
  1. قاعدة السلوك: [`.agents/rules/context-mode.md`](file:///f:/Alsaada-Smart-Bot/.agents/rules/context-mode.md) التي كانت توجه لاستخدام أدوات `ctx_*`.
  2. المهارة المعرفية: [`.agents/skills/context-mode/SKILL.md`](file:///f:/Alsaada-Smart-Bot/.agents/skills/context-mode/SKILL.md) ومجلد المهارة بالكامل.
  3. التكوين العام لخوادم الـ MCP: في [`C:/Users/saleh/.gemini/config/mcp_config.json`](file:///C:/Users/saleh/.gemini/config/mcp_config.json) تحت المفتاح `"context-mode"`.
  4. كاش مخططات أدوات Antigravity: المجلد `C:\Users\saleh\.gemini\antigravity\mcp\context-mode`.
  5. تم التحقق من خلو باقي كود المشروع (`packages/`, `apps/`, `modules/`, `tools/`, `docs/`, `governance.lock.json`) من أي ارتباط بهذه الأداة.

---

### 2️⃣ نطاق التعديلات البرمجية والتكوينية المنفذة (Executed Scope of Changes)

1. **حذف قاعدة السلوك:**
   - تم حذف [`.agents/rules/context-mode.md`](file:///f:/Alsaada-Smart-Bot/.agents/rules/context-mode.md) بنجاح.

2. **حذف المهارة الموجهة:**
   - تم حذف مجلد المهارة [`.agents/skills/context-mode/`](file:///f:/Alsaada-Smart-Bot/.agents/skills/context-mode/) بملف `SKILL.md` بنجاح.

3. **تحديث تكوين MCP العام:**
   - تم حذف خادم `context-mode` من [`C:/Users/saleh/.gemini/config/mcp_config.json`](file:///C:/Users/saleh/.gemini/config/mcp_config.json) مع الحفاظ التام على خادم `open-code-review` والتحقق من صحة صياغة الـ JSON بنسبة 100%.

4. **تطهير كاش أدوات Antigravity:**
   - تم مسح المجلد `C:\Users\saleh\.gemini\antigravity\mcp\context-mode` وتفريغ كاش الأدوات الملغاة.

5. **توثيق المنهجية المعيارية البديلة:**
   - استمرار وتأكيد الاعتماد الحصري على الأدوات القياسية الأصلية في Antigravity:
     * `view_file` لقراءة أسطر محددة بدقة قبل التعديل.
     * `grep_search` للبحث فائق السرعة عبر ripgrep.
     * `find_by_name` للبحث في أسماء الملفات عبر fd.
     * `list_dir` لاستعراض محتويات المجلدات.
     * `run_command` لتشغيل الفحوصات والأوامر.

---

### 3️⃣ خطة التحقق والاعتماد (Verification Plan)
1. فحص مجلد `.agents/` بالكامل والتأكد من خلوه تماماً من أي ملف أو نص يشير إلى `context-mode`.
2. التحقق من سلامة وصحة ملف `mcp_config.json` عبر محلل JSON بنجاح.
3. التأكد من سلامة كاش الأدوات ونظافة بيئة العمل.

---

### 4️⃣ مصفوفة الحالة والتسليم (Status & Sign-off)
* **الحالة:** 🟢 مكتمل وموثق 100% (Completed & Verified).
* **التاريخ:** 2026-09-19
* **نسبة الإنجاز:** 100% لكافة البنود.
