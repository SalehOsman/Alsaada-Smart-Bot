# تقرير الجرد الميداني الشامل للأدوار والمسارات والمطابقة المرجعية (المحدث والمحصن)
## Exhaustive Role, Route, and Legacy Parity Inventory Audit — PLAN-21 (Hardened & Enriched)

> **المشروع:** منظومة السعادة سمارت بوت (`F:\Alsaada-Smart-Bot`)  
> **خطة العمل الحاكمة:** `docs/work-plans/21-plan-unified-bot-dashboard-auth-rbac-and-functional-parity.md` (المرحلة الثانية: Phase 2)  
> **وثيقة التصميم المعتمدة (SSOT):** `docs/superpowers/specs/2026-09-13-unified-bot-dashboard-auth-rbac-parity-design.md`  
> **المرجع الوظيفي الأول والأساس:** `F:\HR`  
> **التاريخ:** 2026-09-13T09:35:00Z  
> **إعداد:** Worker M0 و Explorer M0 R2_3 (تحصين ومعالجة ثغرات تدقيق Challenger M0_2 و Reviewer M0_2)

---

## 1. المقدمة والغرض المعماري (Executive Summary)

يكشف هذا التقرير الجرد الدقيق والشامل لواقع الصلاحيات والأدوار ونقاط المصادقة ومسارات الواجهات في كامل مستودع `F:\Alsaada-Smart-Bot`، ومقارنتها بالمرجع الوظيفي الأساسي `F:\HR` وميثاق التصميم المعتمد لـ `PLAN-21`.

يهدف هذا التقرير المحصن إلى وضع خط سير حاسم وجنائي لا يقبل الشك لتنفيذ الآتي:
1. استئصال كافة الأدوار الملغاة وغير المعتمدة وتثبيت الأدوار السبعة الكنسية في اللوحة والبوت.
2. تفكيك وإزالة بوابات المصادقة الضعيفة والمتناثرة وصفحة `/login` واستبدالها بنظام المطالبة الذرية من البوت (`/api/auth/claim`).
3. إحكام جدار الحماية `middleware.ts` وتأمين كافة صفحات الإدارة الـ 25 لمنع أي تجاوز بالمسار المباشر (Direct URL Manipulation).
4. تطهير كائنات المحاكاة والمستخدمين الافتراضيين (`DEMO_USERS` في `users.ts`).
5. سد ثغرات التسريب المالي للأجور والمخالصات في شاشات مصفوفة الوظائف (`/admin/settings/jobs`) وإنهاء الخدمة (`/admin/workforce/clearances`).
6. تصحيح انحراف أدوار البوت في `Flow 00.12` وموديولات النظام الميداني لضمان التطابق التام 100%.

---

## 2. مصفوفة مقارنة الأدوار الحالية مقابل الأدوار السبعة المعتمدة (Role Mapping Matrix)

### 2.1 الوضع الحالي في لوحة التحكم (`apps/admin-dashboard/src/lib/rbac.ts:1-12`)
يحتوي الملف حالياً على تعريف متضخم يضم **11 دوراً**:
```typescript
export type UserRole =
  | 'SUPER_ADMIN'
  | 'GENERAL_ADMIN'
  | 'EXECUTIVE'
  | 'EXECUTIVE_DIRECTOR'
  | 'PROJECT_MANAGER'
  | 'ACCOUNTANT'
  | 'FIELD_ADMIN'
  | 'SITE_ENGINEER'
  | 'WORKER'
  | 'SUPPLIER'
  | 'GUEST';
```

### 2.2 جدول المقابلة والفرز مع الأدوار السبعة المعتمدة (Canonical 7 Roles)

