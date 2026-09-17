# خطة العمل 38: المعمارية الموحدة لاستقلالية الوظائف (Bot Flows & Dashboard Features) ونظام القفل التشفيري التام (Cryptographic Immutability Lock)

بناءً على جلسة الاستجواب المعمارية الحصرية (`/grill-me`) وتوجيه المستخدم بتوسيع المنهجية لتشمل **شاشات وميزات لوحة التحكم (Admin Dashboard)** تماماً كما في **تدفقات واجهة البوت (Bot Flows)**، تهدف هذه الخطة إلى وضع الأساسات الهندسية والتنظيمية الموحدة التي تضمن استقلالية كل وظيفة وشاشة داخل المنظومة بنسبة 100%، وحمايتها بقفل تشفيري صارم يمنع أي تعديل عرضي بعد إنجازها.

---

## 🏛️ قرارات التصميم والمعمارية المعتمدة

1. **معمارية الشريحة الرأسية المستقلة (Vertical Slices):**
   - **في البوت:** كل تدفق يقع في مجلد مستقل: `modules/<module>/src/flows/<flow-id>/`، ويصدّر كائن عقد موحد (`FlowPlugin`) يحتوي على مساراته وصلاحياته وتوجيه مدخلاته.
   - **في الداشبورد:** كل شاشة تقع في مجلد شريحة مستقل: `apps/admin-dashboard/src/app/admin/<module>/<feature-id>/` مع مكوناتها الخاصة، ومسار الـ API التابع لها، واختباراتها، وعقد الميزة (`feature.contract.json`).
2. **سجلات التنقل المصرّحة التلقائية (Declarative Manifests):**
   - في البوت: سجل `flows.manifest.ts` للموديول، وتبني قائمة البوت (`Hub Keyboard`) أزرارها وتفلترها حسب الصلاحية آلياً.
   - في الداشبورد: سجل `dashboard.manifest.ts` الموحد، ويقرأ الشريط الجانبي (`Sidebar`) وقائمة الأوامر الشاشات المتاحة ديناميكياً دون تعديل يدوي في ملف الـ Sidebar المكتبي.
3. **موجّه الجلسات الذكي للمدخلات النصية والمرفقات:**
   - حفظ `activeFlowKey` و `currentStep` في جلسة المستخدم بالبوت، وتمرير المدخلات للوظيفة النشطة آلياً دون شلالات شروط مكررة في الملفات المشتركة.
4. **القفل التشفيري الموحد للمنظومة (`governance.lock.json`):**
   - عند إغلاق أي وظيفة بوت أو صفحة داشبورد، تُحسب بصمات تجزئة `SHA-256` لكافة ملفات مجلدها وتُختم في `governance.lock.json` تحت `lockedFlows` أو `lockedDashboardFeatures`.
   - يرفض خطاف `.githooks/pre-commit` وفحص `pnpm governance:verify` أي محاولة لتعديل أي بايت في تلك الملفات نهائياً.
5. **بروتوكول فك القفل المصرح به وعبارة الموافقة الإلزامية:**
   - يمنع منعاً باتاً على أي وكيل ذكاء اصطناعي أو مطور تعديل أي وظيفة مقفلة (في البوت أو الداشبورد) إلا بعد تقديم طلب صريح يوضح السبب وحدود التعديل، والحصول على موافقة المستخدم الحرفية:
     > **«نعم موافق على التعديل»** (دون أي عبارة أخرى).
   - توفير أدوات فك قفل معتمدة (`flow:unlock`, `dashboard:unlock`) مع إعادة القفل التلقائي فور الانتهاء.

---

## 🛠️ تفاصيل التعديلات البرمجية المقترحة (Proposed Changes)

