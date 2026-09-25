# 📋 خطة العمل الموحدة رقم 56 (المعتمدة والنهائية): ميثاق الترقية المعمارية الشاملة للداشبورد وإعادة هندسة مركز الإحصائيات
## Master Plan 56: Enterprise Dual-Rail Navigation, 100% Dark Mode Parity, Real-Data Analytics Overhaul & Master UX/UI Suite

> [!IMPORTANT]
> **مقررات جلسات العصف الذهني (`/grill-me`) والنقد المعماري والمصادقة الصريحة من المستخدم:**
> تمثل هذه الوثيقة المرجع الهندسي الشامل لدمج:
> 1. إصلاح القائمة الجانبية المزدوجة (Dual-Rail Toggle).
> 2. التحول الشامل للوضع الليلي بنسبة 100% بكافة الشاشات.
> 3. تحويل بطاقات المؤشرات (KPIs) في الشاشة الرئيسية إلى روابط تفاعلية حية.
> 4. **إعادة هندسة وبناء مركز الإحصائيات والتحليلات بالكامل (`/admin/analytics`)**: استبدال أزرار التصفية المبعثرة بقوائم منسدلة أنيقة (Dropdown Selects)، وعرض بيانات حقيقية وإحصائيات فعلية من قاعدة البيانات متغيرة حسب الموديول المختار، مع أشرطة ورسوم بيانية بصرية خفيفة وسريعة (CSS/SVG)، وجدول حقيقي بأحدث العمليات والسجلات.
> 5. حزمة التحسينات الـ 11 لتجربة المستخدم والتصميم المؤسسي.

---