| # | الدور الحالي في الكود | تصنيف الحالة في PLAN-21 | الدور البديل المعتمد | إمكانية دخول الداشبورد | الإجراء المتخذ في المهاجرة |
|:---:|---|:---:|:---:|:---:|---|
| 1 | `SUPER_ADMIN` | ✅ **معتمد (Canonical)** | `SUPER_ADMIN` | مسموح (كامل المنظومة والسيادية) | الحفاظ التام دون تغيير |
| 2 | `GENERAL_ADMIN` | ✅ **معتمد (Canonical)** | `GENERAL_ADMIN` | مسموح (إدارة تشغيلية عامة) | الحفاظ التام دون تغيير |
| 3 | `FIELD_ADMIN` | ✅ **معتمد (Canonical)** | `FIELD_ADMIN` | مسموح (محصور بموقعه المسجل) | الحفاظ التام مع حجب الرواتب |
| 4 | *(غير موجود بالكود)* | 🟢 **مستحدث معتمد (Canonical)** | `WORKER_SUPERVISOR` | **محظور (DENY_BY_DEFAULT)** | يُشتق آلياً من جدول `worker_delegations` |
| 5 | `WORKER` | ✅ **معتمد (Canonical)** | `WORKER` | **محظور (DENY_BY_DEFAULT)** | خدمات ذاتية عبر البوت فقط |
| 6 | `SUPPLIER` | ✅ **معتمد (Canonical)** | `SUPPLIER` | **محظور (DENY_BY_DEFAULT)** | كشف حساب وفواتير عبر البوت فقط |
| 7 | `GUEST` | ✅ **معتمد (Canonical)** | `GUEST` | **محظور (DENY_BY_DEFAULT)** | زائر قيد التفعيل عبر البوت فقط |
| 8 | `EXECUTIVE` | ❌ **ملغى نهائياً (Deprecated)** | دمج في `SUPER_ADMIN` / `GENERAL_ADMIN` | محظور | أرشفة جنائية في `audit_logs` ثم تحويل لـ `GUEST` مع `isActive = false` |
| 9 | `EXECUTIVE_DIRECTOR` | ❌ **ملغى نهائياً (Deprecated)** | دمج في `GENERAL_ADMIN` | محظور | استئصال كودي وأرشفة جنائية |
| 10 | `ACCOUNTANT` | ❌ **ملغى نهائياً (Deprecated)** | وظائف سيادية تتبع `SUPER_ADMIN` | محظور | استئصال كودي وأرشفة جنائية |
| 11 | `PROJECT_MANAGER` | ❌ **ملغى نهائياً (Deprecated)** | دمج في `FIELD_ADMIN` | محظور | استئصال كودي وأرشفة جنائية |
| 12 | `SITE_ENGINEER` | ❌ **ملغى نهائياً (Deprecated)** | دمج في `FIELD_ADMIN` | محظور | استئصال كودي وأرشفة جنائية |
| 13 | `ADMIN` (القديم) | 🔄 **مرحّل (Legacy Mapped)** | `FIELD_ADMIN` | مسموح (بالموقع المسجل) | ترحيل تلقائي في DML المهاجرة إلى `FIELD_ADMIN` |

> **تنبيه جنائي إضافي حول أدوار الاختبارات الشاردة:**  
> رصد الفحص العدائي وجود أدوار شاردة غير معتمدة في ملفات الاختبارات:  
> - `AUDITOR` في `packages/telemetry/tests/challenger-m1-2.stress.spec.ts:318`  
> - `OPERATOR` في `packages/database/tests/adversarial-m2-audit.spec.ts:228`  
> - `ADMIN` في `apps/bot-server/tests/error-vault-and-telemetry.spec.ts:251`  
> يجب تطهير هذه الأدوار واستبدالها بالأدوار السبعة الكنسية في Phase 11.

---

### 2.3 انحراف الصلاحيات في بوت تيليجرام (`Flow 00.12` وموديولات البوت)

كشف التحقيق العدائي لجرد الصلاحيات أن انحراف الأدوار لا يقتصر على لوحة التحكم، بل يمتد إلى قلب البوت الميداني:

1. **غياب الأدوار الكنسية في `modules/settings/src/flows/00.12-user-rbac-management/flow.validators.ts:3-10`:**
   ```typescript
   export const VALID_RBAC_ROLES = [
     'SUPER_ADMIN',
     'EXECUTIVE',
     'FIELD_ADMIN',
     'ACCOUNTANT',
     'WORKER',
     'GUEST',
   ] as const;
   ```
   - **الخلل:** يغيب دور `GENERAL_ADMIN` تماماً، ويغيب دور `SUPPLIER` تماماً، بينما يتاح تعيين أدوار ملغاة (`EXECUTIVE`, `ACCOUNTANT`).
   - **الأثر التشغيلي:** عجز السوبر أدمن عن ترقية أو تعيين أي حساب برتبة `GENERAL_ADMIN` من خلال البوت؛ حيث ترفض الدالة `validateRole` الطلب وتلقي خطأ: *"الرتبة المحددة غير معتمدة بنظام الصلاحيات"*.