### 1. أدوات الحوكمة والتوليد والقفل (`tools/`)
- `[MODIFY]` [verify-governance-lock.ts](file:///F:/Alsaada-Smart-Bot/tools/governance/verify-governance-lock.ts): دعم التحقق التشفيري لقسمي `lockedFlows` و `lockedDashboardFeatures`.
- `[NEW]` [unlock-feature.ts](file:///F:/Alsaada-Smart-Bot/tools/scaffold/unlock-feature.ts): أداة موحدة لفك قفل وظائف البوت أو شاشات الداشبورد مع التحقق من عبارة الموافقة.
- `[MODIFY]` [finish-flow.ts](file:///F:/Alsaada-Smart-Bot/tools/scaffold/finish-flow.ts): دعم ختم وتشفير ميزات الداشبورد بجانب تدفقات البوت.
- `[NEW]` [finish-dashboard.ts](file:///F:/Alsaada-Smart-Bot/tools/scaffold/finish-dashboard.ts): أداة مخصصة لإنهاء وختم صفحات الداشبورد وفحص شروطها.
- `[MODIFY]` [scaffold-flow.ts](file:///F:/Alsaada-Smart-Bot/tools/scaffold/scaffold-flow.ts): تحديث قوالب البوت لتوليد `FlowPlugin` المعياري وربطه تلقائياً بـ `flows.manifest.ts`.
- `[NEW]` [scaffold-dashboard.ts](file:///F:/Alsaada-Smart-Bot/tools/scaffold/scaffold-dashboard.ts): أداة توليد شاشات الداشبورد الجديدة وربطها تلقائياً بـ `dashboard.manifest.ts`.
- `[MODIFY]` [.githooks/pre-commit](file:///F:/Alsaada-Smart-Bot/.githooks/pre-commit): منع تعديل أي ملف في تدفقات البوت المقفولة أو شاشات الداشبورد المقفولة دون ترخيص.
- `[MODIFY]` [package.json](file:///F:/Alsaada-Smart-Bot/package.json): إضافة أوامر `pnpm flow:unlock`، `pnpm dashboard:unlock`، `pnpm make:dashboard-feature`.

---

### 2. ميثاق ومنهجية الحوكمة (`AGENTS.md` & `GEMINI.md`)
- `[MODIFY]` [AGENTS.md](file:///F:/Alsaada-Smart-Bot/AGENTS.md): توثيق معمارية الشريحة الرأسية للبوت والداشبورد، القفل التشفيري التام، والقاعدة الدستورية الصارمة للموافقة بعبارة: **«نعم موافق على التعديل»**.
- `[MODIFY]` [GEMINI.md](file:///F:/Alsaada-Smart-Bot/GEMINI.md): المزامنة الحرفية مع `AGENTS.md`.

---

### 3. التطبيق المعماري على البوت القائم (`modules/workforce`)
- `[NEW]` `modules/workforce/src/flows.manifest.ts`: تجميع تدفقات الموديول في مصفوفة موحدة.
- `[MODIFY]` `modules/workforce/src/module.routes.ts`: تحويله إلى راوتر ديناميكي نظيف يعتمد على الـ Plugins وموجّه الجلسات الذكي.
- `[MODIFY]` `modules/workforce/src/hub/hub.keyboards.ts`: توليد أزرار القائمة تلقائياً من بيانات العقد.

---

### 4. التطبيق المعماري على الداشبورد (`apps/admin-dashboard`)
- `[NEW]` `apps/admin-dashboard/src/dashboard.manifest.ts`: السجل المصرّح لكافة ميزات وشاشات الداشبورد المصنفة موديولياً.
- `[MODIFY]` `apps/admin-dashboard/src/lib/rbac.ts`: استخراج عناصر التنقل ديناميكياً من `dashboard.manifest.ts` بدلاً من كتابتها يدوياً.
- `[MODIFY]` `apps/admin-dashboard/src/components/layout/sidebar.tsx`: تنظيف الـ Sidebar وربطه بالسجل المصرّح التلقائي.

---

## 🧪 خطة الاختبار والتحقق (Verification Plan)

1. **التحقق من أدوات الحوكمة:**
   - فحص تشفير وظيفة بوت مقفولة وشاشة داشبورد مقفولة في `governance.lock.json`.
   - محاكاة تعديل بايت واحد في صفحة داشبورد مقفولة أو تدفق بوت مقفول، والتأكد من رفض الـ Git Hook للـ Commit فوراً بـ `Exit 1`.
   - اختبار فك القفل المصرح به بـ `pnpm dashboard:unlock` و `pnpm flow:unlock` مع توثيق السبب، والتأكد من قبول الـ Commit.
   - إعادة الختم والتأكد من تحديث بصمات التجزئة `SHA-256`.
2. **التحقق من سلامة البوت والداشبورد:**
   - تشغيل اختبارات workforce: `pnpm vitest run modules/workforce`.
   - تشغيل اختبارات الداشبورد: `pnpm --filter @alsaada/admin-dashboard test`.
   - فحص بناء المشروع بالكامل: `pnpm build`.
