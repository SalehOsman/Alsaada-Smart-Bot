# 🔐 السجل المرجعي الشامل للوظائف المقفلة والحصانة التشفيرية
## Cryptographic Immutability Lock & Protected Features Master Registry
**منظومة السعادة سمارت بوت — Al-Saada Enterprise Architecture (v2.0.0-alpha.1)**

> **المرجع الدستوري:** البند 1.6 من [`AGENTS.md`](file:///F:/Alsaada-Smart-Bot/AGENTS.md)، البند 1.6 من [`GEMINI.md`](file:///F:/Alsaada-Smart-Bot/GEMINI.md)، ووثيقة خطة العمل السيادية الموحدة [`PLAN-70`](file:///F:/Alsaada-Smart-Bot/docs/work-plans/70-plan-modular-cryptographic-locking-for-core-packages-bot-flows-and-dashboard-suites.md).  
> **ملف القفل التشفيري الحي (SSOT):** [`governance.lock.json`](file:///F:/Alsaada-Smart-Bot/governance.lock.json)  
> **المحرك البرمجي الموحد للقفل والفتح:** `pnpm lock <target>` | `pnpm unlock <target>`  
> **تاريخ آخر قفل وتحديث سيادي:** 18 سبتمبر 2026 (Plan-70 Sealing)  
> **إجمالي الكيانات السيادية المقفلة تشفيرياً:** **58 كياناً مستقلاً (659 ملفاً محمياً)**

---

### 1️⃣ الميثاق الدستوري للحصانة التشفيرية والمحرك الموحد
1. **المحرك البرمجي الموحد للقفل والفتح (Single Unified Sovereign Engine):**
   - تخضع كافة أجزاء المنظومة (حزم النواة، تدفقات البوت، شاشات الداشبورد، البنية التحتية، ومحركات السرعة) لمحرك برمجي مركزي واحد:
     * **للقفل:** `pnpm lock <target>` (يستخدم `tools/governance/unified-lock-engine.ts`).
     * **للفتح:** بروتوكول التحدي والاستجابة المتغير (Work Plan 90): `pnpm unlock:request <target> --reason="..."` ثم موافقة صالح في الشات ثم `pnpm unlock:confirm <target>`.
   - تسجل كافة المكونات المقفلة في قاموس كيانات موحد بملف [`governance.lock.json`](file:///F:/Alsaada-Smart-Bot/governance.lock.json) تحت المفتاح المعياري `lockedEntities: Record<string, LockedEntity>`.
2. **قاعدة العزل الفردي المطلق وحظر الفتح أو الغلق الشامل (Absolute Zero Blast Radius):**
   - يُحظر تماماً فك قفل النظام بأكمله أو فتح حزم أو تدفقات أخرى عند الرغبة في تعديل مكون محدد.
   - عند طلب فك قفل حزمة (مثلاً `package:regional-engine`) أو تدفق (مثلاً `flow:01.1`) أو شاشة (مثلاً `dashboard:workforce/new`)، **يُفتح فقط مجلد ذلك الكيان المحدد بمفرده (1/58)**، وتظل سائر الكيانات الـ 57 الأخرى في المنظومة مقفلة ومحصنة تشفيرياً 100%.
   - أي محاولة من الوكيل أو المطور لتعديل أو لمس أي ملف خارج نطاق الكيان المفكوك تسقط فوراً عند الـ Git Commit بـ `Exit 1` بواسطة فاحص النزاهة الجنائية.
3. **الحصانة المطلقة وصيغ الموافقة الحرفية الصارمة:**
   - **للقفل:** يتطلب موافقة المستخدم الحرفية حصراً: **«نعم اقفل»**.
   - **للفتح:** يتطلب موافقة المستخدم الحرفية حصراً: **«موافق على الفتح»** أو **«نعم موافق على التعديل»**.
   - **لحماية المحرك نفسه:** يتطلب أي تعديل في مجلدات الحوكمة العبارة السيادية العليا: **«موافق على التعديل او الايقاف او الحذف»**.

---

### 2️⃣ جدول حزم النواة المشتركة المقفلة تشفيرياً (`package:*`) — 7 حزم (175 ملفاً)

| معرف الكيان (`id`) | مسمى الحزمة ووظيفتها السيادية | المسار المعتمد | تاريخ القفل | عدد الملفات | وثيقة الإثبات الجنائي |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **`package:core-components`** | **حزمة المكونات المعيارية الشاملة للمنظومة** (أزرار العمال، التاريخ، المبالغ، المقاصات، شاشات التأكيد) | [`packages/core-components`](file:///F:/Alsaada-Smart-Bot/packages/core-components) | `2026-09-18` | 83 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-package_core-components.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-package_core-components.md) |
| **`package:database`** | **نواة قاعدة البيانات المؤسسية والهاش التراكمي ونماذج Prisma** | [`packages/database`](file:///F:/Alsaada-Smart-Bot/packages/database) | `2026-09-18` | 38 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-package_database.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-package_database.md) |
| **`package:telemetry`** | **محرك القياس والاتزان وتتبع أزمنة الاستجابة ومراقبة الأداء** | [`packages/telemetry`](file:///F:/Alsaada-Smart-Bot/packages/telemetry) | `2026-09-18` | 19 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-package_telemetry.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-package_telemetry.md) |
| **`package:rbac`** | **محرك الصلاحيات والتحكم بالأدوار والمصفوفة الأمنية** | [`packages/rbac`](file:///F:/Alsaada-Smart-Bot/packages/rbac) | `2026-09-18` | 12 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-package_rbac.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-package_rbac.md) |
| **`package:regional-engine`** | **محرك التوطين الإقليمي، تطهير الأرقام، العملات، والتوقيت المحلي** | [`packages/regional-engine`](file:///F:/Alsaada-Smart-Bot/packages/regional-engine) | `2026-09-18` | 9 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-package_regional-engine.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-package_regional-engine.md) |
| **`package:national-id-engine`** | **محرك التحقق الجنائي وتفكيك الرقم القومي المصري** | [`packages/national-id-engine`](file:///F:/Alsaada-Smart-Bot/packages/national-id-engine) | `2026-09-18` | 7 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-package_national-id-engine.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-package_national-id-engine.md) |
| **`package:ai-vision-engine`** | **محرك الذكاء الاصطناعي البصري لقراءة ومعالجة الفواتير** | [`packages/ai-vision-engine`](file:///F:/Alsaada-Smart-Bot/packages/ai-vision-engine) | `2026-09-18` | 7 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-package_ai-vision-engine.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-package_ai-vision-engine.md) |

---

### 3️⃣ جدول تدفقات البوت المعيارية المقفلة تشفيرياً (`flow:*`) — 20 تدفقاً (327 ملفاً)

| كود التدفق | مسمى التدفق بالعربية | المسار الموديولي المعتمد | تاريخ القفل | عدد الملفات | وثيقة الإثبات الجنائي |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **`00.1`** | **الملف التعريفي للشركة والهوية المؤسسية** | [`modules/settings/src/flows/00.1-corporate-profile`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.1-corporate-profile) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.1.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.1.md) |
| **`00.2`** | **إدارة مواقع العمل والمشاريع (Sites Hub)** | [`modules/settings/src/flows/00.2-sites-hub`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.2-sites-hub) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.2.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.2.md) |
| **`00.3`** | **مصفوفة المسميات الوظيفية والأدوار (Job Matrix)** | [`modules/settings/src/flows/00.3-job-matrix`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.3-job-matrix) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.3.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.3.md) |
| **`00.4`** | **الملف الشخصي للمشرف والمسؤول (Admin Profile)** | [`modules/settings/src/flows/00.4-admin-profile`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.4-admin-profile) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.4.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.4.md) |
| **`00.5`** | **إدارة وتعيين صلاحيات المشرفين (Admin Assignment)** | [`modules/settings/src/flows/00.5-admin-assignment`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.5-admin-assignment) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.5.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.5.md) |
| **`00.6`** | **محاكاة وتقمص الأدوار للمدير العام (Ghost Mode)** | [`modules/settings/src/flows/00.6-ghost-mode`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.6-ghost-mode) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.6.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.6.md) |
| **`00.7`** | **خزنة التدقيق والحوادث الأمنية (Audit Incident Vault)** | [`modules/settings/src/flows/00.7-audit-incident-vault`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.7-audit-incident-vault) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.7.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.7.md) |
| **`00.8`** | **مرصد الأداء اللحظي والسرعة (APM Telemetry)** | [`modules/settings/src/flows/00.8-apm-telemetry`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.8-apm-telemetry) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.8.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.8.md) |
| **`00.9`** | **إدارة الذاكرة المؤقتة والطوارئ (Emergency Cache)** | [`modules/settings/src/flows/00.9-emergency-cache`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.9-emergency-cache) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.9.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.9.md) |
| **`00.10`** | **سياسات وتفضيلات الإشعارات (Notification Policies)** | [`modules/settings/src/flows/00.10-notification-policies`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.10-notification-policies) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.10.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.10.md) |
| **`00.11`** | **ربط وإدارة مجموعات تليجرام الميدانية (Telegram Groups)** | [`modules/settings/src/flows/00.11-telegram-groups`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.11-telegram-groups) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.11.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.11.md) |
| **`00.12`** | **إدارة صلاحيات ومستخدمي النظام (User RBAC Management)** | [`modules/settings/src/flows/00.12-user-rbac-management`](file:///F:/Alsaada-Smart-Bot/modules/settings/src/flows/00.12-user-rbac-management) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_00.12.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_00.12.md) |
| **`01.1`** | **تسجيل وتعيين عامل جديد (Worker Registration Wizard)** | [`modules/workforce/src/flows/01.1-worker-registration`](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.1-worker-registration) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_01.1.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_01.1.md) |
| **`01.2.D`** | **تعديل بيانات وملف العامل (Worker Edit Wizard)** | [`modules/workforce/src/flows/01.2.D-worker-edit`](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.2.D-worker-edit) | `2026-09-18` | 20 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_01.2.D.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_01.2.D.md) |
| **`01.4`** | **تصدير سجلات وتقارير العمال (Worker Export)** | [`modules/workforce/src/flows/01.4-worker-export`](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.4-worker-export) | `2026-09-18` | 16 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_01.4.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_01.4.md) |
| **`01.5`** | **دليل وبوابة استعلام العمال (Worker Directory)** | [`modules/workforce/src/flows/01.5-worker-directory`](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.5-worker-directory) | `2026-09-18` | 17 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_01.5.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_01.5.md) |
| **`01.6`** | **تعديل العامل لبياناته الذاتية (Worker Self-Edit)** | [`modules/workforce/src/flows/01.6-worker-self-edit`](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.6-worker-self-edit) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_01.6.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_01.6.md) |
| **`01.7`** | **انضمام وربط حساب العامل بتليجرام (Guest Join & Linking)** | [`modules/workforce/src/flows/01.7-guest-join-and-linking`](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.7-guest-join-and-linking) | `2026-09-18` | 15 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_01.7.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_01.7.md) |
| **`01.8`** | **إنهاء خدمة وإخلاء طرف العامل (Worker Offboarding)** | [`modules/workforce/src/flows/01.8-worker-offboarding`](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.8-worker-offboarding) | `2026-09-18` | 22 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_01.8.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_01.8.md) |
| **`01.9`** | **مؤشر التزام وموثوقية العمال (Worker Commitment Index)** | [`modules/workforce/src/flows/01.9-worker-commitment-index`](file:///F:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.9-worker-commitment-index) | `2026-09-18` | 17 ملفاً | [`docs/ai-execution-evidence/2026-09-18-lock-flow_01.9.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-flow_01.9.md) |

---

### 4️⃣ جدول شاشات لوحة التحكم المقفلة تشفيرياً (`dashboard:*`) — 29 شاشة (43 ملفاً)

| معرف الشاشة (`id`) | اسم الشاشة ووظيفتها | مسار الصفحة بالداشبورد | تاريخ القفل | عدد الملفات | وثيقة الإثبات الجنائي |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **`dashboard:overview`** | **نظرة عامة وقمرة القيادة الرئيسية** | `apps/admin-dashboard/src/app/admin` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_overview.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_overview.md) |
| **`dashboard:analytics`** | **تحليلات ومؤشرات الأداء التشغيلي** | `apps/admin-dashboard/src/app/admin/analytics` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_analytics.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_analytics.md) |
| **`dashboard:approvals`** | **صندوق اعتمادات وتصديقات العمليات** | `apps/admin-dashboard/src/app/admin/approvals` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_approvals.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_approvals.md) |
| **`dashboard:finance`** | **البوابة والمركز المالي الرئيسي** | `apps/admin-dashboard/src/app/admin/finance` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_finance.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_finance.md) |
| **`dashboard:finance/treasury`** | **حركة الخزينة والعهد المالية** | `apps/admin-dashboard/src/app/admin/finance/treasury` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_finance_treasury.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_finance_treasury.md) |
| **`dashboard:logistics`** | **بوابة الخدمات اللوجستية والإعاشة** | `apps/admin-dashboard/src/app/admin/logistics` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_logistics.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_logistics.md) |
| **`dashboard:logistics/canteen`** | **مبيعات ومخازن الكانتين الميداني** | `apps/admin-dashboard/src/app/admin/logistics/canteen` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_logistics_canteen.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_logistics_canteen.md) |
| **`dashboard:operations`** | **بوابة العمليات والمعدات الميدانية** | `apps/admin-dashboard/src/app/admin/operations` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_operations.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_operations.md) |
| **`dashboard:operations/equipment`** | **حركة وتشغيل وصيانة المعدات** | `apps/admin-dashboard/src/app/admin/operations/equipment` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_operations_equipment.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_operations_equipment.md) |
| **`dashboard:settings`** | **بوابة الإعدادات والتحكم العامة** | `apps/admin-dashboard/src/app/admin/settings` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings.md) |
| **`dashboard:settings/assignments`** | **تعيينات وصلاحيات المشرفين بالمواقع** | `apps/admin-dashboard/src/app/admin/settings/assignments` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_assignments.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_assignments.md) |
| **`dashboard:settings/audit-vault`** | **خزنة السجلات الجنائية للعمليات** | `apps/admin-dashboard/src/app/admin/settings/audit-vault` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_audit-vault.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_audit-vault.md) |
| **`dashboard:settings/company`** | **بيانات الشركة والملف القانوني** | `apps/admin-dashboard/src/app/admin/settings/company` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_company.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_company.md) |
| **`dashboard:settings/ghost-mode`** | **تقمص الأدوار والمحاكاة الآمنة** | `apps/admin-dashboard/src/app/admin/settings/ghost-mode` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_ghost-mode.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_ghost-mode.md) |
| **`dashboard:settings/jobs`** | **هيكل الوظائف والأدوار المعتمدة** | `apps/admin-dashboard/src/app/admin/settings/jobs` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_jobs.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_jobs.md) |
| **`dashboard:settings/notifications`** | **قنوات وسياسات التنبيهات والإشعارات** | `apps/admin-dashboard/src/app/admin/settings/notifications` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_notifications.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_notifications.md) |
| **`dashboard:settings/preferences`** | **تفضيلات العرض، العملات واللغة** | `apps/admin-dashboard/src/app/admin/settings/preferences` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_preferences.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_preferences.md) |
| **`dashboard:settings/prisma-studio`** | **قمرة استوديو قاعدة البيانات المشفرة** | `apps/admin-dashboard/src/app/admin/settings/prisma-studio` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_prisma-studio.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_prisma-studio.md) |
| **`dashboard:settings/sites`** | **مواقع العمل وتكوين السيرفرات** | `apps/admin-dashboard/src/app/admin/settings/sites` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_sites.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_sites.md) |
| **`dashboard:settings/studio`** | **البوابة الخلفية للاستوديو الداخلي** | `apps/admin-dashboard/src/app/admin/settings/studio` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_studio.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_studio.md) |
| **`dashboard:settings/telemetry`** | **مرصد APM واستجابة السيرفر P50/P95** | `apps/admin-dashboard/src/app/admin/settings/telemetry` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_telemetry.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_telemetry.md) |
| **`dashboard:settings/users`** | **إدارة مستخدمي ومسؤولي النظام** | `apps/admin-dashboard/src/app/admin/settings/users` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_users.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_settings_users.md) |
| **`dashboard:workforce`** | **البوابة الرئيسية لإدارة القوى العاملة** | `apps/admin-dashboard/src/app/admin/workforce` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce.md) |
| **`dashboard:workforce/[id]/edit`** | **شاشة تعديل ملف العامل الكامل** | `apps/admin-dashboard/src/app/admin/workforce/[id]/edit` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce__id__edit.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce__id__edit.md) |
| **`dashboard:workforce/clearances`** | **إخلاء الطرف والتسويات الختامية** | `apps/admin-dashboard/src/app/admin/workforce/clearances` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce_clearances.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce_clearances.md) |
| **`dashboard:workforce/directory`** | **دليل وبطاقات الموظفين والعمال** | `apps/admin-dashboard/src/app/admin/workforce/directory` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce_directory.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce_directory.md) |
| **`dashboard:workforce/evaluations`** | **مؤشر التزام وموثوقية العمال 360°** | `apps/admin-dashboard/src/app/admin/workforce/evaluations` | `2026-09-18` | 4 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce_evaluations.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce_evaluations.md) |
| **`dashboard:workforce/export`** | **تصدير كشوف وملفات العمال إكسيل** | `apps/admin-dashboard/src/app/admin/workforce/export` | `2026-09-18` | 1 ملف | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce_export.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce_export.md) |
| **`dashboard:workforce/new`** | **تسجيل وتعيين عامل جديد بالداشبورد** | `apps/admin-dashboard/src/app/admin/workforce/new` | `2026-09-18` | 2 ملفات | [`docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce_new.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-dashboard_workforce_new.md) |

---

### 5️⃣ جدول البنية التحتية ومحركات السرعة المقفلة (`infra:*`) — وحدتان (11 ملفاً)

| معرف الكيان (`id`) | المكونات والملفات المقفلة | البصمة التشفيرية SHA-256 | تاريخ القفل | الغرض الحاكم | وثيقة الإثبات الجنائي |
| :---: | :--- | :---: | :---: | :--- | :--- |
| **`infra:docker`** | • `.dockerignore`<br>• `docker-compose.yml`<br>• `docker/Dockerfile`<br>• `docker/Dockerfile.dashboard`<br>• `docker/postgres/init-scripts/01-init-security.sql` | بصمات مطابقة 100% (7 ملفات) | `2026-09-18` | منع العبث بالحاويات وقواعد البيانات والأمان الجنائي للبيئة الإنتاجية | [`docs/ai-execution-evidence/2026-09-18-lock-infra_docker.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-infra_docker.md) |
| **`infra:speed-engine`** | • `apps/bot-server/src/services/fast-cache.service.ts`<br>• `apps/bot-server/src/services/telemetry.service.ts`<br>• `apps/bot-server/src/services/screen-flow.service.ts`<br>• `tools/governance/verify-latency-anti-patterns.ts` | بصمات مطابقة 100% (4 ملفات) | `2026-09-18` | ضمان استجابة البوت تحت 50ms وحظر تسريبات الذاكرة ومنع تراجع الأداء | [`docs/ai-execution-evidence/2026-09-18-lock-infra_speed-engine.md`](file:///F:/Alsaada-Smart-Bot/docs/ai-execution-evidence/2026-09-18-lock-infra_speed-engine.md) |

---

### 6️⃣ المسارات السيادية المحمية للحوكمة (`protectedPaths`) — 56 ملفاً

تخضع الملفات والمجلدات التالية للحماية التشفيرية المباشرة ضد أي تعديل عشوائي:
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
- **المجلدات الهندسية ومحركات الحوكمة المحمية:**
  - `tools/governance/` (فواحص الحوكمة، المحرك الموحد `unified-lock-engine.ts` و `unified-unlock-engine.ts`).
  - `.github/workflows/` (خطوط أنابيب التكامل المستمر CI/CD).
  - `tools/scaffold/` (أدوات سطر الأوامر `lock.ts` و `unlock.ts`).
  - `.githooks/` (خطافات الحراسة المسبقة لـ Git).

---

### 7️⃣ أوامر إدارة القفل والفتح المعتمدة (المحرك الموحد)

```bash
# 1. إغلاق وقفل أي كيان بعد موافقة المستخدم «نعم اقفل»:
pnpm lock <target>
# أمثلة:
pnpm lock flow:01.1
pnpm lock package:database
pnpm lock dashboard:workforce/new
pnpm lock infra:docker

# 2. فك قفل كيان منفرد للتعديل وفق بروتوكول التحدي والاستجابة (WP 90):
# أ. طلب رمز التحدي المؤقت:
pnpm unlock:request package:regional-engine --reason="إضافة عملة جديدة"
# ب. توقف الوكيل وطلب اعتماد صالح في الشات بكتابة: «موافق على الفتح UNLOCK-XXXXXX»
# ج. تأكيد فك القفل بعد التحقق الجنائي من سجل الشات:
pnpm unlock:confirm package:regional-engine

# 3. الفحص الجنائي الصارم لسلامة الأقفال ومنع التلاعب:
pnpm governance:tamper-check
```