2. **أزرار اختيار الرتب في `flow.keyboard.ts:87-104`:**
   تقدم لوحة المفاتيح أزراراً صريحة لتعيين أدوار ملغاة:
   - `[ 👔 إدارة تنفيذية ومالية ]` (`EXECUTIVE`)
   - `[ 💼 محاسب مالي ]` (`ACCOUNTANT`)
   وتخلو تماماً من أزرار `GENERAL_ADMIN` و `SUPPLIER`.

3. **وجود أدوار ملغاة في عقود الموديولات الأخرى:**
   - `modules/workforce/src/flows/01.8-worker-offboarding/flow.service.ts:233`: فحص متبقٍ لـ `['SUPER_ADMIN', 'ACCOUNTANT'].includes(role)`.
   - `modules/workforce/src/flows/01.8-worker-offboarding/flow.contract.json:11`: قيد متبقٍ لـ `"ACCOUNTANT"`.
   - `apps/bot-server/src/services/command-scope.service.ts:37, 112`: مصفوفة أوامر مخصصة لـ `ACCOUNTANT_COMMANDS`.
   - `apps/bot-server/src/handlers/dashboard.handler.ts:20-22`: مسميات لأدوار ملغاة (`EXECUTIVE_DIRECTOR`, `ACCOUNTANT`).

**الإجراء المعماري الإلزامي (Phase 3 & Phase 9):**  
توحيد منظومة التحقق ولوحات المفاتيح في البوت بالاعتماد المباشر على الحزمة المركزية `@alsaada/rbac`، وتطهير كافة الموديولات وعقود التدفقات من `EXECUTIVE` و `ACCOUNTANT` وإدراج `GENERAL_ADMIN` و `SUPPLIER`.

---

## 3. التحقيق الجنائي والمقارنة مع المرجع الأساسي (`F:\HR\src\config\constants.ts`)

### 3.1 النص الحرفي لتعريف الأدوار في المشروع القديم `F:\HR`
بالرجوع إلى السطور 3 إلى 11 من ملف المرجع الأساسي `F:\HR\src\config\constants.ts`:
```typescript
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',     // المالك ومسؤول النظام التقني (كافة الصلاحيات + DevOps وحاويات دوكر والنسخ الاحتياطية وإعدادات الربط)
  GENERAL_ADMIN = 'GENERAL_ADMIN', // المدير العام التنفيذي (صلاحيات إدارية وتشغيلية شاملة + عهد وموردين تنفيذيين + اعتمادات السلف والرواتب)
  EXECUTIVE = 'EXECUTIVE',         // الإدارة العليا / رئيس مجلس الإدارة (رؤية تنفيذية عالية المستوى وتقارير مجمعة)
  ADMIN = 'ADMIN',                 // المشرف الميداني / أمين الصرف والمخزن (تسجيل السلف والإجازات والعهد الميدانية الحصرية)
  WORKER = 'WORKER',               // العامل / الموظف (استعراض قسيمته الشخصية فقط وتقديم طلبات)
  SUPPLIER = 'SUPPLIER',           // المورد (استعراض كشف الحساب والمستحقات وسجل الدفعات الخاصة به)
  GUEST = 'GUEST',                 // زائر لم يتم توثيق هويته بعد
}
```

### 3.2 الاستنتاجات الجنائية القاطعة:
1. **أدوار غير أصيلة ودخيلة:** إن الأدوار `ACCOUNTANT` و `PROJECT_MANAGER` و `SITE_ENGINEER` **لم تكن موجودة مطلقاً** في نظام الشركة الأصلي `F:\HR`! كانت مجرد إضافات ارتجالية غير معتمدة تسللت أثناء تجارب تطويرية غير منضبطة.
2. **حقيقة دور `ADMIN` القديم:** يثبت التعليق الصريح في السطر 7 من كود `F:\HR` أن دور `ADMIN` لم يكن يعني يوماً مديراً عاماً، بل كان يعني حصراً: *«المشرف الميداني / أمين الصرف والمخزن»*. وبناء عليه، فإن تحويله في المنظومة الجديدة إلى مسمى `FIELD_ADMIN` هو استعادة تامة ودقيقة لروحه الوظيفية دون أي تغيير في المهام.
3. **إلغاء دور `EXECUTIVE`:** كان دور `EXECUTIVE` مخصصاً للاطلاع الرقابي غير التنفيذي لمجلس الإدارة. وبناءً على التوجيه المعماري الصريح في PLAN-21، تم توحيد الصلاحيات الرقابية العليا في `SUPER_ADMIN` والتشغيلية الشاملة في `GENERAL_ADMIN`، واستئصال `EXECUTIVE` بالكامل لمنع تسرب البيانات المالية والتشغيلية عبر حسابات غير نشطة.

