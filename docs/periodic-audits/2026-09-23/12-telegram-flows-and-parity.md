# المحور 12: تدفقات Telegram والتوافق الوظيفي
## Telegram Bot Flows & Functional Parity Audit

> **تاريخ التدقيق:** 2026-09-23  
> **المرجعية:** ميثاق `GEMINI.md` البنود 2 و 8 و 8.1 و 8.2، معايير Telegram الرسمية، وأدلة التدفقات  
> **المدقق:** المهندس المعماري المؤسسي والمدقق التقني المستقل (`/saleh`)

---

### 1. الدرجة والوزن
- **الدرجة:** **68 / 100**
- **الوزن المستخدم في الحساب:** **6**
- **المساهمة في الدرجة الإجمالية:** **4.08%**

---

### 2. الخلاصة
يمثل هذا المحور التحدي التشغيلي الأكبر في التدقيق الحالي. في حين نجحت التدفقات الـ 22 القائمة في تطبيق معمارية الـ 10 ملفات بنجاح واجتياز الحدود السطحية لـ Telegram Bot API (الروابط <= 512 بايت، والـ Callback <= 64 بايت)، إلا أن التدقيق المعزز (`pnpm audit:saleh:boost`) كشف عن **41 إخفاقاً قاتلاً** متمثلة في تجاوز مكتبة العرض الموحدة واستدعاء نصوص عربية خام مجردة في معالجات التدفقات، بجانب **74 تحذيراً** تخص تجاوز ميزانية نصوص الأزرار وغياب مخططات Mermaid في أدلة التوثيق. كما لا يزال هناك 104 تدفقات بانتظار الترحيل من خط الأساس `F:\HR`.

---

