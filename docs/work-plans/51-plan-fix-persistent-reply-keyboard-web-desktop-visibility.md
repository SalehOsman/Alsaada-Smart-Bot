# 📋 خطة عمل رقم 51: معالجة مشكلة اختفاء لوحة أزرار الكيبورد السفلية وتثبيتها الدائم على تيليجرام ويب والكمبيوتر
## Persistent Reply Keyboard Web & Desktop Visibility Remediation

> **مرجع الخطة الدائم:** `docs/work-plans/51-plan-fix-persistent-reply-keyboard-web-desktop-visibility.md`  
> **تاريخ التحرير:** 17-09-2026  
> **الحالة:** 🟢 مكتمل وموثق 100% (تم التنفيذ والتحقق الآلي والنوعي)

---

## 🔍 التحليل الجنائي وجذر المشكلة (Root Cause Analysis)

1. **الاحتجاز الصامت في كاش Redis (`Stale Anchor Lockout`):**
   - في `start.handler.ts` (السطر 305): كان الاستدعاء ممرراً كالتالي:
     `await screenFlowService.ensurePersistentKeyboard(ctx, undefined, false);`
   - دالة `ensurePersistentKeyboard` تفحص وجود رسالة كيبورد سابقة عبر `getPersistentKeyboardMsg(telegramId)` المحفوظة في Redis بمدة صلاحية 30 يوماً.
   - عند وجود مفتاح سابق في Redis (وهو موجود حتماً لكل مستخدم سبق له التفاعل مع البوت)، تقوم الدالة بعمل `return` فوري دون إرسال أي كيبورد!
2. **خصوصية عملاء Telegram Web و Telegram Desktop:**
   - تطبيقات الويب والديسكتوب لا تحتفظ بحالة الكيبورد القديمة محلياً عند فتح جلسة جديدة أو مسح المحادثة، وتعتمد حصراً على وصول رسالة حديثة محملة بـ `reply_markup: { keyboard: [...] }`.
   - نظراً لأن دالة `renderRoleHome` ترسل بطاقة القائمة الرئيسية مصحوبة بـ `InlineKeyboard` (ولا يمكن لرسالة واحدة في تيليجرام أن تجمع بين InlineKeyboard و ReplyKeyboard معاً)، فإن الكيبورد السفلي لا يُرسل إطلاقاً لمستخدم الويب والديسكتوب.
3. **غياب أمر استدعاء وتنشيط سريع (Fallback Command):**
   - في حال قيام العميل بإخفاء الكيبورد أو مسح المحادثة، لا يوجد أمر سريع مثل `/menu` أو `/keyboard` لإجبار البوت على إعادة توليد ودفع الكيبورد فوراً.

---

## 🛠️ خطوات الإصلاح المقترحة (Proposed Changes)

### 1️⃣ معالج البدء والقائمة (`apps/bot-server/src/handlers/start.handler.ts`)
- [MODIFY] تعديل السطر 305 ليمرر `forceRefresh = true`:
  ```typescript
  // فرض التحديث الفوري للكيبورد السفلي عند إرسال /start لضمان ظهوره بتيليجرام ويب والديسكتوب
  await screenFlowService.ensurePersistentKeyboard(ctx, undefined, true);
  ```
- هذا يضمن أنه في أي وقت يرسل فيه المستخدم `/start`، يتم تنظيف أي كاش قديم وإرسال الكيبورد السفلي فوراً.

---

### 2️⃣ خدمة إدارة تدفق الشاشات (`apps/bot-server/src/services/screen-flow.service.ts`)
- [MODIFY] تحسين `ensurePersistentKeyboard`:
  - التأكد من إرسال رسالة الكيبورد وحفظ المعرف الجديد بسلاسة، مع وضع `placeholder` واضح.
  - إذا فشل حذف الرسالة القديمة (مثلاً لحذفها يدوياً من المستخدم)، يتم التجاوز وإرسال الكيبورد الجديد دون تعليق.

---

### 3️⃣ تحصين لوحة الأزرار السفلية (`apps/bot-server/src/keyboards/reply-bar.keyboard.ts`)
- [MODIFY] تزويد لوحة المفاتيح بـ `placeholder` تفاعلي:
  ```typescript
  return keyboard.resized().persistent().placeholder('اختر إجراءً من القائمة بالأسفل...');
  ```
  هذا الحقل يدفع تيليجرام ويب وديسكتوب إلى إبراز أيقونة الكيبورد `🎛️` وشريط التبديل دائماً داخل حقل الإدخال.