---

## 4. قائمة مسارات وصفحات المصادقة القديمة وملفات المحاكاة الواجب استئصالها بالكامل (Routes & Mock Files to Eliminate)

لتحقيق المبدأ الدستوري الصارم في PLAN-21 (*«المصادقة الحصرية والسيادية من داخل البوت، وصفر محاكاة أو بيانات وهمية»*)، يتم استئصال وتطهير الملفات التالية:

| المسار البرمجي المستهدف | عدد الأسطر | سبب الحذف والإلغاء |
|---|:---:|---|
| `apps/admin-dashboard/src/app/login/` | **515** سطر | صفحة دخول ويب تقليدية، تفتح ثغرات تخمين وتخالف قصر الدخول على البوت. |
| `apps/admin-dashboard/src/app/api/auth/telegram/` | **299** سطر | معالج مصادقة ويدجت تيليجرام وبيانات `initData` غير الخادمية. |
| `apps/admin-dashboard/src/app/api/auth/twa/` | **19** سطر | إعادة تصدير لمسار `telegram` القديم. |
| `apps/admin-dashboard/src/app/api/auth/otp/` | **15** سطر | نقطة نهاية مهملة لنظام OTP وكلمات المرور المتوقف. |
| `apps/admin-dashboard/src/app/api/auth/magic/` | **320+** سطر | معالج الروابط السحرية القديم غير المسجل خادمياً. |
| `apps/admin-dashboard/src/lib/users.ts` | **70** سطر | يحتوي على كائن `DEMO_USERS` لـ 8 حسابات وهمية بأدوار ملغاة (`EXECUTIVE`, `PROJECT_MANAGER`, `SITE_ENGINEER`, `ACCOUNTANT`, `WORKER`) يُستخدم في محاكاة الصلاحيات ويسرب رتباً محظورة. |

---

### 4.1 ثغرة `middleware.ts` والتحقيق الجنائي في صفحات الإدارة الـ 25 (Broken Access Control Audit)

#### أ. ثغرة الوسيط (`apps/admin-dashboard/src/middleware.ts:13-38`):
يكشف فحص الوسيط الحالي أنه يقتصر على:
```typescript
if (sessionCookie) {
  const payload = await verifySessionToken(sessionCookie);
  if (payload) {
    isAuthenticated = true;
  }
}
if (!isAuthenticated) {
  return NextResponse.redirect(new URL('/login', request.url));
}
```
**الثغرة الجنائية:** الوسيط يفحص فقط `isAuthenticated = true` و**لا يفحص إطلاقاً `payload.role`**!  
إذا نجح مستخدم يحمل رتبة `WORKER` أو `GUEST` أو `SUPPLIER` في الحصول على جلسة مصادقة، فإن الوسيط يسمح له بالعبور لجميع مسارات `/admin/*` دون أي اعتراض!

#### ب. الجرد الميداني لصفحات الإدارة الـ 25 (Zero Role Checks in 18 Pages):
تعتمد لوحة التحكم حالياً على إخفاء الروابط في القائمة الجانبية (`filterNavItemsForUser`) كبديل عن حماية المسارات الفعلية.  
بفحص صفحات لوحة التحكم الـ 25، تبين أن **7 صفحات فقط** تفحص الصلاحية خادمياً، بينما **18 صفحة تفتقر تماماً لأي فحص صلاحيات أو رتبة (`Zero Role Check`)**، مما يتيح التسلل المباشر إليها عبر شريط المتصفح (URL Navigation):

