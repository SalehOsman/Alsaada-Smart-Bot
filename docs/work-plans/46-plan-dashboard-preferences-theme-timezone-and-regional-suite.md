# خطة العمل 46: إنشاء موديول إعدادات وتفضيلات الداشبورد (Dashboard Preferences, Theme, Timezone & Regional Suite)

وفقاً لمخرجات جلسة المقابلة التصميمية (`/grill-me`) وتوافق القرارات المعمارية، تهدف هذه الخطة إلى بناء موديول متكامل واحترافي لإعدادات وتفضيلات لوحة التحكم الإدارية (`apps/admin-dashboard`)، يمنح كل مشرف وإداري تحكماً كاملاً ولحظياً في المظهر، والتوقيت، وتنسيق الأرقام، وسلوك البيانات.

---

## 🎯 1. القرارات المعمارية المعتمدة (Decisions Baseline)

1. **نطاق التخزين والمزامنة (Hybrid Persistence):**
   - حفظ لحظي فوري في المتصفح (`localStorage` + Cookies) لضمان سرعة الاستجابة ومنع وميض الشاشة (Zero FOUC).
   - مزامنة صامتة في الخلفية (Debounced Background Sync) عبر نقطة اتصال `/api/user/preferences`.
2. **حزم وأقسام الإعدادات المتكاملة (Feature Scope):**
   - **حزمة المظهر والعرض (Appearance & Display):** الوضع الليلي والنهاري والتلقائي (`Light` / `Dark` / `System`) مع تفعيل فئة `.dark` على جذر المستند، كثافة الجداول (`Comfortable` / `Compact`)، وحالة القائمة الجانبية.
   - **حزمة التوقيت والتقويم (Timezone & Calendar):** اختيار المنطقة الزمنية التشغيلية (افتراضي: `Africa/Cairo` - توقيت القاهرة، مع الرياض، دبي، لندن، UTC وغيرها)، ونظام الوقت (12 / 24 ساعة)، وتنسيق التاريخ (DD/MM/YYYY أو YYYY-MM-DD)، وبداية الأسبوع (السبت/الأحد/الإثنين).
   - **حزمة الأرقام والعملة (Locale & Regional):** التبديل بين الأرقام الإنجليزية (123) والمشرقية (١٢٣)، وتنسيق عرض الجنيه المصري والفواصل العشرية.
   - **حزمة سلوك البيانات والتنبيهات (Data & Telemetry):** معدل التحديث التلقائي للمؤشرات الحية، والعدد الافتراضي لصفوف الجداول (10/25/50/100)، وتفعيل التنبيه الصوتي لطلبات الاعتماد الفورية باستخدام Web Audio API.
3. **موضع الوصول في واجهة المستخدم (UI & Navigation Placement):**
   - صفحة مستقلة متكاملة: `/admin/settings/preferences` مدرجة في بطاقات مركز الإعدادات والحوكمة وفي المانيفست.
   - شريط وصول وتبديل سريع في الهيدر العلوي: زر فوري لتبديل السمة (Dark/Light)، وساعة تشغيلية حية متزامنة بالثواني تُظهر اسم وعلم المنطقة (مثل: `🇪🇬 القاهرة 04:15:23 م`)، وزر وصول مباشر لصفحة التفضيلات.
4. **الأدوار والصلاحيات (RBAC Access):**
   - متاحة لكافة مستخدمي الداشبورد (`SUPER_ADMIN`، `GENERAL_ADMIN`، `FIELD_ADMIN`) لتخصيص بيئة عملهم بحسب أجهزتهم ومواقعهم.
5. **تجربة التفاعل والحفظ (Live Preview & Autosave UX):**
   - تطبيق فوري مباشر للتغييرات بدون إعادة تحميل الصفحة، مع حفظ تلقائي ومؤشر أنيق *"تم الحفظ تلقائياً"* وخيار *"استعادة الإعدادات الافتراضية"*.

---

## 📋 2. مصفوفة المهام والملفات المتأثرة (Execution Matrix)

- [x] **توثيق الخطة رسمياً وتحديث فهرس الخطط:**
  - `docs/work-plans/46-plan-dashboard-preferences-theme-timezone-and-regional-suite.md`
  - `docs/work-plans/README.md`
- [x] **موفر السياق والحالة (Dashboard Preferences State & Provider):**
  - `apps/admin-dashboard/src/components/providers/dashboard-preferences-provider.tsx`
- [x] **تحديث التخطيط العام وتطبيق منع الوميض (Zero FOUC):**
  - `apps/admin-dashboard/src/app/layout.tsx`
- [x] **ترقية الهيدر بالساعة الحية وزر السمة والوصول السريع:**
  - `apps/admin-dashboard/src/components/layout/header.tsx`
- [x] **بناء صفحة التفضيلات الشاملة:**
  - `apps/admin-dashboard/src/app/admin/settings/preferences/page.tsx`
- [x] **إضافة بطاقة التفضيلات في مركز الإعدادات:**
  - `apps/admin-dashboard/src/app/admin/settings/page.tsx`
- [x] **تسجيل الخاصية في مانيفست الداشبورد:**
  - `apps/admin-dashboard/src/dashboard.manifest.ts`
- [x] **نقطة نهاية الـ API السحابية:**
  - `apps/admin-dashboard/src/app/api/user/preferences/route.ts`
- [x] **حزمة الاختبارات الشاملة:**
  - `apps/admin-dashboard/tests/dashboard-preferences.spec.ts`

---

## 🔍 3. خطة التحقق والاختبار (Verification Record)

1. اختبارات الوحدة والتكامل في الداشبورد:
   `pnpm --filter @alsaada/admin-dashboard test`
2. فحص سلامة التايب سكريبت:
   `pnpm --filter @alsaada/admin-dashboard typecheck`
3. التحقق الحوكمي والمعماري:
   `pnpm arch:verify && pnpm dashboard-auth:verify`