---

### 4️⃣ موزع أحداث البوت والأوامر السريعة (`apps/bot-server/src/bot.ts`)
- [MODIFY] إضافة أوامر التنشيط السريع:
  ```typescript
  bot.command(['menu', 'keyboard', 'k'], async (ctx) => {
    await screenFlowService.ensurePersistentKeyboard(ctx, undefined, true);
    await renderRoleHome(ctx, false);
  });
  ```
  بحيث يمكن للمستخدم في أي وقت كتابة `/menu` أو `/keyboard` لاستدعاء الكيبورد وتثبيته فوراً.

---

## 🧪 خطة التحقق والاختبار (Verification Plan)

### الاختبارات المؤتمتة (Automated Tests)
1. تشغيل اختبارات كيبورد الرد السريع:
   `pnpm --filter @alsaada/bot-server test tests/reply-bar.keyboard.spec.ts`
2. تشغيل اختبارات خدمة تدفق الشاشات والكيبورد الدائم:
   `pnpm --filter @alsaada/bot-server test tests/screen-flow-and-hr-directory.spec.ts`
3. التحقق من التايب سكريبت الصارم وعدم وجود أي أخطاء:
   `pnpm typecheck`

### التحقق اليدوي والميداني (Manual Verification)
- إرسال أمر `/start` من Telegram Web أو Desktop والتأكد من ظهور شريط الأزرار السفلي فورياً مع زر `🖥️ فتح لوحة التحكم` و `🏠 القائمة الرئيسية`.
- تجربة أمر `/menu` للتأكد من إعادة توليد الكيبورد عند الطلب.

---

## 🏁 تقرير الإنجاز النهائي والتحقق (Execution & Verification Summary)

1. **معالج البدء (`start.handler.ts`):**
   - تم تفعيل `forceRefresh = true` في استدعاء `ensurePersistentKeyboard` بالسطر 305، مما يضمن كسر أي كاش عالق في Redis عند بدء الجلسة وإرسال الكيبورد للعميل فوراً.
   - تم تفعيل `forceRefresh = true` عند اكتمال ربط حساب العامل (`link_...`) بالسطر 133، لضمان استبدال كيبورد الضيف بكيبورد العامل التشغيلي فورياً.
   - تم تفعيل `ensurePersistentKeyboard(ctx, undefined, true)` للعامل العائد عند فتح رابط الدعوة (`inv_...`) بالسطر 204 قبل عرض القائمة.
2. **شريط الأزرار السفلية (`reply-bar.keyboard.ts`):**
   - تم تزويد لوحة المفاتيح بـ `.placeholder('اختر إجراءً من القائمة بالأسفل...')` مع تثبيت `resized()` و `persistent()`.
3. **خدمة تدفق الشاشات (`screen-flow.service.ts`):**
   - تحصين `ensurePersistentKeyboard` بالتعامل الصامت مع أخطاء حذف الرسائل القديمة وضمان تسجيل المعرف الجديد عند الإرسال بنجاح.
   - إضافة صمام أمان المحادثات الخاصة `if (ctx.chat.type && ctx.chat.type !== 'private') return;` لمنع تسريب الكيبورد الدائم إلى المجموعات وتلويث كاش المستخدم.
   - تصحيح ثغرة `removePersistentKeyboard` واستدعاء `clearPersistentKeyboardMsg(telegramId)` لمنع بقاء مرساة قديمة تحجب إظهار الكيبورد مستقبلاً.
4. **أوامر التنشيط السريع وتكامل الأزرار (`bot.ts`):**
   - تسجيل أوامر `['menu', 'keyboard', 'k', 'home']` لإجبار البوت على استدعاء `ensurePersistentKeyboard(ctx, undefined, true)` وعرض القائمة الرئيسية.
   - تسجيل معالج `bot.hears(/🚜 تسجيل منسوب/)` الخاص بزر كيبورد مشرف العمال (`WORKER_SUPERVISOR`).
5. **نتائج الفحص والتحقق:**
   - ✅ تشغيل كافة اختبارات `@alsaada/bot-server` بنجاح: `26 test files passed, 238 tests passed` (بما فيها اختبارات إزالة الكيبورد وعزل الجروبات).
   - ✅ تشغيل فحص التايب سكريبت الصارم بنجاح: `pnpm typecheck` (Exit 0 خالي من أي أخطاء).
   - ✅ فحص الحوكمة وقفل محرك السرعة: `npx tsx tools/scaffold/lock-speed.ts` و `verify-governance-lock.ts` (PASS).