| # | المسار البرمجي للصفحة | فحص الصلاحية الحالي | تقييم الأمان | الإجراء الإلزامي في Phase 3 & 7 |
|:---:|---|:---:|:---:|---|
| 1 | `admin/page.tsx` (المؤشرات العامة) | ❌ لا يوجد | 🔴 مكشوف للجميع | تحويلها لمكون يوجه حسب الدور (`SuperAdmin`, `GeneralAdmin`, `FieldAdmin`) |
| 2 | `admin/settings/page.tsx` (مركز الإعدادات) | ❌ لا يوجد | 🔴 مكشوف | قفل خادمي: حصري لـ `SUPER_ADMIN`, `GENERAL_ADMIN` |
| 3 | `admin/settings/users/page.tsx` (المستخدمين و RBAC) | ❌ لا يوجد | 🔴 **حرج جداً** | قفل خادمي: حصري لـ `SUPER_ADMIN`, `GENERAL_ADMIN` |
| 4 | `admin/settings/audit-vault/page.tsx` (خزينة الرقابة) | ❌ لا يوجد | 🔴 **حرج جداً** | قفل خادمي: حصري لـ `SUPER_ADMIN`, `GENERAL_ADMIN` |
| 5 | `admin/settings/jobs/page.tsx` (مصفوفة الأجور) | ❌ لا يوجد | 🔴 **حرج مالياً** | قفل خادمي: حصري لـ `SUPER_ADMIN`, `GENERAL_ADMIN` |
| 6 | `admin/settings/sites/page.tsx` (المواقع والمشاريع) | ❌ لا يوجد | 🔴 مكشوف | قفل خادمي: حصري لـ `SUPER_ADMIN`, `GENERAL_ADMIN` |
| 7 | `admin/settings/assignments/page.tsx` (إسناد المشرفين) | ❌ لا يوجد | 🔴 مكشوف | قفل خادمي: حصري لـ `SUPER_ADMIN`, `GENERAL_ADMIN` |
| 8 | `admin/settings/company/page.tsx` (الملف المؤسسي) | ❌ لا يوجد | 🔴 مكشوف | قفل خادمي: حصري لـ `SUPER_ADMIN`, `GENERAL_ADMIN` |
| 9 | `admin/settings/ghost-mode/page.tsx` (محاكي الشبح) | ❌ لا يوجد | 🔴 **حرج** | قفل خادمي: حصري لـ `SUPER_ADMIN` فقط |
| 10 | `admin/settings/studio/page.tsx` (استوديو التصحيح) | ❌ لا يوجد | 🔴 **حرج** | قفل خادمي: حصري لـ `SUPER_ADMIN` فقط |
| 11 | `admin/settings/telemetry/page.tsx` (مرصد APM) | ❌ لا يوجد | 🔴 مكشوف | قفل خادمي: حصري لـ `SUPER_ADMIN`, `GENERAL_ADMIN` |
| 12 | `admin/settings/notifications/page.tsx` (التوبيكات) | ❌ لا يوجد | 🔴 مكشوف | قفل خادمي: حصري لـ `SUPER_ADMIN`, `GENERAL_ADMIN` |
| 13 | `admin/workforce/page.tsx` (فهرس العمالة) | ❌ لا يوجد | ⚠️ تحويل تلقائي | حماية التوجيه بالصلاحيات الثلاث المعتمدة |
| 14 | `admin/workforce/directory/page.tsx` (دليل العمال) | ⚠️ أعمدة فقط | 🟡 غير محجوبة | قفل الصفحة خادمياً للأدوار الثلاثة مع حجب الرواتب |
| 15 | `admin/workforce/new/page.tsx` (تعيين عامل جديد) | ❌ لا يوجد | 🔴 مكشوف | قفل الصفحة: `SUPER_ADMIN`, `GENERAL_ADMIN`, `FIELD_ADMIN` |
| 16 | `admin/workforce/clearances/page.tsx` (المخالصات) | ❌ لا يوجد | 🔴 **تسريب مالي** | قفل الصفحة وتطبيق الحجب الخادمي للصافي عن `FIELD_ADMIN` |
| 17 | `admin/workforce/export/page.tsx` (تصدير الكشوفات) | ❌ لا يوجد | 🔴 مكشوف | استبدال المحاكاة بروابط `/api/export/*` المحمية |
| 18 | `admin/layout.tsx` / `dashboard-shell.tsx` | ❌ لا يوجد | 🔴 غلاف مكشوف | قفل الغلاف الأساسي: طرد أي دور غير إداري فوراً |
| 19 | `admin/approvals/page.tsx` | ✅ مفحوص (hasAccess) | 🟢 محمي جزئياً | تحديث الأدوار المسموحة لحذف الأدوار الملغاة |
| 20 | `admin/finance/page.tsx` | ✅ مفحوص (hasAccess) | 🟢 محمي جزئياً | قصر الدخول على `SUPER_ADMIN`, `GENERAL_ADMIN` |
| 21 | `admin/finance/treasury/page.tsx` | ✅ مفحوص (hasAccess) | 🟢 محمي جزئياً | قصر الدخول على `SUPER_ADMIN`, `GENERAL_ADMIN` |
| 22 | `admin/logistics/page.tsx` | ✅ مفحوص (hasAccess) | 🟢 محمي جزئياً | مسموح للأدوار الثلاثة مع تقييد موقع المشرف |
| 23 | `admin/logistics/canteen/page.tsx` | ✅ مفحوص (hasAccess) | 🟢 محمي جزئياً | مسموح للأدوار الثلاثة مع تقييد موقع المشرف |
| 24 | `admin/operations/page.tsx` | ✅ مفحوص (hasAccess) | 🟢 محمي جزئياً | مسموح للأدوار الثلاثة مع تقييد موقع المشرف |
| 25 | `admin/operations/equipment/page.tsx` | ✅ مفحوص (hasAccess) | 🟢 محمي جزئياً | مسموح للأدوار الثلاثة مع تقييد موقع المشرف |

