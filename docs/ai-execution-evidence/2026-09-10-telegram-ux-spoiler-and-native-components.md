# توثيق الحوكمة: دمج مميزات تليجرام المتقدمة لتجربة المستخدم ونظام التعتيم التفاعلي (Spoiler)
## Telegram Native UX Suite: Interactive Spoiler, copy_text Buttons, Expandable Quotes & Live Actions

- التاريخ: 2026-09-10
- الحالة: معتمد وموافق عليه رسمياً
- عبارة الاعتماد الإلزامية: موافق على التعديل او الايقاف او الحذف

## نطاق الأعمال والترقيات المعمارية المنفذة

1. **إضافة أدوات التنسيق الرسمية لتليجرام في النواة المشتركة (`packages/core-components`):**
   - إنشاء ملف `packages/core-components/src/formatting/telegram-formatters.ts`.
   - توفير دالة `formatSpoiler(text, mode)`: تدعم نمطي HTML (`<tg-spoiler>`) و Markdown (`||text||`) لتفعيل التعتيم التفاعلي الذي يزول بنقرة إصبع واحدة بانسيابية كاملة دون طلب شبكي.
   - توفير دالة `formatExpandableQuote(text, mode)`: تدعم نمطي HTML (`<blockquote expandable>`) و Markdown (`**>...`) لطي النصوص الطويلة والملاحظات في سطرين تفاعليين.
   - توفير دالة `formatMonospace(text)`: لتغليف الأرقام بوسم `<code>` للنسخ السريع.
   - توفير دالة `buildCopyTextButton(text, textToCopy)`: لبناء أزرار النسخ المباشر للحافظة المعتمدة في تليجرام Bot API 7.10+ مع ظهور إشعار النظام الفوري.
   - توفير دالة `buildInputFieldPlaceholder(placeholder)`: لتضمين النصوص الإرشادية داخل حقول الإدخال.

2. **تطبيق أزرار النسخ الفوري للحافظة في بطاقة ودليل العاملين (`modules/workforce`):**
   - في `modules/workforce/src/flows/01.5-worker-directory/flow.keyboard.ts`:
     * إضافة زر `[ 📋 نسخ الرقم القومي / الإثبات ]` عبر `kb.copyText` للنسخ الفوري لحافظة الهاتف بنقرة واحدة.
     * تمرير `idNumber` و `phone` إلى `profile360ActionsKeyboard` من خلال `flow.handler.ts`.
   - في `modules/workforce/src/flows/01.2.D-worker-edit/flow.keyboard.ts`:
     * في تبويب المالية: إضافة أزرار `[ ⚡ نسخ إنستاباي ]` و `[ 💳 نسخ المحفظة/الحساب ]`.
     * في تبويب البيانات الشخصية: إضافة زر `[ 📋 نسخ الرقم القومي ]`.
     * في تبويب الاتصال والسلامة: إضافة زر `[ 📞 نسخ رقم الهاتف ]`.

3. **تطبيق التعتيم التفاعلي (Spoiler) والاقتباس الممتد في بطاقة تعديل العامل:**
   - في `modules/workforce/src/flows/01.2.D-worker-edit/flow.messages.ts`:
     * تطبيق التعتيم التفاعلي (`formatSpoiler`) على الراتب الأساسي والبدلات لغير السوبر أدمن، بحيث يظهر مشوشاً بنقاط تفاعلية ويُكشف بلمسة إصبع واحدة لحماية الشاشة من استراق النظر الميداني، مع الحفاظ على صراحة الشفافية الكاملة للسوبر أدمن.
     * تغليف الملاحظات الطبية والحساسية بوسم الاقتباس القابل للطي والتوسيع (`formatExpandableQuote`) لمنع التمرير الطويل.

4. **تفعيل مؤشر النشاط الحي المتزامن (`sendChatAction: upload_document`):**
   - في `modules/workforce/src/flows/01.4-worker-export/flow.handler.ts`:
     * استدعاء `ctx.replyWithChatAction('upload_document')` عند تنزيل قالب الاستيراد وتوليد وتصدير كشوف العاملين لطمأنة المستخدم الميداني بنشاط البوت.

5. **تحديث معايير الحوكمة وتصميم تجربة المستخدم (`docs/22`):**
   - تحديث `docs/22-telegram-ux-ui-design-system-and-ergonomics.md` بإضافة:
     * البند 7: معيار التعتيم التفاعلي المباشر (`Interactive Spoiler Formatting Standard`).
     * البند 8: معيار الاقتباسات القابلة للطي والتوسيع (`Expandable Blockquote Standard`).
     * البند 9: معيار أزرار النسخ الفوري للحافظة (`Native Telegram copy_text Button Standard`).
     * البند 10: معايير التوجيه الميداني ومؤشرات النشاط الحي (`Input Field Placeholders & sendChatAction`).

## نتائج التحقق والاختبارات الآلية
- اختبارات النواة المشتركة: نجاح 16 ملف اختبار (77 اختباراً) بنسبة 100%.
- اختبارات موديول القوى العاملة: نجاح 20 ملف اختبار (66 اختباراً) بنسبة 100%.
- حزمة اختبارات المستودع بالكامل: نجاح 60 ملف اختبار (371 اختباراً) بنسبة 100%.
- فحص التايب سكريبت الصارم: خروج بأمر `Exit 0` ودون أي أخطاء تجميع.
