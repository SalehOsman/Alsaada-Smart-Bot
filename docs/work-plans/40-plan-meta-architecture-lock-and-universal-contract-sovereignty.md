# خطة العمل 40: قفل المعمارية ذاتها تشفيرياً والسيادة المطلقة للعقود المشتركة (Meta-Architecture Lock & Universal Contract Sovereignty)

بناءً على جلسة الاستجواب المعمارية الحصرية (`/grill-me`) وطلب المستخدم الصريح بتأمين المعمارية ذاتها بحيث يستحيل على أي مبرمج أو وكيل ذكاء اصطناعي الخروج عنها أو تعديلها مع بناء الوظائف والموديولات الجديدة، تهدف هذه الخطة إلى ترسيخ المعمارية كقانون تشفيري سيادي ومغلق تماماً.

---

## 🏛️ قرارات التصميم والمعمارية المعتمدة

1. **مرجعية العقود السيادية في النواة المشتركة (`@alsaada/core-components`):**
   - نقل كافة الواجهات المعمارية الموحدة (`FlowPlugin`, `FlowContractMetadata`, `DashboardFeature`, `DashboardSectionManifest`) إلى حزمة النواة المشتركة.
   - إلزام كافة الموديولات وتطبيقات الداشبورد باستيراد هذه العقود حصراً، ومنع أي تعريف محلي أو موازٍ للواجهات.

2. **قفل أدوات البناء والخطافات تشفيرياً (`Meta-Tooling Lock`):**
   - إدراج مجلد أدوات التوليد والإغلاق `tools/scaffold` بالكامل ضمن `protectedPaths.directories` في `governance.lock.json`.
   - إدراج مجلد خطافات Git الحارسة `.githooks` بالكامل ضمن `protectedPaths.directories` في `governance.lock.json`.
   - يمنع ذلك أي تعديل أو تخفيف لقيود التوليد أو فحص الـ Commit دون وثيقة تفويض معتمدة.

3. **بوابة الرقابة والتفتيش المعماري الحازمة (Gate G1 - `pnpm arch:verify`):**
   - فحص أن كل وظيفة في كل موديول وكل شاشة في الداشبورد تنفذ العقد السيادي المستورد من النواة بدقة.
   - فحص سقف الأسطر (< 350 سطراً) والخلو التام من `any` غير المبرر.
   - رفض أي محاولة لبناء وظائف خارج هذا النمط القياسي بـ `Exit 1`.

---

## 🛠️ تفاصيل التعديلات البرمجية المقترحة

### 1. النواة المشتركة (`packages/core-components`)
- `[NEW]` [packages/core-components/src/contracts/flow.contract.ts](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/contracts/flow.contract.ts): تعريف عقود التدفقات السيادية.
- `[NEW]` [packages/core-components/src/contracts/dashboard.contract.ts](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/contracts/dashboard.contract.ts): تعريف عقود الداشبورد السيادية.
- `[MODIFY]` [packages/core-components/src/index.ts](file:///F:/Alsaada-Smart-Bot/packages/core-components/src/index.ts): تصدير العقود المعمارية.

### 2. موديول القوى العاملة والداشبورد
- `[MODIFY]` [modules/workforce/src/flows.manifest.ts](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows.manifest.ts): استيراد العقود المعمارية من `@alsaada/core-components`.
- `[MODIFY]` [apps/admin-dashboard/src/dashboard.manifest.ts](file:///F:/Alsaada-Smart-Bot/apps/admin-dashboard/src/dashboard.manifest.ts): استيراد العقود المعمارية من `@alsaada/core-components`.

### 3. أدوات الحوكمة والقفل التشفيري (`tools/`)
- `[MODIFY]` [tools/governance/verify-governance-lock.ts](file:///F:/Alsaada-Smart-Bot/tools/governance/verify-governance-lock.ts): إضافة `tools/scaffold` و `.githooks` للمجلدات المحمية تشفيرياً.
- `[MODIFY]` [tools/governance/verify-architecture.ts](file:///F:/Alsaada-Smart-Bot/tools/governance/verify-architecture.ts): فحص مطابقة كافة التدفقات لعقود النواة المشتركة.
- `[MODIFY]` [governance.lock.json](file:///F:/Alsaada-Smart-Bot/governance.lock.json): تشفير وإعادة قفل الأدوات والخطافات والعقود.

### 4. ميثاق الحوكمة (`AGENTS.md` & `GEMINI.md`)
- `[MODIFY]` [AGENTS.md](file:///F:/Alsaada-Smart-Bot/AGENTS.md): توثيق سيادة وقفل المعمارية ذاتها تشفيرياً ومنع الخروج عنها.
- `[MODIFY]` [GEMINI.md](file:///F:/Alsaada-Smart-Bot/GEMINI.md): المزامنة الحرفية مع `AGENTS.md`.

---

## 🧪 خطة الاختبار والتحقق

1. **التحقق من مناعة أدوات المعمارية:**
   - فحص كشف أي تعديل على `tools/scaffold` أو `.githooks` وفشل الفحص بـ `Exit 1`.
2. **التحقق من مطابقة المعمارية:**
   - تشغيل `pnpm arch:verify` والتأكد من مطابقة 100% لكافة التدفقات والشاشات.
3. **اختبارات النظام الشاملة:**
   - تشغيل `pnpm test` وبناء المنظومة بالكامل `pnpm build`.