#### ج. المتطلب الدستوري الإلزامي لـ `middleware.ts` و `layout.tsx`:
1. **في `middleware.ts`:**
   - فحص `payload.role`: إذا لم يكن الدور من بين الثلاثي المعتمد (`SUPER_ADMIN`, `GENERAL_ADMIN`, `FIELD_ADMIN`)، يتم الرفض فوراً (`403 Forbidden` أو إعادة توجيه لرابط البوت).
   - توجيه غير المصادق عليهم لرابط البوت العميق: `https://t.me/<BOT_USERNAME>?start=dashboard_access` (صفر إعادة توجيه إلى `/login`).
2. **في `layout.tsx` / `dashboard-shell.tsx`:**
   - تطبيق طبقة دفاع بالعمق (Defense-in-Depth): استدعاء دالة `requireDashboardAccess(user.role)` لضمان عدم تمرير أي طلب غير مرخص حتى لو تم تخطي الوسيط.

---

## 5. قائمة المسارات والمكونات المعمارية الواجب إنشاؤها (Routes & Components to Create)

| المسار أو الملف الجديد | النوع | الوظيفة والدور المعماري في المنظومة |
|---|:---:|---|
| `apps/admin-dashboard/src/app/api/auth/claim/route.ts` | مسار API (POST) | النقطة الذرية الحصرية لاستهلاك رمز الدخول المشفر (صلاحية 5 دقائق، لمرة واحدة)، والتحقق من `jtiHash` في `dashboard_auth_links`، وتوليد جلسة 8 ساعات في `dashboard_sessions`. |
| `apps/admin-dashboard/src/app/api/export/excel/route.ts` | مسار API (GET/POST) | محرك تصدير ملفات Excel معتمد على مكتبة `exceljs` يطبق الحجب الخادمي للرواتب عن `FIELD_ADMIN`. |
| `apps/admin-dashboard/src/app/api/export/pdf/route.ts` | مسار API (GET/POST) | محرك تصدير ملفات PDF الرسمية المروّسة مع الحجب التام للمستحقات التعاقدية. |
| `apps/admin-dashboard/src/app/admin/analytics/page.tsx` | صفحة Next.js | مركز الإحصائيات والتحليلات الموحد الذي يجمع مؤشرات كافة الموديولات (Workforce, Sites, Finance, Logistics). |
| `apps/admin-dashboard/src/lib/analytics-registry.ts` | سجل اكتشاف مركزي | سجل التحليلات الذي يستخرج بطاقات المؤشرات آلياً من عقود الوظائف المركزية في `@alsaada/rbac`. |
| `apps/admin-dashboard/src/app/admin/workforce/[id]/edit/page.tsx` | صفحة تفاعلية | واجهة تعديل بيانات العامل بـ 4 تبويبات (المطابقة للتدفق 01.2.D)، مع قفل تعديل الراتب والبدلات لغير السوبر أدمن. |
| `apps/admin-dashboard/src/components/dashboard/super-admin-overview.tsx` | مكون React خادمي | لوحة المؤشرات الشاملة للسوبر أدمن (مؤشرات الأداء السيادية، الرقابة الجنائية، والروابط التقنية). |
| `apps/admin-dashboard/src/components/dashboard/general-admin-overview.tsx` | مكون React خادمي | لوحة المؤشرات التشغيلية للجينرال أدمن (المواقع، العهد، السلف، المخازن، والقرارات المعلقة). |
| `apps/admin-dashboard/src/components/dashboard/field-admin-overview.tsx` | مكون React خادمي | لوحة المؤشرات الميدانية لمشرف الموقع (محصورة بموقعه المسجل ومحجوبة مالياً بنسبة 100%). |
| `apps/bot-server/src/services/session-monitor.service.ts` | خدمة خادمية في البوت | رصد الجلسات المقاربة على الانتهاء وإرسال إشعار تيليجرام قبل 60 دقيقة بأزرار تمديد (`callback_data` < 64 بايت). |