### 3. التغطية
- **المكونات والملفات المفحوصة:**
  - 22 تدفقاً في `modules/workforce` و `modules/settings` و `modules/sandbox`.
  - عقود التدفقات: `flow.contract.json` لكل تدفق.
  - ملفات الرسائل ولوحات المفاتيح: `flow.messages.ts` و `flow.keyboard.ts`.
  - مدقق عقود تليجرام: [`tools/governance/verify-telegram-contracts.ts`](file:///f:/Alsaada-Smart-Bot/tools/governance/verify-telegram-contracts.ts).
  - الفحص المعزز: [`tools/governance/saleh-audit-suite.ts`](file:///f:/Alsaada-Smart-Bot/tools/governance/saleh-audit-suite.ts).
- **أوامر التحقق المنفذة:**
  - `pnpm telegram-contracts:verify` (فحص 945 استدعاءً واجتاز الحد العام <= 64).
  - `pnpm audit:saleh:boost` (فحص 1874 توكيداً برمجياً وأسفر عن 41 خطأ قاتلاً و74 تحذيراً ورمز الخروج Exit 1).

---

### 4. تقييم الجوانب الفرعية

| الجانب الفرعي | الحالة | الملاحظات والنتيجة |
|:---|:---:|:---|
| **الالتزام بالحدود الرسمية للـ API** | **سليم** | الروابط <= 512 بايت، وبيانات الـ Callback <= 64 بايت. |
| **التوحيد البصري ومكتبة العرض الموحدة** | **خلل مؤكد (Critical)** | 41 استدعاءً صريحاً لنصوص خام مجردة تكسر Gate G5. |
| **ميزانية أزرار الهاتف الجوال (36/16/7/3)** | **خلل مؤكد (Major)** | أزرار بتسميات تصل إلى 55 حرفاً تتجاوز شاشات الهاتف. |
| **مخططات الحالة في التوثيق (Mermaid)** | **خلل مؤكد** | غياب مخططات `stateDiagram-v2` في أدلة 11 تدفقاً. |
| **اكتمال الترحيل من خط الأساس `F:\HR`** | **يحتاج تحسينًا** | اكتمال 22 تدفقاً وبقاء 104 تدفقات بانتظار الترحيل. |

---

### 5. النتائج المفصلة

#### نتيجة 12.1: 41 إخفاقاً قاتلاً في تجاوز طبقة العرض واستدعاء رسائل خام (`RAW_MESSAGE_BYPASS`)
- **الوصف والأثر:** استدعاء مباشر لـ `ctx.reply("...")` و `ctx.sendMessage("...")` بنصوص خام مجردة دون استيراد وتطبيق قوالب `@alsaada/core-components/rich-message` ودون استخدام `flow.messages.ts`. هذا يكسر التوحيد البصري، ويعطل التنسيقات الغنية، ويمنع ضبط النصوص مركزياً.
- **مستوى الخطورة:** **Critical** (مانع للضوء الأخضر بموجب ميثاق `GEMINI.md`).
- **حالة الدليل:** **مؤكدة** (فحص الـ AST في `pnpm audit:saleh:boost`).
- **المسارات المتأثرة:**
  - `modules/settings/src/flows/00.1-corporate-profile/flow.handler.ts` (الأسطر 34، 74، 134، 169)
  - `modules/settings/src/flows/00.3-job-matrix/flow.handler.ts` (الأسطر 55، 144، 217، 239، 247، 261، 269، 296، 312)
  - `modules/settings/src/flows/00.11-telegram-groups/flow.handler.ts` (الأسطر 294، 303، 310)
  - `modules/settings/src/flows/00.12-user-rbac-management/flow.handler.ts` (الأسطر 285، 297، 306)
  - `modules/settings/src/flows/00.2-sites-hub/flow.handler.ts` (السطر 40)
  - `modules/settings/src/flows/00.4-admin-profile/flow.handler.ts` (الأسطر 27، 54، 112)
  - `modules/settings/src/flows/00.5-admin-assignment/flow.handler.ts` (السطر 21)
  - `modules/settings/src/flows/00.6-ghost-mode/flow.handler.ts` (الأسطر 34، 221، 233)
  - `modules/workforce/src/flows/01.5-worker-directory/flow.documents-handler.ts` (الأسطر 122، 294)
  - `modules/workforce/src/flows/01.5-worker-directory/flow.handler.ts` (الأسطر 209، 215، 226)
  - `modules/workforce/src/flows/01.7-guest-join-and-linking/flow.handler.ts` (الأسطر 119، 158)
  - `modules/workforce/src/flows/01.8-worker-offboarding/flow.handler.ts` (الأسطر 281، 296)
- **البوابات المرتبطة:** Gate G5, Gate G22, وميثاق `GEMINI.md` البند 8.1.

#### نتيجة 12.2: تجاوز ميزانية نصوص الأزرار وبيانات الـ Callback
- **الوصف والأثر:** رصد أزرار بطول نصوص يتجاوز الحدود المريحة لشاشات الهواتف الذكية (16-32 حرفاً):
  - زر `🔄 إعادة تدفئة الذاكرة اللحظية (Cache Flush & Pre-Warm)` بطول 55 حرفاً في `00.9-emergency-cache`.
  - أزرار بطول 40-46 حرفاً في `00.1-corporate-profile` و `01.1-worker-registration`.
  - زر ببيانات callback بحجم 39 بايت (`wizard:worker:ins:fulltime_no_insurance`) متجاوزاً ميزانية 36 بايت.
- **مستوى الخطورة:** **Major**
- **حالة الدليل:** **مؤكدة** (فحص AST الميزانيات).
- **البوابة المرتبطة:** Gate G22.

---

### 6. الحلول المقترحة
1. نقل جميع الرسائل النصية إلى ملف `flow.messages.ts` المخصص لكل تدفق.
2. استخدام كتل `buildRichPage` من حزمة المكونات الموحدة بدلاً من النصوص العادية.
3. صياغة نصوص موجزة للأزرار (مثال: اختصار "إعادة تدفئة الذاكرة اللحظية..." إلى "🔄 تحديث الكاش").
4. إضافة رسم `stateDiagram-v2` داخل ملف `flow.docs.md` في التدفقات الـ 11 الناقصة.

---

### 7. المخاطر المتبقية
- ظهور نصوص الأزرار مقتطعة بعلامات حذف (`...`) على شاشات الجوال الصغيرة في بيئة التشغيل الفعلية.

---

### 8. الأولويات
1. **عاجل جداً (P0):** إصلاح الـ 41 استدعاءً لرسائل النصوص الخام (الجهد: 1–2 يوم عمل | الأثر: اجتياز تدقيق صالح المعزز).
2. اختصار نصوص الأزرار وضبط الـ Callbacks (الجهد: نصف يوم عمل).
