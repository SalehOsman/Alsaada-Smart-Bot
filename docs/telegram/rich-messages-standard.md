# معيار محرر النصوص الغني في بوت السعادة

هذا المعيار يترجم **Rich Messages** في Telegram Bot API إلى قوالب مشتركة قابلة لإعادة الاستخدام. القوالب لا تخفي عقد Telegram؛ بل تنتج `InputRichMessage` مطابقاً للتوثيق الرسمي، وتمنع إرسال رسالة غير غنية أو تتجاوز الحدود المعلنة.

## المراجع الرسمية

- [Bots: Features — Rich Messages](https://core.telegram.org/bots/features#rich-messages)
- [Bot API — Rich message formatting options](https://core.telegram.org/bots/api#rich-message-formatting-options)
- [Bot API — Rich Markdown style](https://core.telegram.org/bots/api#rich-markdown-style)
- [Bot API — InputRichMessage](https://core.telegram.org/bots/api#inputrichmessage)

## نقطة الدخول المشتركة

كل تدفق جديد يجب أن يستورد القوالب من `@alsaada/core-components`:

- `buildRichPage`: صفحة RTL بعنوان وكتل مرتبة.
- `buildRichTable`: جدول بخلايا رأسية مركزية، وخلايا بيانات مضبوطة الاتجاه.
- `buildRichConfirmation`: سؤال تأكيد مع زري تأكيد وإلغاء.
- `assertRichMessage`: يفرض استخدام حقل واحد فقط من `blocks` أو `markdown` أو `html`.
- `validateRichMessageLimits`: فحص الحدود قبل استدعاء Telegram.

استخدم `is_rtl: true` للمحتوى العربي حتى لو كانت لغة واجهة المستخدم إنجليزية. ترتيب أعمدة الجدول يحدد ترتيبها البصري في عميل Telegram، لذلك يجب اختبار ترتيب الخلايا على الهاتف.

## تغطية النصوص الغنية

القوالب النصية في `rich-message/index.ts` تغطي كل كيانات `RichText` الرسمية:

| فئة Telegram | القوالب |
|---|---|
| تنسيق | `richBold`, `richItalic`, `richUnderline`, `richStrike`, `richSpoiler`, `richMarked`, `richCode` |
| وقت وهوية | `richDateTime`, `richTextMention`, `richCustomEmoji` |
| صيغ | `richMath`, `richSubscript`, `richSuperscript` |
| روابط وكيانات تلقائية | `richUrl`, `richEmail`, `richPhone`, `richBankCard`, `richMention`, `richHashtag`, `richCashtag`, `richBotCommand` |
| مراجع داخل الرسالة | `richAnchor`, `richAnchorLink`, `richReference`, `richReferenceLink` |
| زر داخل النص | `richInlineButton` |

## تغطية الكتل

| كتل Telegram الرسمية | القوالب |
|---|---|
| paragraph, heading, pre, footer, divider | `richParagraph`, `richHeading`, `richPre`, `richFooter`, `richDivider` |
| LaTeX ومرساة | `richMathBlock`, `richAnchorBlock` |
| القوائم ومهام checkbox | `richList` |
| الاقتباسات | `richBlockQuote`, `richExpandableQuote`, `richPullQuote` |
| collage وslideshow | `richCollage`, `richSlideshow` |
| جدول | `buildRichTable` |
| details القابلة للطي | `richDetails` |
| خريطة | `richMap` |
| animation, audio, document, photo, video, voice note | `richAnimation`, `richAudio`, `richDocument`, `richPhoto`, `richVideo`, `richVoiceNote` |
| أزرار | `richButtons` |
| مسودة التفكير | `richThinking` |

الوسائط تمرر كائنات `InputMedia*` الرسمية، مع حفظ `file_id` في قاعدة البيانات وإعادة استخدامه. لا يرسل القالب مسار ملف محلي إلى Telegram.

## تغطية الأزرار

- `richCallbackButton`: callback data بطول 1–64 بايت.
- `richUrlButton`: HTTP أو `tg://`.
- `richWebAppButton`: Mini App في المحادثات الخاصة.
- `richLoginUrlButton`: تسجيل الدخول الآمن.
- `richSwitchInlineButton` و`richSwitchInlineCurrentChatButton`.
- `richSwitchInlineChosenChatButton`.
- `richCopyTextButton`.
- `richDisabledButton`.

يستخدم `richButtons` صفاً من 1 إلى 8 أزرار. زر `link` مخصص لـ callback وفق قيود Telegram. استخدم Inline Keyboard القديمة فقط عند وجود توافق موثق مع تدفق قديم.

## بدائل Markdown وHTML

عندما يكون المحتوى نصياً ولا يحتاج كتل JSON، يمكن استخدام `markdown` أو `html`، لكن لا يجوز الجمع بينها أو مع `blocks`. يغطي Rich Markdown الرسمي:

- bold/italic/underline/strike/code/marked/spoiler.
- روابط URL والبريد والهاتف والمنشن وcustom emoji وdatetime.
- LaTeX inline وblock.
- العناوين 1–6، preformatted، divider.
- القوائم غير المرتبة والمرتبة وقوائم المهام.
- blockquote والوسائط والجداول.
- references/footnotes وdetails وcollage وslideshow.

اختر `blocks` عند الحاجة إلى اتجاه RTL صريح، جداول قابلة للاختبار، أو تفاعل منظم. استخدم Markdown/HTML فقط عبر قالب أو دالة مجال موثقة، ولا تكتب نصاً يدوياً في handler.

## الحدود والتحقق

يفرض Telegram هذه الحدود:

- 32768 محرف UTF-8 في النص، بما فيها النص البديل للرموز والصيغ.
- 500 كتلة، مع احتساب الكتل المتداخلة وعناصر القوائم وصفوف الجداول.
- 16 مستوى تداخل للتنسيق والكتل.
- 50 مرفق وسائط.
- 20 عموداً للجدول.

استدعِ `assertRichMessage` في طبقة الإرسال أو الاختبار، وتعامل مع خطأ validator قبل الوصول إلى Bot API. validator الحالي يرفض تجاوز النص والكتل والوسائط والأعمدة؛ ويجب إضافة اختبار لأي حد جديد عند تحديث grammY أو Bot API.

## توزيع المسؤوليات

- `packages/core-components/src/rich-message`: القوالب، الأنواع، والتحقق.
- `modules/*/flows/*/flow.messages.ts`: نصوص المجال والبيانات فقط.
- `modules/*/flows/*/flow.handler.ts`: الحالة والصلاحيات والتأكيدات واستدعاء القوالب.
- `packages/core-components/tests/rich-message-builders.spec.ts`: اختبارات العقد الرسمية.
- كل تدفق مرحّل يضيف اختبار snapshot، callback، RTL، وحالة فشل validator.

وجود هذه المكتبة لا يعني أن كل التدفقات القديمة رُحّلت تلقائياً؛ الترحيل يتم على دفعات ويستخدم هذه القوالب إلزامياً من أول تعديل لاحق.