---

## 6. سياسة الحجب الخادمي الصارم للمستحقات التعاقدية وتسريبات الرواتب والمخالصات (`FIELD_ADMIN` Field Masking Policy)

### 6.1 القاعدة الذهبية للحجب (Zero-Trust Compensation Masking)
مشرف الموقع (`FIELD_ADMIN`) مسؤول ميداني يدير حضور العمال، العهد الميدانية، السلف النقدية المؤقتة، ومسحوبات الكانتين. **يُحظر عليه حظراً قطعياً ومطلقاً** الاطلاع على الرواتب التعاقدية، أجور اليوم، مصفوفة أجور الشركة، أو صافي مخالصات إنهاء الخدمة المالية.

### 6.2 قائمة الحقول المحجوبة 100% (Strictly Masked Fields):
1. `basicSalary` (الراتب الأساسي الشهري التعاقدي).
2. `dailyWage` (الأجر اليومي التعاقدي).
3. `overtimeRate` (أجر الساعة الإضافية).
4. `allowances` / `fixedAllowances` (البدلات الشهرية الثابتة التعاقدية).
5. `totalCompensation` (إجمالي الحزمة المالية التعاقدية).
6. `totalMonthlySalary` (إجمالي الراتب الشهري الشامل).
7. `nationalIdFull` (الرقم القومي المصري المكتمل 14 رقماً؛ يُسمح له فقط برؤية الرقم المقنع `nationalIdMasked` مثل `**********4567`).
8. `minDailyWage` / `defaultDailyWage` / `maxDailyWage` في مصفوفة الوظائف (`JobMatrixItem`).
9. `netSettlementAmount` ومبالغ الجزاءات والمكافآت النقدية في سندات المخالصة (`WorkerClearance`).

---

### 6.3 ثغرة تسريب الرواتب في مصفوفة الوظائف (`/admin/settings/jobs`)
- **الواقع الميداني:**  
  في `apps/admin-dashboard/src/lib/data-fetchers.ts:229-238`، تقوم دالة `getJobMatrixData()` بإرجاع:
  ```typescript
  minDailyWage: Number(j.baseWageGuideline || j.baseSalary),
  maxDailyWage: Number(j.baseSalary) + Number(j.additionalSalary),
  defaultDailyWage: Number(j.baseSalary),
  ```
  وفي `jobs-client.tsx:101, 117, 120`، يتم عرض الأجر الأساسي والاسترشادي لجميع مهن المنشأة دون أي حجب.
- **الإجراء الإلزامي:**
  1. حجب شاشة `/admin/settings/jobs` بالكامل عن مشرف الموقع (`FIELD_ADMIN`).
  2. في حال طلب بيانات المهن من قبل مشرف الموقع (لأغراض التعيين فقط)، يجب إرجاع كود ومسمى المهنة فقط (`id`, `code`, `title`, `category`) مع تصفير أو حذف حقول الأجور (`minDailyWage: undefined`, `defaultDailyWage: undefined`).

---

### 6.4 ثغرة تسريب صافي المخالصات في شاشة إنهاء الخدمة (`/admin/workforce/clearances`)
- **الواقع الميداني:**  
  في `apps/admin-dashboard/src/lib/rbac.ts:63`، تم منح دور `FIELD_ADMIN` تصريح دخول شاشة المخالصات.  
  وفي `data-fetchers.ts:312`، تعيد دالة `getClearancesData()` الحقل `netSettlementAmount: Number(c.netSettlementAmount)` صراحة دون حجب.  
  وفي `clearances-client.tsx:151, 191`، يظهر صافي المخالصة المالي بالجنيه المصري لكل عامل، بالإضافة إلى ظهور مبالغ القرارات والجزاءات بالجنيه (`d.amountOrDays`)، وحاسبة تصفية الأجور بكامل معادلاتها المالية!  
  هذا يخالف جوهر التدفق 01.8 وخطة Master Plan 14 التي نصت حرفياً على: *«المشرف الميداني يرفع تقريراً إجرائياً فقط (مهمات الوقاية والتلفيات) دون أي أرقام مالية نهائياً»*.
