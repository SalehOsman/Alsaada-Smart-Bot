# خطة عمل 44: معالجة إخفاق بناء حاوية لوحة التحكم في دوكر والتحويل الديناميكي المعماري (Dashboard Docker Build SSG Remediation & Build-Time Hardening)

> **الحالة:** 🟡 قيد المراجعة والاعتماد (Draft & Review)  
> **التاريخ:** 16 سبتمبر 2026  
> **المرجعية الدستورية:** ميثاق الحوكمة `AGENTS.md` (البند 1.5، البند 2.1، البند 3.1)  
> **النطاق:** `apps/admin-dashboard`, `docker/Dockerfile.dashboard`, `docker/Dockerfile`  

---

## 1️⃣ السياق والمشكلة التقنية (Problem Statement)

أثناء بناء حاويات دوكر للنظام عبر `docker compose up --build`، تظهر الأخطاء التالية في الترمينال أثناء مرحلة بناء لوحة التحكم الإدارية:
```text
#124 67.54 error: Environment variable not found: DATABASE_URL.
#124 67.54 Validation Error Count: 1
#124 67.54 prisma:error
#124 67.54 Invalid `prisma.site.findMany()` invocation:
#124 67.54 Generating static pages (23/31)
#124 67.54 Error fetching job matrix: Error [PrismaClientInitializationError]:
#124 67.54 Invalid `prisma.jobTitle.findMany()` invocation:
#124 67.54 at async l (.next/server/app/admin/settings/notifications/page.js:2:10158)
```

### التحليل المعماري للمشكلة:
1. **Next.js 15 SSG Default:** يحاول Next.js أثناء مرحلة `next build` توليد صفحات لوحة التحكم مسبقاً كصفحات ثابتة (SSG).
2. **استعلامات قاعدة البيانات أثناء البناء:** صفحات الإعدادات والعمال (`notifications`, `jobs`, `sites`, `workforce`) تستدعي Prisma مباشرة في مكونات الخادم.
3. **عزل بيئة البناء في دوكر:** أثناء بناء الصورة (`docker build`)، لا تتوفر قاعدة بيانات مشغلة، كما يُحظر أمنياً تمرير كلمات المرور وسلاسل الاتصال الحقيقية لطبقات الصور.
4. **تأثير البوت:** تأثير صفري (0%)، حيث أن البوت مبني في حاوية منفصلة وبمحرك Node.js/TypeScript لا يقوم بأي SSG.

---

## 2️⃣ الأهداف المعمارية للخطة (Architectural Goals)

1. **التحويل الصريح للنمط الديناميكي (Enforce Force-Dynamic SSR):**
   - إلزام Next.js بمعاملة كافة مسارات لوحة التحكم كمسارات ديناميكية تُنفذ على الخادم عند الطلب اللحظي عبر `export const dynamic = 'force-dynamic'`.
   - منع Next.js نهائياً من محاولة الاتصال بقاعدة البيانات أو توليد صفحات ثابتة أثناء الـ Build.

2. **تأمين بيئة البناء وعزل المتغيرات (Build-Time Environment Isolation):**
   - تزويد مرحلة الـ Builder في `docker/Dockerfile.dashboard` و `docker/Dockerfile` بقيمة افتراضية وهمية آمنة لمتغير `DATABASE_URL` لضمان نجاح أي استدعاء لفحص Schema أو Prisma Client أثناء التجميع.
   - تعطيل القياس عن بُعد `NEXT_TELEMETRY_DISABLED=1` لتسريع البناء ومنع الاتصالات الخارجية غير المرغوبة.

3. **الحفاظ على الأداء وسلامة الصلاحيات (RBAC & Fresh Data Integrity):**
   - ضمان أن صفحات الإدارة تعرض دائماً أحدث البيانات الحية للمشرفين مع التحقق الدقيق من الصلاحيات والموقع الجغرافي (`assignedSiteId`).

---

## 3️⃣ البنود التنفيذية التفصيلية (Implementation Tasks)

### البند 1: تطبيق التحويل الديناميكي في Next.js Dashboard
- [ ] تعديل [`apps/admin-dashboard/src/app/layout.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/app/layout.tsx):
  - إضافة `export const dynamic = 'force-dynamic';`
- [ ] تعديل [`apps/admin-dashboard/src/app/admin/layout.tsx`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/app/admin/layout.tsx):
  - إضافة `export const dynamic = 'force-dynamic';` كصمام أمان لمسار الإدارة بالكامل.

### البند 2: تحصين ملفات Dockerfile لمرحلة البناء
- [ ] تعديل [`docker/Dockerfile.dashboard`](file:///f:/Alsaada-Smart-Bot/docker/Dockerfile.dashboard):
  - إضافة `ENV DATABASE_URL="postgresql://build_placeholder:dummy@127.0.0.1:5432/build_db?schema=public"` و `ENV NEXT_TELEMETRY_DISABLED=1` في مرحلة الـ builder.
  - إضافة `ENV NEXT_TELEMETRY_DISABLED=1` في مرحلة الـ runner.
- [ ] فحص [`docker/Dockerfile`](file:///f:/Alsaada-Smart-Bot/docker/Dockerfile):
  - التأكد من سلامة مرحلة توليد Prisma Client.

---

## 4️⃣ خطة التحقق والاختبار (Verification Matrix)

1. **التحقق من الأنواع البرمجية (Typecheck):**
   - تشغيل `pnpm --filter @alsaada/admin-dashboard typecheck` للتأكد من خلو المشروع من أي أخطاء تجميع (`Exit 0`).
2. **التحقق من الاختبارات الآلية (Unit/Integration Tests):**
   - تشغيل `pnpm --filter @alsaada/admin-dashboard test` والتأكد من نجاح الـ 206 اختبارات بنسبة 100%.
3. **التحقق من نجاح بناء Next.js محلياً (Next Build Verification):**
   - تشغيل `pnpm --filter @alsaada/admin-dashboard build` للتحقق من اختفاء أخطاء SSG وتوليد كافة المسارات كـ `ƒ (Dynamic)` بنجاح تام.
4. **التحقق الحاكم للمشروع (Governance Verification):**
   - تشغيل `pnpm governance:tamper-check` للتأكد من سلامة الحوكمة وعدم المساس بأي ملف محمي تشفيرياً.
