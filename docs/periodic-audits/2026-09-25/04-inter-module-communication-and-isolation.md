# المحور 04: التواصل بين الوحدات والعزل
## 1. الدرجة والوزن
الوزن 7؛ مراجعة العقود ومسارات التسجيل.

## 2. الخلاصة والتغطية
Module Bus يدعم prefixes ومدخلات موحدة، لكن module runtime مشترك ولا يحمل tenant context. راجعت contracts وmodules.registry.ts وbot.ts.

## 3. النتائج
**4.1 اقتران صريح:** bot.ts يستورد workforce/settings ويتعامل مع handlers مباشرة بعد بناء المحمل، ما يجعل فك وحدة يتطلب تعديل التطبيق.

**4.2 tenant context غائب:** ModuleRuntimeContext يقدم Prisma وRedis وAPI وخدمات أخرى دون tenant identity. مهم لقاعدة مشتركة، وليس إثباتًا على وجود تسريب حالي.

## 4. التوصيات
اعزل lifecycle الوحدات؛ مرر tenant موثوقًا في نمط المشاركة؛ أضف حواجز تمنع استعلامًا بلا نطاق.

## 5. المخاطر والأولوية
لم يُحلل import graph وكل repository. P1 قرار tenancy؛ P2 إزالة imports المباشرة.