## 🏛️ محاور ومراحل خطة العمل التنفيذية

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PLAN 56 EXECUTION MATRIX                              │
├─────────────────────────┬───────────────────────────┬───────────────────────────┤
│ PHASE 1: DUAL-RAIL CORE │ PHASE 2: 100% DARK MODE   │ PHASE 3: REAL ANALYTICS   │
│ • Universal Toggle      │ • globals.css Base Tokens │ • Dropdown Filter Bar     │
│ • Pin Preference Memory │ • 17 Internal Screens     │ • Dynamic Module Data     │
│ • Non-intrusive Nav     │ • Multi-Tier Elevation    │ • Visual Breakdown Bars   │
│ • Ctrl+B & Esc Restore  │ • Micro-Glassmorphism     │ • Real Operations Ledger  │
├─────────────────────────┼───────────────────────────┼───────────────────────────┤
│ PHASE 4: INTERACTIVE KPIS                           │ PHASE 5: ENTERPRISE UX    │
│ • 4 Main Overview Cards -> Real Direct Links        │ • Dynamic Breadcrumbs Bar │
│ • Hover Glow, 3D Scale & Arrow Indicator            │ • Live Notification Bell  │
│ • Accessible ARIA Navigation                        │ • Sticky Action Dock      │
│                                                     │ • Shimmer Skeletons       │
│                                                     │ • Clean Print Engine      │
│                                                     │ • High-Density View       │
└─────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### 1️⃣ المحور الأول: محرك التنقل المزدوج الذكي (Dual-Rail Reactive Navigation Engine)
1. **التبديل الذكي لأزرار الأقسام (Universal Rail Toggle):**
   - في [`sidebar.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/layout/sidebar.tsx): إزالة قيد `if (!isPinned)` وجعل النقر على زر القسم الحالي يبدل الحالة فورياً (`setIsFlyoutOpen((prev) => !prev)`).
   - إذا كان اللوح مغلقاً، يفتح فوراً للقسم الحالي سواء كان الوضع مثبتاً (Pinned) أو عائماً (Floating).
   - إذا كان اللوح مفتوحاً، يغلق فوراً.
   - تصفير استعلام البحث عند الفتح: `setFlyoutSearchQuery('')`.
2. **الحفاظ على تفضيل التثبيت (Pin Preference Preservation):**
   - إغلاق اللوح يدوياً عبر زر `X` أو بالنقر على زر القسم يخفيه فقط دون إلغاء تفضيل التثبيت (`isPinned`) المخزن في `localStorage`.
   - عند إعادة فتحه، يفتح كلوح مثبت (Pinned) بجانب المحتوى.
3. **استقرار حالة اللوح عند التنقل بين المسارات (Zero Intrusive Auto-Open):**
   - تحرير `useEffect` الخاص بالمسار (`pathname`) ليزامن فقط القسم النشط `selectedRailHref` دون فرض `setIsFlyoutOpen(true)` إذا كان المستخدم قد أغلق اللوح يدوياً.
4. **اختصارات لوحة المفاتيح وسهولة الوصول (Power-User Shortcuts & Accessibility):**
   - إضافة اختصار `Ctrl + B` للتبديل السريع بين الوضع المثبت والعائم للقائمة.
   - دعم مفتاح `Escape` لإغلاق اللوح العائم واستعادة الفوكس لزر القسم في الشريط الأيقوني (`Focus Restoration`).
   - ربط سمات `aria-expanded` و `aria-controls` لتحقيق معايير WCAG 2.1 AA.

---

### 2️⃣ المحور الثاني: إعادة هندسة وبناء مركز الإحصائيات والتحليلات (`/admin/analytics`) بالكامل
1. **شريط الفلاتر المدمج بالقوائم المنسدلة (Compact Dropdown Filter Bar):**
   - استبدال صفوف الأزرار المبعثرة بأربعة قوائم منسدلة احترافية (`<select>`):
     * **قائمة الموديول البرمجي:** الموارد البشرية، السلف والمسحوبات، الخزينة والسيولة، الكانتين والمهمات، المعدات، الحوكمة والإعدادات.
     * **قائمة الموقع الميداني:** كافة المواقع، أو تحديد موقع محدد من المواقع النشطة.
     * **قائمة الفترة الزمنية:** اليوم، هذا الأسبوع، هذا الشهر، كل الفترات.
     * **قائمة الوظيفة / التدفق:** تتغير ديناميكياً بحسب الموديول المختار.
     * زر إعادة ضبط الفلاتر بنقرة واحدة (Reset Filters).
2. **جلب وعرض بيانات حقيقية وإحصائيات فعلية من قاعدة البيانات (Real Live Data Fetcher):**
   - بناء دالة `getModuleAnalyticsData(moduleKey, siteId, period, user)` في `data-fetchers.ts`:
     * **الموارد البشرية (`workforce`):** عدد العمال الفعلي بالموقع، التعيينات الجديدة بالفترة، توزيع المهن، متوسط مؤشر الالتزام.
     * **السلف والمسحوبات (`advances`):** إجمالي مبالغ السلف المعتمدة والمعلقة، عدد الطلبات، ومعدل الاسترداد.
     * **الخزينة والسيولة (`custody`):** إجمالي السيولة المتاحة والعهد المفتوحة وحركة التدفقات.
     * **الكانتين ومهمات الوقاية (`canteen`):** المبيعات المنصرفة وعدد العمال المستفيدين.
     * **المعدات والمحروقات (`equipment`):** المعدات العاملة واستهلاك الوقود.
3. **أشرطة ومخططات التوزيع البصرية الخفيفة (Lightweight CSS/SVG Breakdown Bars):**
   - أشرطة توزيع مرئية خفيفة وسريعة (مثل: توزيع العمال حسب المهن، نسب المعاملات المنجزة مقابل المعلقة، وحركة السيولة) تعتمد على CSS و SVG نقي بدون أي مكتبات خارجية تؤثر على زمن الاستجابة.
4. **سجل العمليات التشغيلية الحقيقي (Real Operations Ledger):**
   - استبدال الجدول الوهمي بجدول حقيقي يعرض آخر العمليات والمعاملات المسجلة فعلياً في الموديول والموقع المختار، مع التاريخ، اسم العامل، البيان، والمبلغ/الحالة.

---

### 3️⃣ المحور الثالث: بطاقات المؤشرات التفاعلية في الشاشة الرئيسية (Interactive KPI Cards)
- في [`super-admin-overview.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/dashboard/super-admin-overview.tsx) و [`general-admin-overview.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/dashboard/general-admin-overview.tsx) و [`field-admin-overview.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/dashboard/field-admin-overview.tsx):
  * **إجمالي القوى العاملة:** تصبح رابطاً تفاعلياً (`<Link href="/admin/workforce/directory">`) ينقل لدليل وسجل العاملين.
  * **المواقع المفتوحة:** تصبح رابطاً تفاعلياً (`<Link href="/admin/settings/sites">`) ينقل لسجل وخريطة المشاريع والمواقع.
  * **الطلبات والمعاملات المعلقة:** تصبح رابطاً تفاعلياً (`<Link href="/admin/approvals">`) ينقل لمركز الاعتمادات والقرارات الفورية.
  * **مرصد زمن الاستجابة (APM):** تصبح رابطاً تفاعلياً (`<Link href="/admin/settings/telemetry">`) ينقل لمرصد أداء البوت.
  * إضافة لمسات الـ Hover التفاعلية: توهج برتقالي، وتأثير ارتفاع `scale-[1.01]`، ومؤشر سهم تفاعلي.

