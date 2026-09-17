# خطة عمل 47: التحول الشامل للمظهر الليلي والنهاري بكافة شاشات ومكونات الداشبورد
## Plan 47: Comprehensive Dashboard Dark & Light Theme Transformation (Surfaces, Cards, Tables & Components)

---

### 📌 بيانات الوثيقة والاعتماد
- **رقم الخطة:** `PLAN-47`
- **التاريخ:** 2026-09-16
- **الموديول المستهدف:** `apps/admin-dashboard`
- **الحالة:** 🟢 مكتمل ومختبر وموثق 100% (Completed, Verified & Tested)
- **الدافع التقني:** المستخدم لاحظ أن الوضع الليلي حالياً يقتصر على الهيدر والقائمة الجانبية فقط بينما يبقى متن الداشبورد، وبطاقات المؤشرات (KPIs)، والجداول، والمودالات باللون الأبيض الساطع. المطلوب تحويل كامل الداشبورد ليتغير جذرياً وبشكل احترافي فائق التناسق بين الوضع الليلي والنهاري.

---

### 1️⃣ الأهداف المعمارية والهندسية (Architectural & UX Objectives)

1. **التحول الشامل للهيكل الرئيسي للداشبورد (`DashboardShell`):**
   - استبدال خلفية الشاشة الصلبة الثابتة (`bg-slate-50`) بنظام ديناميكي: `bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100`.
   - تحصين شريط التمرير (Scrollbars) ليتناسب مع النمط المظلم بدرجات Slate نقية بدون تشويه بصري.

2. **التحول الجذري لشاشات النظرة العامة الرئيسية الثلاث (`Role Overviews`):**
   - **سوبر أدمن (`SuperAdminOverview`):** تحويل بطاقات المؤشرات الـ 4، مركز الأوامر والتحكم السيادي، شبكة المواقع الميدانية، وجداول العمليات السريعة لتدعم:
     - أسطح البطاقات: `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800`.
     - النصوص والعناوين: `text-slate-900 dark:text-slate-100` و `text-slate-500 dark:text-slate-400`.
     - شارات وخلفيات الأيقونات: استخدام خلفيات داكنة شفافة متناغمة (مثل `dark:bg-blue-950/50 dark:text-blue-400`).
   - **الإدارة العامة (`GeneralAdminOverview`):** تحويل بطاقات المؤشرات الأربعة ومركز الإجراءات الإدارية.
   - **المشرف الميداني (`FieldAdminOverview`):** تحويل بطاقات الموقع الميداني، وقوائم العمالة الحاضرة، وسجلات الصرف.

3. **تحويل المكونات المشتركة ومودال البحث السريع (`Shared Components & Modals`):**
   - **مودال الأوامر والبحث السريع (`CommandPalette`):** نافذة البحث، حقول الإدخال، عناصر النتائج، وأزرار الاختصار السريع (ESC).
   - **جداول البيانات المشتركة (`DataTable`):** شريط البحث، رؤوس الجداول (`thead`)، الصفوف وتأثيرات التحويم (`hover`)، وشريط الترقيم السفلي (`pagination`).
   - **بطاقة الحالة الصفرية (`ZeroStateCard`):** تناسق تام مع الأنماط الداكنة للنصوص والأيقونات.

4. **تحديث وتنسيق الشاشات التشغيلية والمراكز الحيوية (Hubs & Clients):**
   - **دليل وسجل العاملين (`WorkforceDirectoryClient`):** شريط أدوات الفلترة والبحث، القوائم المنسدلة (`select`)، بطاقات الموبايل، والجدول العريض.
   - **المركز المالي وإدارة الخزينة (`FinanceHubPage` & `TreasuryClient`):** بطاقات الأرصدة، تنبيهات السيولة، وسجلات الخزينة.
   - **المرافق اللوجستية والعمليات والاعتمادات (`ApprovalsClient`, `Operations`, `Logistics`, `Analytics`):** شاشات طلبات السلف والمخالصات والتقارير.
   - **مراكز الإعدادات المتخصصة (`settings/audit-vault`, `settings/company`, `settings/users`, `settings/sites`, `settings/jobs`).

5. **التعزيز الشامل لملف الأنماط العالمي (`globals.css`):**
   - تحديث متغيرات الألوان لـ `.dark` وتطبيق أنماط عامة للـ inputs و selects والجداول والـ borders بحيث تكتسب تلقائياً مظهراً ليلياً متطوراً دون الحاجة لتكرار الكود.