- **الإجراء الإلزامي:**
  1. تطبيق دالة الإسقاط الخادمي `projectSafeWorkerFields` على عناصر المخالصات؛ في حال كان الطالب `FIELD_ADMIN`، يتم حذف `netSettlementAmount` وحجب مبالغ الجزاءات والمكافآت (تقتصر على عرض الأيام فقط).
  2. إخفاء تبويب "حاسبة تصفية الأجور" نهائياً عن `FIELD_ADMIN` واقتصارها على السوبر أدمن والجينرال أدمن.

---

### 6.5 آلية الحجب الخادمي (Server-Side Projection)
- **حظر الحجب البصري العميل:** يُمنع تماماً تمرير الكائنات المحتوية على أرقام مالية إلى واجهات المتصفح ثم إخفائها بـ `canViewFinances && <span>...</span>`.
- **دالة الإسقاط الإلزامية في `@alsaada/rbac`:**
  ```typescript
  export function projectSafeWorkerFields<T extends Record<string, any>>(
    worker: T,
    role: string,
    context?: { isSelf?: boolean }
  ): T {
    const cloned = { ...worker };
    if (isFieldMasked(role, 'workforce.compensation.view', 'basicSalary', context)) {
      delete cloned.basicSalary;
      delete cloned.dailyWage;
      delete cloned.overtimeRate;
      delete cloned.allowances;
      delete cloned.fixedAllowances;
      delete cloned.totalCompensation;
      delete cloned.totalMonthlySalary;
      delete cloned.defaultDailyWage;
      delete cloned.minDailyWage;
      delete cloned.maxDailyWage;
      delete cloned.netSettlementAmount;
    }
    if (isFieldMasked(role, 'workforce.worker.view', 'nationalIdFull', context)) {
      delete cloned.nationalIdFull;
    }
    return cloned;
  }
  ```
- تطبق هذه الدالة على كافة نتائج `data-fetchers.ts`، ومسارات API، وملفات Excel، وملفات PDF، وكروت البوت الميدانية.

---

## 7. متطلبات الحوكمة والتحقق الآلي (Governance & Compliance Gates)

لضمان عدم حدوث أي انحراف مستقبلي (Zero Regression)، يتم إلزام المشروع بأربع أدوات حوكمة آلية صارمة:
1. **`tools/governance/verify-rbac-matrix.ts`:**
   - فحص كود الإنتاج والبوت والتأكد من خلوه بنسبة 100% من الكلمات المحظورة (`EXECUTIVE`, `EXECUTIVE_DIRECTOR`, `ACCOUNTANT`, `PROJECT_MANAGER`, `SITE_ENGINEER`).
   - التأكد من حصر مسارات الداشبورد في الأدوار الثلاثة المعتمدة فقط (`SUPER_ADMIN`, `GENERAL_ADMIN`, `FIELD_ADMIN`).
2. **`tools/governance/verify-field-masking.ts`:**
   - تشغيل اختبار اصطناعي جنائي يؤكد إسقاط كافة حقول الرواتب وأجور المهن وصافي المخالصات عند تمرير دور `FIELD_ADMIN`.
3. **`tools/governance/verify-observability-contract.ts`:**
   - التأكد من الصفر التام لاستدعاءات `console.error` والابتلاع الصامت للأخطاء واستبدالها بنظام التتبع الموحد `@alsaada/telemetry`.
4. **`tools/governance/verify-route-guards.ts`:**
   - فحص شجري آلي لجميع ملفات `src/app/admin/**/page.tsx` والتأكد من أن كل مسار يحتوي على تحقق خادمي صريح من الرتبة أو يخضع لحماية `layout.tsx` والوسيط المانع.

---

## 8. الخلاصة وخارطة الطريق للمراحل التالية (Conclusion & Handover)

1. تم استدراك كافة الثغرات والفجوات التي رصدها تقرير التحدي العدائي (Challenger M0_2) ومراجعة (Reviewer M0_2) بنسبة 100%.
2. تم توثيق ثغرات `middleware.ts` والصفحات الـ 18 غير المحمية، وتسريب الأجور في مصفوفة المهن، وتسريب المخالصات لمشرف الموقع، وانحراف أدوار البوت في `Flow 00.12`، ومستخدمي المحاكاة في `users.ts`.
3. يمثل هذا التقرير الوثيقة المرجعية المحصنة والنهائية لاعتماد المرحلة الثانية (Phase 2)، والانطلاق نحو Phase 3 لبناء حزمة الصلاحيات المركزية `@alsaada/rbac`.