---

### 4️⃣ المحور الرابع: التحول الشامل للوضع الليلي بنسبة 100% بكافة الشاشات الـ 17 المتبقية
تطهير واستبدال كافة فئات الألوان الصلبة وتطبيق هرمية الـ Elevation في الشاشات التالية:
- `admin/workforce/new/new-worker-client.tsx` (مع شريط الإجراءات العائم السفلي).
- `admin/workforce/[id]/edit/edit-worker-client.tsx`.
- `admin/workforce/clearances/clearances-client.tsx`.
- `admin/workforce/export/page.tsx`.
- `admin/analytics/page.tsx` (تمت إعادة هندستها بالكامل للمظهرين الليلي والنهاري).
- شاشات الحوكمة والإعدادات (`settings/*`: sites, jobs, users, company, notifications, studio, ghost-mode, telemetry, assignments, settings hub).
- الشاشات التشغيلية واللوجستية (`operations/equipment`, `logistics/canteen`).

---

### 5️⃣ المحور الخامس: المناعة المعمارية وحزمة الـ UX المؤسسية (Enterprise UX Elevators)
1. **المناعة المعمارية في `globals.css`:** قواعد عامة تلقائية في `@layer base` للـ `.dark input`, `.dark select`, `.dark textarea`, `.dark table`.
2. **شريط مسار التتبع الذكي (`breadcrumbs.tsx`):** مسار تتبع تفاعلي أعلى كل صفحة مع زر نسخ الرابط والرجوع.
3. **مركز الإشعارات الميدانية الحي في الهيدر (`header.tsx`):** جرس إشعارات تفاعلي وقائمة زجاجية للأحداث العاجلة مع صوت التنبيه.
4. **هياكل التحميل الشبحية (`skeleton.tsx`):** تحميل نبضي انسيابي يمنح إحساساً بالاستجابة الفورية.
5. **مؤشرات الحالة الميدانية النابضة (`Pulsing Status Pills`).**
6. **تفعيل كثافة الجداول المدمجة (`High-Density Table View`).**
7. **نمط الطباعة الرسمية النظيفة (`Clean Paper & PDF Print Engine`).**

---

### 6️⃣ المحور السادس: بوابات الفحص والتحقق الآلي (Automated QA & Quality Gates)
- `tests/sidebar-nav.spec.ts`: فحص استجابة السايدبار للتبديل الفوري وحفظ التثبيت.
- `tests/dashboard-preferences.spec.ts`: فحص خلو الشاشات من البقع البيضاء وتفاعل كروت المؤشرات وفلاتر التحليلات.
- `pnpm --filter @alsaada/admin-dashboard test`
- `pnpm --filter @alsaada/admin-dashboard typecheck`
- `pnpm --filter @alsaada/admin-dashboard build`
