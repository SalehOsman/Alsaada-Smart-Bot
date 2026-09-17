# 📋 خطة العمل رقم 56: إصلاح استجابة أزرار الأقسام في القائمة الجانبية المزدوجة (Dual-Rail Toggle & Pin State Remediation)
## Master Plan 56: Dual-Rail Sidebar Toggle Responsiveness & Pin State Lifecycle Remediation

> [!IMPORTANT]
> **مقررات جلسة العصف الذهني (`/grill-me`) وميثاق تفاعل المستخدم المعتمد:**
> 1. **تفعيل سلوك التبديل الذكي (Universal Toggle Logic):**
>    - عند النقر على زر القسم في الشريط الجانبي الأيقوني (Primary Rail) والمستخدم متواجد بالفعل داخل إحدى صفحات ذلك القسم:
>      * إذا كانت القائمة مغلقة (`isFlyoutOpen === false`): تُفتح فوراً (`isFlyoutOpen = true`) بغض النظر عن حالة التثبيت (Pinned or Floating).
>      * إذا كانت القائمة مفتوحة (`isFlyoutOpen === true`): تُغلق فوراً (`isFlyoutOpen = false`).
> 2. **الحفاظ على وضع التثبيت (Pin Preference Preservation):**
>    - عند إغلاق اللوح يدوياً (سواء عبر زر `X` أو بالنقر على زر القسم)، يظل تفضيل التثبيت (`isPinned`) محفوظاً دون إلغائه، بحيث إذا فتح المستخدم اللوح مجدداً يفتح كلوح مثبت (Pinned) بجانب المحتوى.
> 3. **استقرار حالة اللوح عند التنقل بين الصفحات (Zero Intrusive Auto-Open):**
>    - إذا أغلق المستخدم اللوح يدوياً وهو في وضع التثبيت، فإن الانتقال لصفحة أخرى لا يفرض إعادة فتح اللوح تلقائياً، بل يظل مغلقاً حتى يقرر المستخدم فتحه بالنقر على زر القسم.
> 4. **الانتقال السلس بين الأقسام:**
>    - النقر على قسم آخر يفتح لوحه فوراً ويضبط القسم المحدد ويصفر حقل البحث.

---

## 🔍 التشخيص الدقيق لجذر المشكلة (Root Cause Analysis)

في الملف [`apps/admin-dashboard/src/components/layout/sidebar.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/components/layout/sidebar.tsx):
1. **الخلل في دالة `handleRailClick` (السطر 229-234):**
   ```tsx
   if (selectedRailHref === item.href) {
     if (!isPinned) {
       setIsFlyoutOpen((prev) => !prev);
     }
   }
   ```
   عندما يكون المستخدم داخل صفحة من صفحات القسم (مثل `/admin/workforce/directory`)، يكون `selectedRailHref` مساوياً لـ `item.href` (`/admin/workforce`).
   إذا كان وضع التثبيت (`isPinned === true`) مفعلاً في `localStorage` أو في الجلسة، وكان اللوح مغلقاً (مثلاً قام المستخدم بالنقر على زر `X` في اللوح):
   فإن الشرط `if (!isPinned)` يعود بـ `false`! وبالتالي **لا يتم استدعاء `setIsFlyoutOpen` نهائياً**، ويتجاهل الزر نقرات المستخدم تماماً ولا يستجيب!
   وعندما ينقر المستخدم على قسم آخر، يتجه التنفيذ لفرع `else` الذي يستدعي `setIsFlyoutOpen(true)`، مما جعل اللوح يفتح للأقسام الأخرى فقط دون القسم الحالي!

2. **الخلل في `useEffect` الخاص بمزامنة المسار (السطر 191-199):**
   ```tsx
   useEffect(() => {
     const activeHref = getActiveSectorHref();
     setSelectedRailHref(activeHref);
     const activeGroup = navItems.find((g) => g.href === activeHref);
     if (isPinned && activeGroup && hasSubNav(activeGroup)) {
       setIsFlyoutOpen(true);
     }
   }, [pathname, navItems, isPinned]);
   ```
   كان هذا التأثير يفرض فتح اللوح قسراً عند كل تنقل بين المسارات إذا كان `isPinned` مفعلاً، مما يمنع المستخدم من إبقاء اللوح مغلقاً أثناء العمل.

---

## 📦 بنود التنفيذ المقترحة

### المرحلة 1: تصحيح منطق `handleRailClick` في `sidebar.tsx`
- إزالة قيد `if (!isPinned)` المعطل للاستجابة.
- تطبيق التبديل المباشر: `setIsFlyoutOpen((prev) => !prev)`.
- تصفير استعلام البحث `setFlyoutSearchQuery('')` عند الفتح.

### المرحلة 2: ضبط دورة حياة التثبيت والمزامنة مع المسارات
- تعديل `useEffect` الخاص بالـ `pathname` ليقوم فقط بمزامنة القسم النشط `selectedRailHref` دون فرض `setIsFlyoutOpen(true)` إذا كان اللوح قد أُغلق يدوياً.
- الحفاظ على `isPinned` في `localStorage` ليعمل كـ "نمط عرض" (Display Layout Mode: Pinned vs Floating) عند فتح اللوح.

### المرحلة 3: إضافة وتوسيع الاختبارات الآلية `tests/sidebar-nav.spec.ts`
- اختبار تفاعل النقر على نفس زر القسم أثناء التواجد بداخله وضمان تبديل الحالة من مغلق لمفتوح والعكس في حالتي التثبيت والعائم.
- اختبار الانتقال بين الأقسام المختلفة وضمان استجابة اللوح الفورية.
- اختبار ثبات حالة الإغلاق اليدوي أثناء التنقل بين المسارات.

### المرحلة 4: فحص الجودة البرمجية والتحقق الشامل
- تشغيل اختبارات لوحة التحكم: `pnpm --filter @alsaada/admin-dashboard test`.
- فحص التايب سكريبت: `pnpm --filter @alsaada/admin-dashboard typecheck`.
- فحص بناء الإنتاج: `pnpm --filter @alsaada/admin-dashboard build`.
