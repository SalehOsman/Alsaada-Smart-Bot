# 📋 خطة العمل رقم 19: التحقيق الجذري لتعطل لوحة التحكم وتجمد البوت، وهندسة منظومة التسجيل الهيكلي وتتبع الأخطاء الموحد
## Master Plan 19: Dashboard & Bot Crash Root Cause Remediation, Enterprise JSON Structured Logging, Unified Trace ID Telemetry & Sensitive Data Redaction Engine

> **الحالة النهائية:** 🟢 **مكتمل وموثق ومُتحقق منه 100% (Completed & Verified)**  
> **تاريخ الاعتماد والإغلاق:** 2026-09-12 | **معرّف الإنجاز (Commit):** `Plan-19-Completion`

> [!IMPORTANT]
> ### 📜 ميثاق الحوكمة والمرجعية المؤسسية (Governance & Baseline SSOT)
> تستند هذه الوثيقة المعمارية العليا إلى القواعد الدستورية الملزمة في `AGENTS.md` و `GEMINI.md` و `docs/00` و `docs/23`، وإلى التوجيه الصريح للمستخدم المؤرخ في **2026-09-12T08:17:15Z** وتوجيه التنفيذ في **2026-09-12T08:50:56Z**:
> 1. **التحقيق الجذري القطعي (Definitive Forensic Proof):** حظر تام لأي تخمينات أو فرضيات غير مثبتة برمجياً؛ إثبات أسباب تعطل خادم Next.js وتجمد استجابة أمر البوت `/dashboard` بالأدلة الجنائية وسجلات قاعدة البيانات الحية وأكواد النواة.
> 2. **منظومة تسجيل وتتبع موحدة (Enterprise Telemetry & Trace ID):** توحيد ربط أحداث البوت بلوحة التحكم عبر معرّف تتبع مشفر موحد (`Trace ID`) ينتقل عبر روابط الدخول والترويسات وسجلات التدقيق.
> 3. **حماية الخصوصية والأسرار (Automated Redaction & NEW-12 Compliance):** حظر مطلق لتسجيل التوكنات، كلمات المرور، أو الأرقام القومية المصرية غير المحجوبة في سجلات النظام أو الـ Telemetry.
> 4. **اكتمال التنفيذ والتحقق (Execution & Verification):** تم تنفيذ كافة المراحل الست واعتماد حزمة `@alsaada/telemetry`، معالجة كاش Next.js، حواجز الأخطاء، تحصين أمر البوت، وتكامل تتبع Trace ID بنجاح 100%.

---

