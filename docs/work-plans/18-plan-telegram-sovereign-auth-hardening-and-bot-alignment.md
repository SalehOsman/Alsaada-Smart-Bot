# 📋 خطة العمل رقم 18: تأمين ومعالجة مصادقة تيليجرام السيادية وربط البوت الرسمي
## Master Plan 18: Sovereign Telegram Authentication Hardening, Official Bot Alignment & Zero Bot Handle Public Exposure

> [!IMPORTANT]
> **ميثاق الحوكمة والمرجعية المؤسسية (Governance & Baseline SSOT):**
> تستند هذه الخطة المعمارية إلى التوجيهات الصريحة للمستخدم:
> 1. البوت الرسمي المعتمد للمنظومة هو: `@Al_Saada_smart_bot`.
> 2. يُحظر تماماً كتابة أو إظهار اسم البوت أو روابط مباشرة له في صفحة تسجيل الدخول لأسباب أمنية وتشغيلية صارمة لمنع استهداف البوت من أي أطراف مجهولة.
> 3. توفير بيئة عمل آمنة ومغلقة تعتمد على مسارين حصريين للدخول:
>    - الفتح المباشر من داخل تيليجرام كـ Mini App مع التحقق التلقائي الصامت من `initData`.
>    - طلب الرابط السحري المؤقت (Magic Link - 5 دقائق) حصراً بإرسال الأمر `/dashboard` من داخل محادثة البوت المعتمد.

---

### 1️⃣ الأهداف والبنود التنفيذية التفصيلية (Core Deliverables)

#### البند 1: توحيد تكوين البوت الرسمي (`@Al_Saada_smart_bot`)
- إضافة `BOT_USERNAME=Al_Saada_smart_bot` إلى ملف البيئة الرئيسي `.env`.
- تحديث القيمة الاحتياطية في `apps/bot-server/src/config/env.ts` لتشير إلى `Al_Saada_smart_bot`.
- تزويد `apps/admin-dashboard` بمتغيرات البيئة اللازمة محلياً (`apps/admin-dashboard/.env.local`) وتحميل جذر `.env` في `next.config.ts`.

#### البند 2: تأمين صفحة تسجيل الدخول وحجب اسم البوت (Zero Bot Handle Exposure)
- تعديل `apps/admin-dashboard/src/app/login/page.tsx`:
  * إزالة أي متغير أو نص أو رابط يحتوي على اسم البوت أو يقود إليه (`tg://resolve?domain=...` و `https://t.me/...`).
  * الاحتفاظ بالتحقق التلقائي الصامت من `initData` لمستخدمي Telegram Mini App.
  * توجيه الزائر عبر المتصفح إلى التوجه لمحادثة البوت المعتمد وإرسال أمر `/dashboard` مع زر نسخ سريع للأمر `[ 📋 نسخ الأمر: /dashboard ]`.

#### البند 3: توافق بيئة التشفير في Next.js Webpack (`node:crypto` -> `crypto`)
- استبدال استيرادات `node:crypto` بـ `crypto` المعيارية في:
  * `apps/admin-dashboard/src/app/api/auth/telegram/route.ts`
  * `apps/admin-dashboard/src/app/api/auth/magic/route.ts`
  * ملفات الاختبارات ذات الصلة (`telegram-auth.spec.ts`, `magic-auth.spec.ts`, `adversarial-auth.spec.ts`).

#### البند 4: التحقق والاختبارات ومطابقة الجودة (Zero Regressions)
- التحقق الكامل من فحص الأنواع الصارمة في الحزمتين (`admin-dashboard` و `bot-server`).
- اجتياز اختبارات المصادقة المشفرة ومقاومة هجمات التكرار (Anti-Replay Guard) بنسبة 100%.
- اجتياز بوابات الحوكمة والعقود (`arch:verify`, `migration:verify`, `telegram-contracts:verify`, `pnpm test`).