6. **توحيد وتناسق نسق الأرقام (Western vs. Eastern Numerals Parity) عبر الداشبورد:**
   - حل ظاهرة خلط الأرقام ورصد التباين (ظهور التوقيت الميداني بأرقام هندية `٢٠٢٦/٩/١٥` وبجانبه معرف المستخدم بأرقام غربية `7594239391`).
   - استبدال استدعاءات `toLocaleString('ar-EG')` الصلبة في شاشات الخادم (مثل `telemetry`, `audit-vault`, `finance`) بدوال تنسيق موحدة تعتمد اختيار المستخدم في التفضيلات (`alsaada_num_format`).
   - ضمان ظهور كافة الأرقام (التواريخ، المعرفات، المدد، والكميات) بنسق موحد تماماً وبدون أي خلط عند اختيار الأرقام الإنجليزية/الغربية أو المشرقية.

---

### 2️⃣ جدول الملفات المتأثرة بالتعديل (Impacted Files Matrix)

| الملف | نوع التعديل | الدور الوظيفي |
| :--- | :---: | :--- |
| [`src/components/layout/dashboard-shell.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/layout/dashboard-shell.tsx) | `MODIFY` | تحويل خلفية حاوية الداشبورد العامة لتصبح `dark:bg-slate-950` |
| [`src/app/globals.css`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/app/globals.css) | `MODIFY` | تعزيز متغيرات `.dark` وإضافة أنماط تلقائية للمدخلات والجداول والبطاقات |
| [`src/components/dashboard/super-admin-overview.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/dashboard/super-admin-overview.tsx) | `MODIFY` | الوضع الليلي الكامل لكافة بطاقات المؤشرات والمواقع والتحكم السيادي |
| [`src/components/dashboard/general-admin-overview.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/dashboard/general-admin-overview.tsx) | `MODIFY` | الوضع الليلي لبطاقات الإدارة العامة والرقابة المركزية |
| [`src/components/dashboard/field-admin-overview.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/dashboard/field-admin-overview.tsx) | `MODIFY` | الوضع الليلي لشاشة الإشراف الميداني ومؤشرات الموقع |
| [`src/components/layout/command-palette.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/layout/command-palette.tsx) | `MODIFY` | نافذة الأوامر السريعة بالوضع الليلي الكامل |
| [`src/components/ui/data-table.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/ui/data-table.tsx) | `MODIFY` | الجداول والبحث والترقيم بالوضع الليلي |
| [`src/components/ui/zero-state-card.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/ui/zero-state-card.tsx) | `MODIFY` | بطاقة الحالات الصفرية بالوضع الليلي |
| [`src/app/admin/workforce/directory/directory-client.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/app/admin/workforce/directory/directory-client.tsx) | `MODIFY` | دليل العاملين وجداول البحث بالوضع الليلي |
| [`src/app/admin/finance/page.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/app/admin/finance/page.tsx) | `MODIFY` | المركز المالي وبطاقات الخزينة والسيولة |
| [`src/app/admin/finance/treasury/treasury-client.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/app/admin/finance/treasury/treasury-client.tsx) | `MODIFY` | مرصد السيولة والعهد الميدانية وشرائح قياس السيولة |
| [`src/app/admin/approvals/approvals-client.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/app/admin/approvals/approvals-client.tsx) | `MODIFY` | مركز الاعتمادات والقرارات |
| [`tests/dashboard-preferences.spec.ts`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/tests/dashboard-preferences.spec.ts) | `MODIFY` | تحديث واختبار التوافق الشامل والتحقق من تطبيق فئات `dark:` |

---

### 3️⃣ خطة الفحص وسجل التحقق الفعلي (Verification Record)

1. **فحص الـ Vitest التلقائي:**
   - أمر التشغيل: `pnpm --filter @alsaada/admin-dashboard test`
   - النتيجة: `PASS` — 24 ملف اختبار، 225 اختباراً ناجحاً بنسبة 100% (منها 3 اختبارات هيكلية جديدة للوضع الليلي).
2. **فحص سلامة الأنواع البرمجية (Strict TypeScript):**
   - أمر التشغيل: `pnpm --filter @alsaada/admin-dashboard typecheck`
   - النتيجة: `PASS` — Zero compile errors (خروج بـ Exit 0).
3. **فحص بناء الإنتاج الكامل (Next.js 15 Build):**
   - أمر التشغيل: `pnpm --filter @alsaada/admin-dashboard build`
   - النتيجة: `PASS` — خروج بـ Exit 0، تم توليد 11 مساراً ثابتاً ومسارات الخادم بكفاءة بدون أي خطأ تصيير.
4. **بوابات الحوكمة والمعمارية:**
   - `pnpm arch:verify`: `PASS` (41 فحصاً معمارياً ناجحاً).
   - `pnpm financial:verify`: `PASS` (6 فحوصات للنزاهة المالية وسلاسل الهاش).
   - `pnpm perf-budget:verify`: `PASS` (6 مؤشرات أداء وذاكرة ناجحة).