## 📑 الفهرس المعماري (Table of Contents)
- [الملخص التنفيذي والإثبات الجنائي للأعطال (Executive Summary & Forensic Proof)](#-الملخص-التنفيذي-والإثبات-الجنائي-للأعطال-executive-summary--forensic-proof)
- [القسم الأول: هندسة معالجة تصادم كاش Next.js وانهيار HTTP 500](#-القسم-الأول-هندسة-معالجة-تصادم-كاش-nextjs-وانهيار-http-500)
- [القسم الثاني: تدعيم أمر البوت /dashboard ومطابقة معايير أمان تيليجرام HTTPS](#-القسم-الثاني-تدعيم-أمر-البوت-dashboard-ومطابقة-معايير-أمان-تيليجرام-https)
- [القسم الثالث: منظومة التسجيل الهيكلي وتتبع الأثر الموحد عبر Trace ID](#-القسم-الثالث-منظومة-التسجيل-الهيكلي-وتتبع-الأثر-الموحد-عبر-trace-id)
- [القسم الرابع: محرك حجب البيانات الحساسة والأسرار وقاعدة الرقم القومي NEW-12](#-القسم-الرابع-محرك-حجب-البيانات-الحساسة-والأسرار-وقاعدة-الرقم-القومي-new-12)
- [القسم الخامس: استراتيجية حزم المونو ريبو وتحديث قاعدة البيانات (@alsaada/telemetry)](#-القسم-الخامس-استراتيجية-حزم-المونو-ريبو-وتحديث-قاعدة-البيانات-alsaadatelemetry)
- [القسم السادس: خارطة الطريق التنفيذية ومراحل العمل (Phased Implementation Roadmap)](#-القسم-السادس-خارطة-الطريق-التنفيذية-ومراحل-العمل-phased-implementation-roadmap)
- [القسم السابع: مصفوفة التحقق وبوابات الجودة (Verification Matrix & Quality Gates)](#-القسم-السابع-مصفوفة-التحقق-وبوابات-الجودة-verification-matrix--quality-gates)
- [القسم الثامن: مصفوفة الملفات المتأثرة ونطاق التغيير (Blast Radius Matrix)](#-القسم-الثامن-مصفوفة-الملفات-المتأثرة-ونطاق-التغيير-blast-radius-matrix)
- [القسم التاسع: التعهد الرسمي بعدم التعديل الكودي المسبق (Formal Non-Modification Pledge)](#-القسم-التاسع-التعهد-الرسمي-بعدم-التعديل-الكودي-المسبق-formal-non-modification-pledge)

---

## 🔍 الملخص التنفيذي والإثبات الجنائي للأعطال (Executive Summary & Forensic Proof)

أجرى الفريق الهندسي تحقيقاً جنائياً دقيقاً في مسار الأحداث بين خادم البوت (`apps/bot-server`) وخادم لوحة التحكم (`apps/admin-dashboard`)، وتوصل إلى الأدلة القاطعة التالية:

### 1. الإثبات الجنائي لانهيار خادم Next.js بـ `HTTP 500 Internal Server Error`
- **الأعراض المرصودة:** انهيار مسارات لوحة التحكم الإدارية بـ `HTTP 500` وظهور أحد الخطأين في الطرفية:
  1. `Error: Cannot find module '../webpack-runtime.js'` (برمز `MODULE_NOT_FOUND`).
  2. `TypeError: Cannot read properties of undefined (reading '/_app')`.
- **الدليل التقني القاطع من واقع شجرة المشروع ونواة Next.js 15.5.25:**
  1. **مشروع App Router خالص مع غياب تام لـ Pages Router:** مجلد `src/app/` يحتوي على كافة المسارات، ولا يوجد أي مجلد باسم `pages/` على الإطلاق في المشروع.
  2. **غياب حواجز الأخطاء الأصلية (Absence of Error Boundaries):** لا يوجد ملف `global-error.tsx` ولا `error.tsx` ولا `not-found.tsx` داخل `src/app/`.
  3. **تسرب وتصادم ملفات المانيفست داخل مجلد البناء المشترك `.next`:**
     - عند تشغيل أمر البناء `next build`، تولد Next.js حزمة إنتاجية كاملة داخل `.next/` وتنشئ ملف `.next/server/pages-manifest.json` محتوياً على:
       ```json
       {
         "/_app": "pages/_app.js",
         "/_error": "pages/_error.js",
         "/_document": "pages/_document.js"
       }
       ```
     - عند تشغيل خادم التطوير `next dev` لاحقاً دون تنظيف مسبق لمجلد `.next`، يقوم الخادم (`next/dist/server/dev/next-dev-server.js:209`) بتسجيل `PagesRouteMatcherProvider` بشكل غير مشروط وقراءة `pages-manifest.json` المتبقي من الإنتاج، فيفترض الخادم خطأً وجود صفحات Pages Router فعالة.
     - أثناء المعالجة التطويرية عند الطلب (JIT Compilation)، تقوم دالة `writeAppPathsManifest()` بإعادة كتابة `.next/server/app-paths-manifest.json` متضمنة فقط المسار المطلوب في الذاكرة الحالية ومسح باقي الـ 33 مساراً.
     - تصادم كاش ويب باك في `.next/cache/webpack/` حيث يتشارك مجلدا `server-development/` و `server-production/` (المتجاوز 80MB) نفس مسار المخرجات مع اختلاف هاشات الـ Runtime والـ Module IDs الثابتة.
  4. **سلسلة السقوط في معالج الأخطاء القديم (The Execution Crash Chain):**
     - عند حدوث أي خطأ أولي أو طلب مسار لم يترجمه JIT بعد، يسقط خادم Next.js (`base-server.js:1694`) اضطرارياً في استدعاء `findPageComponents({ page: '/_error', isAppPath: false })` لعدم وجود `global-error.tsx`.
     - تحاول دالة `loadComponents` استدعاء `require('.next/server/pages/_app.js')` الذي يحاول استدعاء `../webpack-runtime.js` الإنتاجي المفقود أو غير المتوافق مع رانتيم التطوير، فيسقط بـ `MODULE_NOT_FOUND`.
     - في حال استدعاء `_document.js`، ينفذ السطر 295 محاولة قراءة `nextFontManifest.pages['/_app']` بينما في App Router كائن `pages` غير معرف (`undefined`)، فينهار الخادم بـ `TypeError: Cannot read properties of undefined (reading '/_app')`.

### 2. الإثبات الجنائي لتجمد وصمت استجابة البوت لأمر `/dashboard` (Silent Freeze)
- **الأعراض المرصودة:** يرسل المستخدم أو المدير العام أمر `/dashboard` أو يضغط زر "لوحة التحكم" في البوت، فلا يصدر من البوت أي رد، ولا تظهر أي رسالة خطأ، ويبدو البوت وكأنه متجمد تماماً.
- **الدليل التقني الرقمي القاطع من واقع قاعدة بيانات PostgreSQL الحية (`SystemErrorLog`):**
  - تم استخراج السجل الجنائي الفعلي للحادثة بالاستعلام المباشر:
    * **معرف السجل (UUID):** `dc782838-a308-4c83-a09c-42bfaef04821`
    * **رمز البلاغ المرجعي:** `#ERR-YK85`
    * **مستوى الخطورة:** `CRITICAL`
    * **توقيت الحادثة:** `2026-09-12T07:25:44.470Z`
    * **المستخدم المتأثر:** `7594239391` (المدير العام / SUPER_ADMIN)
    * **الإجراء المسبب:** `msg:/dashboard`
    * **نص الخطأ الحرفي من تيليجرام:**
      ```text
      GrammyError: Call to 'sendMessage' failed! (400: Bad Request: inline keyboard button Web App URL 'http://localhost:3002/login' is invalid: Only HTTPS links are allowed)
          at toGrammyError (...)
          at ApiClient.callApi (...)
          at async handleDashboardCommand (apps/bot-server/src/handlers/dashboard.handler.ts:114:5)
      ```
- **تشريح الخلل المزدوج المسبب للصمت التام:**
  1. **الخلل الأساسي (Telegram API RFC 2818 HTTPS Rejection):**  
     في `apps/bot-server/src/handlers/dashboard.handler.ts` (السطور 94-116)، يقوم المعالج ببناء زر `webApp` لفتح الميني آب:
     ```typescript
     const dashboardBase = (config.dashboardUrl || process.env.DASHBOARD_URL || 'http://localhost:3002').replace(/\/+$/, '');
     const miniAppUrl = `${dashboardBase}/login?token=${token}`;
     const isHttps = dashboardBase.startsWith('https://');
     ...
     const keyboard = new InlineKeyboard()
       .webApp('📱 فتح كـ Mini App داخل تيليجرام', miniAppUrl) // 💥 ينهار هنا إذا كان الرابط http://
     ```
     نظراً لعدم تعيين `DASHBOARD_URL` في بيئة التطوير، يأخذ الرابط القيمة الافتراضية `http://localhost:3002`. وتفرض Telegram Bot API شرطاً صارماً: **روابط أزرار Web App يجب أن تكون مشفرة بـ HTTPS حصراً**. يرفض خادم تيليجرام إرسال الرسالة فورياً بخطأ `400 Bad Request`.
  2. **الخلل الثانوي (Silent Error Swallowing):**  
     المعالج لا يحتوي على حماية `try/catch`، فيتصاعد الخطأ إلى `bot.catch` ومنه إلى `errorVaultService.handleGlobalBotError`.  
     في `apps/bot-server/src/services/error-vault.service.ts` (السطر 267):
     ```typescript
     await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => {});
     ```
     يقوم الرمز `.catch(() => {})` بابتلاع أي فشل في تسليم بطاقة الخطأ للمستخدم صمتاً وتجاهله تماماً. ونتيجة لذلك، لا تصل لوحة التحكم، ولا يصل إشعار الخطأ، فيرى المستخدم صمتاً مطبقاً وتجمداً تاماً للبوت!
  3. **تواطؤ الاختبارات والمحاكاة الزائفة (False Security in Unit Tests):**  
     في ملف `apps/bot-server/tests/dashboard-command.spec.ts` (السطر 359)، تم عمل Mocking ساذج لـ `ctx.reply: vi.fn().mockResolvedValue({})` مما جعل الاختبارات تنجح بنسبة 100% بينما الكود الحقيقي ينهار حتماً بنسبة 100% في البيئة الواقعية.

### 3. الفجوة المعمارية: جزر التسجيل المعزولة وغياب الـ Trace ID
- يعمل البوت وخادم الويب كجزيرتين معزولتين تماماً؛ لا يوجد أي رابط تعقبي يربط طلب المستخدم لأمر `/dashboard` في تيليجرام باستهلاك الرابط السحري في `/api/auth/magic` أو بانهيار صفحة إدارة العمالة في Next.js.
- السجلات الحالية عبارة عن نصوص `console.error` عشوائية وغير مهيكلة، تفتقر لمعرّف تتبع موحد، وتخاطر بتسريب التوكنات وبيانات الهوية في مسارات التكدس (Stack Traces).

---

## 🛠️ القسم الأول: هندسة معالجة تصادم كاش Next.js وانهيار HTTP 500
### Section 1: Next.js Manifest & Webpack Cache Collision Remediation

لإنهاء مشكلة انهيار لوحة التحكم الإدارية بـ `HTTP 500` نهائياً ومنع تداخل كاش البناء مع كاش التطوير، تتضمن الخطة 4 محاور معمارية متزامنة:

### 1.1 التنظيف التلقائي الحتمي للكاش في أوامر التشغيل (`package.json`)
تعديل سكربتات التشغيل في `apps/admin-dashboard/package.json` لضمان عدم تراكم أي كاش قديم قبل انطلاق بيئة التطوير أو حزم الإنتاج:
```json
{
  "scripts": {
    "clean": "rimraf .next .next-dev",
    "predev": "pnpm clean",
    "dev": "next dev -p 3002",
    "prebuild": "pnpm clean",
    "build": "next build",
    "start": "next start -p 3002",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```
*الأثر المعماري:* استئصال فوري لكافة ملفات المانيفست الإنتاجية القديمة (`pages-manifest.json`) قبل أن يبدأ خادم `next dev` بالعمل.

### 1.2 عزل مجلد المخرجات برمجياً في `next.config.ts` (`distDir Isolation`)
تعديل إعدادات Next.js لعزل مجلد مخرجات خادم التطوير عن مجلد مخرجات البناء الإنتاجي بصورة جذرية:
```typescript
const nextConfig: NextConfig = {
  // عزل مجلد البناء التطويري تماماً عن الإنتاجي لمنع تضارب الكاش والمانيفست
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'prisma', '@alsaada/database'],
  transpilePackages: [
    '@alsaada/core-components',
    '@alsaada/regional-engine',
    '@alsaada/national-id-engine',
    '@alsaada/settings',
    '@alsaada/workforce',
    '@alsaada/telemetry',
  ],
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
};
```
*الأثر المعماري:* حتى لو نسي المطور تنظيف الكاش، فإن `next dev` سيكتب ويقرأ من `.next-dev`، بينما `next build` يكتب في `.next`، مما يضمن انعدام التداخل بنسبة 100%.

### 1.3 إنشاء حواجز الأخطاء الأصلية لـ App Router (`Error Boundaries SSOT`)
إنشاء الملفات الثلاثة المعيارية المفقودة داخل `apps/admin-dashboard/src/app/` لمنع Next.js نهائياً من الرجوع إلى معالج `/_error` أو `_document.js` القديم:

1. **معالج الأخطاء الجذري الشامل (`src/app/global-error.tsx`):**
   - يعمل على مستوى الـ Root Layout ويلتقط أي خطأ يقع أثناء تصيير الهيكل الأساسي.
   - يعرض واجهة عربية راقية متوافقة مع هوية الشركة ومزودة برمز تتبع العطل (`Trace ID / Incident Code`) وزر إعادة المحاولة.
2. **معالج أخطاء مسارات لوحة التحكم (`src/app/error.tsx`):**
   - يعالج الأخطاء التشغيلية واستثناءات جلب البيانات داخل مسارات `/admin/*`.
   - يتكامل مع منظومة الـ Telemetry لعرض رمز البلاغ للمستخدم وتسجيل الخطأ مهيكلاً.
3. **معالج الصفحات غير الموجودة (`src/app/not-found.tsx`):**
   - يعالج أخطاء 404 بأسلوب App Router الأصيل مع زر عودة سريع للوحة التحكم.

### 1.4 تدريع أوامر بناء المونو ريبو في جذر المشروع
- التأكد من خلو ملفات `apps/admin-dashboard/.gitignore` من أي تسريب لملفات `.next` و `.next-dev`.
- إضافة فحص تأكيدي في أدوات الحوكمة للتحقق من عدم وجود ملفات مانيفست مشوهة.

---

## 🤖 القسم الثاني: تدعيم أمر البوت /dashboard ومطابقة معايير أمان تيليجرام HTTPS
### Section 2: Telegram Bot /dashboard Command Resilience & Telegram API HTTPS Compliance

للقضاء على مشكلة التجمد والصمت التام في البوت وضمان الامتثال التام لقواعد Telegram Bot API، تتضمن الخطة الإجراءات الهندسية التالية:

### 2.1 حماية زر Mini App بشرط HTTPS الصارم (`isHttps Guard`)
تعديل بناء لوحة الأزرار في `apps/bot-server/src/handlers/dashboard.handler.ts`:
- فحص الرابط: `const isHttps = dashboardBase.startsWith('https://');`
- **في بيئات HTTPS (الإنتاج والسيرفرات الحقيقية):**
  يُضاف زر Mini App وزر المتصفح معاً:
  ```typescript
  const keyboard = new InlineKeyboard();
  if (isHttps) {
    keyboard.webApp('📱 فتح كـ Mini App داخل تيليجرام', miniAppUrl).row();
  }
  keyboard
    .url('🚀 فتح لوحة التحكم بالمتصفح', magicUrl)
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
  ```
- **في بيئات HTTP (بيئة التطوير المحلية `localhost`):**
  **يُستبعد زر `webApp` تماماً من لوحة المفاتيح برمجياً**، ويُكتفى بزر **🚀 فتح لوحة التحكم بالمتصفح** (`url: magicUrl`) مع إضافة تنبيه نصي توضيحي بأن تشغيل Mini App يتطلب نطاقاً مشفراً.
*الأثر المعماري:* القضاء التام على رفض تيليجرام للرسالة برمز `400 Bad Request` واختفاء العطل `#ERR-YK85`.

### 2.2 تحصين معالج أمر لوحة التحكم بكتلة `try/catch` متينة
تطويق عمليات الإرسال في `handleDashboardCommand` بكتلة معالجة أخطاء ذكية:
- في المحادثات الخاصة: محاولة إرسال الرسالة الغنية، وفي حال حدوث أي استثناء من تيليجرام، إرسال رسالة نصية مبسطة تحتوي على الرابط السحري الخام لضمان عدم حرمان المدير من الوصول.
- في المحادثات الجماعية: معالجة دقيقة لحالات فشل الإرسال بالخاص والتفريق بين عطل النظام وبين قيود خصوصية المستخدم.

### 2.3 استئصال الابتلاع الصامت للأخطاء في `errorVaultService`
تعديل `apps/bot-server/src/services/error-vault.service.ts`:
- استبدال نمط `parse_mode: 'Markdown'` بـ `parse_mode: 'HTML'` مع دالة `escapeHtml` لحماية الرسائل من انهيارات مفسر الكيانات (#ERR-A62P).
- استبدال الابتلاع الصامت `.catch(() => {})` بـ **بديل نصي مجرد (Plain Text Fallback)** لا يستخدم أي Parse Mode ولا يعتمد على أزرار معقدة حال تعذر إرسال البطاقة الغنية:
  ```typescript
  try {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (primaryErr) {
    // بديل فوري مجرد لمنع الصمت التام
    const fallbackText = `⚠️ حدث خطأ غير متوقع أثناء معالجة طلبك.\nرمز البلاغ: ${savedLog.errorReference}\nيرجى إبلاغ الدعم الفني.`;
    await ctx.reply(fallbackText).catch((fatalErr) => {
      process.stderr.write(`FATAL: Failed to send fallback error message: ${fatalErr}\n`);
    });
  }
  ```

### 2.4 تطوير وتحديث الاختبارات الآلية (`dashboard-command.spec.ts`)
إلغاء الـ Mocking السطحي وإضافة سيناريوهين للاختبار الميداني الصارم:
1. **سيناريو بيئة HTTP:** التحقق البرمجي الصارم من أن مصفوفة أزرار لوحة المفاتيح **لا تحتوي على أي زر من نوع `web_app`** إطلاقاً.
2. **سيناريو بيئة HTTPS:** التحقق من وجود زر `web_app` وأن رابطه يبدأ بـ `https://`.

---

## 📡 القسم الثالث: منظومة التسجيل الهيكلي وتتبع الأثر الموحد عبر Trace ID
### Section 3: Enterprise JSON Structured Logging Engine & Unified Trace ID Architecture

بناء محرك تسجيل هيكلي متكامل للأخطاء والعمليات، يربط أحداث النظام عبر المعرّف المشفر الموحد `Trace ID`:

### 3.1 هيكل البيانات المعياري للسجلات (JSON Log Schema)
تتوافق منظومة السجلات مع معايير OpenTelemetry و RFC 5424 وتتضمن الحقول الحيوية التالية:

| الحقل | النوع | الوصف والأهمية |
| :--- | :--- | :--- |
| `timestamp` | `string` (ISO-8601 UTC) | الطابع الزمني الدقيق بالمللي ثانية (مثال: `2026-09-12T11:20:00.123Z`). |
| `level` | `enum` | مستوى السجل (`debug`, `info`, `warn`, `error`, `fatal`). |
| `traceId` | `string` (UUIDv4) | معرّف التتبع الموحد الذي يربط أحداث البوت بأحداث لوحة التحكم وقاعدة البيانات. |
| `spanId` | `string` (اختياري) | معرّف العملية الفرعية الحالية لقياس أزمنة الأداء المتداخلة. |
| `parentSpanId`| `string` (اختياري) | معرّف العملية الأب للربط الشجري. |
| `service` | `enum` | اسم الخدمة المصدرة (`bot-server` أو `admin-dashboard` أو `worker-job`). |
| `environment`| `enum` | بيئة التشغيل (`development`, `production`, `test`). |
| `version` | `string` | إصدار المنظومة (`2.0.0-alpha.1`). |
| `component` | `string` | المكون البرمجي الداخلي (مثل: `bot:handler:dashboard`, `api:auth:magic`). |
| `action` | `string` | الإجراء التنفيذي المحدد (مثل: `/dashboard`, `AUTH_MAGIC_CONSUMED`). |
| `actor` | `object` | بيانات الهوية: `role`, `userId`, `telegramId`, `siteId`, `ipAddress`. |
| `durationMs` | `number` | زمن استغراق العملية بالمللي ثانية لقياس الأداء واكتشاف الاختناقات. |
| `payload` | `object` | معطيات العملية بعد تنقيتها وحجب كافة البيانات الحساسة منها. |
| `error` | `object` | تفاصيل الخطأ: `name`, `message`, `code`, و `stack` بعد تطهيرها من الأسرار. |

### 3.2 دورة حياة معرّف التتبع الموحد (End-to-End Trace ID Lifecycle)
يمر الـ `Trace ID` بدورة حياة محكمة تربط طرفي المنظومة:

```
[مستخدم تيليجرام]
       │
       │ (1) إرسال أمر /dashboard
       ▼
┌────────────────────────────────────────────────────────────────────────┐
│ خادم البوت (apps/bot-server)                                           │
│ 1. ميدلوير التتبع (telemetryMiddleware):                                │
│    - توليد traceId مشفر = crypto.randomUUID()                          │
│    - ربط المعرف بسياق التنفيذ عبر AsyncLocalStorage                     │
│ 2. معالج لوحة التحكم (dashboard.handler.ts):                           │
│    - تضمين traceId داخل حمولة التوكن MagicTokenPayload                  │
│    - تمرير traceId كمعامل في الروابط:                                  │
│      magicUrl: /api/auth/magic?token=...&traceId={traceId}             │
│      miniAppUrl: /login?token=...&traceId={traceId}                    │
│ 3. تسجيل حدث إرسال الرابط في السجلات متضمناً traceId                    │
└────────────────────────────────────────────────────────────────────────┘
       │
       │ (2) نقر رابط المتصفح أو فتح الـ Mini App
       ▼
┌────────────────────────────────────────────────────────────────────────┐
│ خادم لوحة التحكم (apps/admin-dashboard)                                │
│ 1. ميدلوير الحافة (middleware.ts):                                     │
│    - استخراج traceId من معاملات الرابط (?traceId=...) أو ترويسة الطلب  │
│    - حقن الترويسات للطبقات اللاحقة:                                     │
│      x-trace-id: {traceId}                                             │
│      traceparent: 00-{traceId}-0000000000000001-01 (W3C standard)      │
│    - تمرير traceId في ترويسات الاستجابة للمتصفح                        │
│ 2. معالج الرابط السحري (/api/auth/magic/route.ts):                     │
│    - تسجيل استهلاك التوكن في السجل الهيكلي بنفس الـ traceId            │
│    - تضمين traceId في سجل التدقيق الجنائي AuditLog في قاعدة البيانات  │
│ 3. مكونات الخادم وتفاعل الصفحات (RSC & Server Actions):               │
│    - قراءة x-trace-id وتضمينه في كافة الاستعلامات                      │
│ 4. حواجز الأخطاء (error.tsx & global-error.tsx):                       │
│    - في حال حدوث عطل، يُعرض للمستخدم رمز بلاغ مشتق:                    │
│      "رمز تتبع العطل: TRC-9B1DEB4D" لمشاركته مع الدعم الفني             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 القسم الرابع: محرك حجب البيانات الحساسة والأسرار وقاعدة الرقم القومي NEW-12
### Section 4: Automated Secret & Sensitive Data Redaction Engine

حظر مطلق لتسريب أي بيانات أمنية أو شخصية حساسة داخل السجلات وسلاسل الأخطاء:

### 4.1 القائمة السوداء التلقائية للمفاتيح (Key-Based Blacklist)
فحص ذاتي تكراري (`Recursive Sanitization`) لكافة الكائنات والمصفوفات والأخطاء قبل تحويلها إلى JSON، مع حماية متقدمة ضد المراجع الدائرية (`WeakSet`). يتم استبدال قيمة أي مفتاح يطابق النمط التالي بـ `"[REDACTED]"`:
```typescript
const SENSITIVE_KEY_PATTERN =
  /^(.*_)?(token|secret|password|passwd|pwd|key|auth|bearer|credential|cookie|session|signature|hash|init_?data|salt|phone_?encrypted|national_?id_?encrypted)(_.*)?$/i;
```
المفاتيح المشمولة تلقائياً:
- `botToken`, `BOT_TOKEN`, `TELEGRAM_BOT_TOKEN`.
- `databaseUrl`, `DATABASE_URL`, `redisUrl`.
- `databaseEncryptionKey`, `SESSION_SECRET`, `JWT_SECRET`.
- `password`, `userPassword`, `alsaada_session`, `cookie`, `authorization`.
- `googlePrivateKey`, `GEMINI_API_KEY`, `initData`.

### 4.2 محرك التطهير بالأنماط القياسية (Value-Based Regex Sanitizer)
تطهير النصوص ورسائل الأخطاء ومكدس الاستدعاءات (`Stack Trace`) من القيم الحساسة:
1. **توكنات تيليجرام:** المطابقة لنمط `\b\d{8,10}:[A-Za-z0-9_-]{35}\b` واستبدالها بـ `[REDACTED_BOT_TOKEN]`.
2. **بيانات اتصال قواعد البيانات:** استبدال كلمات المرور في روابط `postgresql://user:pass@host/db` بـ `[REDACTED_PASSWORD]`.
3. **توكنات JWT والروابط السحرية:** استبدال حمولات التشفير والتوكنات الطويلة بـ `[REDACTED_JWT]` و `[REDACTED_MAGIC_TOKEN]`.
4. **أرقام الهواتف:** حجب الأرقام المتوسطة: `010****1234`.

### 4.3 سياسة حجب الرقم القومي المصري والامتثال لقاعدة `NEW-12`
1. **الحجب الصارم في السجلات والتتبع (Zero Telemetry Exposure):**
   - يُحظر تماماً ظهور الرقم القومي المصري (14 رقماً) غير محجوب في أي سجل طرفية، أو ملف خطأ، أو مكدس استدعاء، أو رسالة APM.
   - يظهر الرقم القومي دائماً بالصيغة المحجوبة جزئياً: `298********1234` (إظهار قرن وسنة الميلاد وآخر 4 أرقام للتدقيق البرمجي، وحجب الأرقام الثمانية الوسطى).
2. **استثناء العرض المعتمد للسوبر أدمن (`NEW-12`):**
   - يُقصر فك الحجب وعرض الرقم القومي كاملاً حصراً على واجهات المستخدم المحمية في لوحة التحكم ولأدوار معتمدة حصراً (`SUPER_ADMIN`, `GENERAL_ADMIN`, `ACCOUNTANT`).
   - يُخزن الرقم القومي في قاعدة البيانات مشفراً بـ AES-256-GCM.
   - أي عملية فك تشفير للاستعراض تسجل فوراً في جدول `AuditLog` كإجراء `NATIONAL_ID_UNMASKED_VIEW` مع تسجيل معرف الأدمن الفاعل والـ `traceId` النشط.

---

## 📦 القسم الخامس: استراتيجية حزم المونو ريبو وتحديث قاعدة البيانات (@alsaada/telemetry)
### Section 5: Monorepo Package Integration Strategy & Database Harmonization

### 5.1 إنشاء الحزمة المستقلة `@alsaada/telemetry` في `packages/telemetry`
- **المبرر المعماري للاستقلال:**
  - صفر تبعيات داخلية (`Zero Internal Monorepo Dependencies`): الحزمة تعتمد حصراً على مكتبات Node.js المعيارية (`node:crypto`, `node:async_hooks`, `node:os`, `node:process`).
  - صفر اعتماد على محركات الواجهة أو التليجرام: تجنب تضخيم حزم ويب Next.js وضمان التوافق مع بيئة Edge Runtime.
  - تجنب الحلقات التكرارية (`Zero Circular Dependencies`): تتيح لكافة الموديولات والحزم وتطبيقات الـ Apps استيراد المسجل دون أي تعارض معماري.
- **محتويات الحزمة:**
  - `src/types.ts`: الأنواع الصارمة للسجلات والهوية ومستويات الخطورة.
  - `src/constants.ts`: القوائم السوداء والأنماط التعبيرية للحجب.
  - `src/redaction.ts`: دوال الحجب التكراري وتطهير السلاسل والأخطاء.
  - `src/context.ts`: إدارة السياق عبر `AsyncLocalStorage` ودوال استخراج `traceId`.
  - `src/logger.ts`: صنف `TelemetryLogger` لكتابة سطور JSON القياسية في `stdout` و `stderr`.
  - `src/adapters/grammy.ts`: ميدلوير الربط التلقائي مع بوت التيليجرام.
  - `src/adapters/next.ts`: دوال استخراج وحقن الترويسات في Next.js Middleware.
  - `src/index.ts`: نقطة التصدير الموحدة.

### 5.2 تحديثات نموذج قاعدة البيانات (`packages/database/prisma/schema.prisma`)
تعديل طفيف وغير كاسر (`Non-breaking Schema Harmonization`) لربط جداول الرصد بالـ `Trace ID`:

1. **تحديث جدول سجل الأخطاء `SystemErrorLog`:**
   ```prisma
   model SystemErrorLog {
     id              String    @id @default(uuid())
     traceId         String?   @db.VarChar(36) // معرّف التتبع الموحد
     service         String    @default("bot-server") // الخدمة المصدرة
     errorReference  String    @unique
     errorHash       String
     occurrenceCount Int       @default(1)
     actorTelegramId BigInt?
     actorRole       String?
     actionTrigger   String?
     sourceLocation  String?
     errorMessage    String
     stackTrace      String?
     breadcrumbs     Json?
     severity        String    @default("ERROR")
     isResolved      Boolean   @default(false)
     resolvedAt      DateTime?
     resolvedById    BigInt?
     createdAt       DateTime  @default(now())
     lastSeenAt      DateTime  @default(now())

     @@index([traceId])
     @@index([service, createdAt])
     @@index([severity, createdAt])
     @@index([errorHash, isResolved])
     @@map("system_error_logs")
   }
   ```

2. **تحديث جدول سجل التدقيق `AuditLog`:**
   ```prisma
   model AuditLog {
     id              String   @id @default(uuid())
     traceId         String?  @db.VarChar(36) // معرّف التتبع الموحد
     actorTelegramId BigInt
     action          String
     entityType      String
     entityId        String
     beforePayload   Json?
     afterPayload    Json?
     ipAddress       String?
     timestamp       DateTime @default(now())

     @@index([traceId])
     @@index([entityType, entityId])
     @@index([actorTelegramId, timestamp])
     @@map("audit_logs")
   }
   ```

---

## 🚀 القسم السادس: خارطة الطريق التنفيذية ومراحل العمل (Phased Implementation Roadmap)
### Section 6: Phased Execution Steps

تتبع عملية التنفيذ 6 مراحل هندسية متسلسلة بدقة متناهية:

```
┌────────────────────────────────────────────────────────────────────────┐
│ المرحلة 1: بناء حزمة @alsaada/telemetry واختباراتها المستقلة            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ المرحلة 2: معالجة كاش Next.js وبناء حواجز الأخطاء (App Router Boundaries)│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ المرحلة 3: تحصين أمر البوت /dashboard وإصلاح errorVaultService         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ المرحلة 4: ربط Next.js Middleware واستخراج وحقن ترويسات Trace ID       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ المرحلة 5: تحديث Prisma Schema ومزامنة قاعدة البيانات                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ المرحلة 6: التحقق الشامل من الربط واجتياز بوابات الحوكمة 100%          │
└────────────────────────────────────────────────────────────────────────┘
```

### تفصيل بنود المراحل التنفيذية:
- **المرحلة 1: تأسيس حزمة التتبع (`packages/telemetry`):**
  - إنشاء مجلد الحزمة وهيكليتها وملف `package.json` و `tsconfig.json`.
  - برمجة محرك الحجب والتطهير `redaction.ts` واختباره ضد كافة الأنماط (توكنات، روابط، أرقام قومية).
  - برمجة `logger.ts` و `context.ts` وميدلوير التليجرام ومحولات Next.js.
  - كتابة اختبارات الوحدة للحزمة والتأكد من تغطيتها 100%.
- **المرحلة 2: معالجة خادم لوحة التحكم (`apps/admin-dashboard`):**
  - تعديل `package.json` لإضافة سكربتات `clean` و `predev` و `prebuild`.
  - تعديل `next.config.ts` لضبط `distDir` المعزول للتطوير (`.next-dev`).
  - إنشاء `src/app/global-error.tsx` و `src/app/error.tsx` و `src/app/not-found.tsx`.
- **المرحلة 3: تحصين خادم البوت (`apps/bot-server`):**
  - استيراد حزمة التتبع `@alsaada/telemetry`.
  - تعديل `dashboard.handler.ts` لتقييد زر الـ Mini App بشرط `isHttps` وإلغائه في HTTP، وتطويق المعالج بـ `try/catch`.
  - تعديل `errorVaultService.ts` للتحول إلى HTML واستبدال الابتلاع الصامت ببديل نصي مجرد آمن.
  - تحديث اختبارات `dashboard-command.spec.ts` لتغطية حالتي HTTP و HTTPS.
- **المرحلة 4: تكامل تتبع لوحة التحكم:**
  - تحديث `apps/admin-dashboard/src/middleware.ts` لاستخراج `traceId` من الرابط أو الترويسات وحقنها للطلبات اللاحقة.
  - تحديث `/api/auth/magic/route.ts` لاعتماد `traceId` وتسجيل عملية الاستهلاك مهيكلة.
  - ربط حواجز الأخطاء لعرض رمز البلاغ المشتق من `traceId`.
- **المرحلة 5: تحديث وتوافق قاعدة البيانات:**
  - إضافة حقول `traceId` و `service` إلى `schema.prisma`.
  - تطبيق التحديث عبر Prisma، وتحديث دوال `recordError` و `AuditLog.create` لتسجيل `traceId`.
- **المرحلة 6: التحقق والحوكمة:**
  - تشغيل الاختبارات الآلية عبر كافة الحزم.
  - التحقق الميداني من سيناريو الربط بين البوت ولوحة التحكم.
  - تشغيل فواحص الحوكمة الشاملة وضمان نظافة المستودع بنسبة 100%.

---

## 🎯 القسم السابع: مصفوفة التحقق وبوابات الجودة (Verification Matrix & Quality Gates)
### Section 7: Verification Matrix & Quality Gates

| رقم البوابة | المعيار المستهدف | الأمر البرمجي للتحقق | النتيجة المتوقعة للقبول |
| :---: | :--- | :--- | :--- |
| **G1** | فحص التايب سكريبت الصارم | `pnpm typecheck` (أو فحص الحزم المعنية) | 0 errors عبر كافة الحزم (Exit 0) |
| **G2** | اختبارات حزمة التتبع المستقلة | `pnpm --filter @alsaada/telemetry test` | نجاح 100% لكافة اختبارات الحجب والسياق |
| **G3** | اختبارات خادم البوت المحدثة | `pnpm --filter @alsaada/bot-server test` | نجاح 100% وتأكيد استبعاد زر webApp في HTTP |
| **G4** | اختبارات لوحة التحكم | `pnpm --filter @alsaada/admin-dashboard test` | نجاح 100% لكافة اختبارات الميدلوير والمسارات |
| **G5** | بناء لوحة التحكم النظيف | `pnpm --filter @alsaada/admin-dashboard build` | Exit 0 دون أي تعارض في المانيفست |
| **G6** | التحقق الشامل من الربط (Trace Link) | محاكاة أمر `/dashboard` ثم طلب `/api/auth/magic` | تطابق كامل لقيمة `traceId` في كلا السجلين |
| **G7** | بوابات الحوكمة ومنع التلويث | `pnpm arch:verify && pnpm migration:verify` | Pass Code 0 ونظافة تامة للجذر (`git status -s`) |

---

## 🗺️ القسم الثامن: مصفوفة الملفات المتأثرة ونطاق التغيير (Blast Radius Matrix)
### Section 8: Blast Radius & Affected Files Matrix

| المسار البرمجي للملف | نوع الإجراء | الحزمة / التطبيق | مستوى الأثر والمخاطر | الغرض الأساسي من التعديل |
| :--- | :---: | :--- | :---: | :--- |
| `packages/telemetry/package.json` | 🟢 إنشاء جديد | `@alsaada/telemetry` | منخفض (معزول) | تأسيس الحزمة وتحديد التصديرات الصارمة |
| `packages/telemetry/src/*` | 🟢 إنشاء جديد | `@alsaada/telemetry` | منخفض (معزول) | كتابة محرك التتبع والحجب والتسجيل الهيكلي |
| `packages/telemetry/tests/*` | 🟢 إنشاء جديد | `@alsaada/telemetry` | منخفض (معزول) | اختبارات وحدة للحجب والـ AsyncLocalStorage |
| `apps/admin-dashboard/package.json` | 🟡 تعديل | `admin-dashboard` | منخفض | إضافة سكربتات التنظيف التلقائي للكاش |
| `apps/admin-dashboard/next.config.ts` | 🟡 تعديل | `admin-dashboard` | متوسط | ضبط عزل مجلد البناء التطويري `.next-dev` |
| `apps/admin-dashboard/src/app/global-error.tsx` | 🟢 إنشاء جديد | `admin-dashboard` | متوسط | حاجز الأخطاء الشامل لـ App Router |
| `apps/admin-dashboard/src/app/error.tsx` | 🟢 إنشاء جديد | `admin-dashboard` | متوسط | حاجز أخطاء لوحة التحكم مع عرض Trace ID |
| `apps/admin-dashboard/src/app/not-found.tsx` | 🟢 إنشاء جديد | `admin-dashboard` | منخفض | صفحة 404 معيارية لـ App Router |
| `apps/admin-dashboard/src/middleware.ts` | 🟡 تعديل | `admin-dashboard` | متوسط | استخراج وحقن ترويسات `x-trace-id` |
| `apps/admin-dashboard/src/app/api/auth/magic/route.ts` | 🟡 تعديل | `admin-dashboard` | متوسط | اعتماد `traceId` وتسجيل استهلاك التوكن |
| `apps/bot-server/src/handlers/dashboard.handler.ts` | 🟡 تعديل | `bot-server` | عالي (أمان وحصانة) | تقييد زر Mini App بـ HTTPS وإضافة try/catch |
| `apps/bot-server/src/services/error-vault.service.ts` | 🟡 تعديل | `bot-server` | عالي (استقرار) | إزالة الابتلاع الصامت واعتماد الرد المجرد |
| `apps/bot-server/tests/dashboard-command.spec.ts` | 🟡 تعديل | `bot-server` | منخفض | اختبار بيئتي HTTP و HTTPS بصرامة |
| `packages/database/prisma/schema.prisma` | 🟡 تعديل | `@alsaada/database` | عالي (هيكل بيانات) | إضافة أعمدة `traceId` و `service` للفهارس |

---

## ✋ القسم التاسع: التعهد الرسمي بعدم التعديل الكودي المسبق (Formal Non-Modification Pledge)
### Section 9: Formal Non-Modification Pledge

> [!CAUTION]
> **إقرار وتعهد هندسي ملزم (Binding Architectural Undertaking):**  
> يقر الفريق الهندسي وكافة الوكلاء بالتعهد الصارم التالي:
> 1. **الالتزام بوضعية القراءة فقط (Strict Read-Only Mode):** لم يتم تعديل أو حذف أو كتابة أي سطر كودي في أي ملف تطبيقي أو تنفيذي داخل `packages/*` أو `modules/*` أو `apps/*` خلال مرحلة التحقيق وإعداد هذه الخطة.
> 2. **حظر الانتقال للتنفيذ دون تصريح مستخدم صريح:** ظلت هذه الوثيقة خطة معمارية مقترحة وشاملة مودعة في `docs/work-plans/` حتى تم تعميدها صراحة.
> 3. **التعميد والاعتماد والتنفيذ المكتمل (Ratification & Execution Completed):** تم اعتماد الخطة صراحة بتوجيه المستخدم المؤرخ في **2026-09-12T08:50:56Z**، ونُفذت كافة المراحل الست بنجاح واجتازت كافة بوابات الجودة G1 - G7 بنسبة 100%، وسُجلت بالرمز `Plan-19-Completion`.
