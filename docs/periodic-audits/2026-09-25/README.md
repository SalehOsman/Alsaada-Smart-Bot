# فهرس تقرير الفحص الفني الشامل — 2026-09-25

أُعد وفق تقسيم وأوزان تقرير 2026-09-23: حكم تنفيذي و15 محورًا. النطاق قراءة ساكنة للشيفرة والإعدادات والوثائق وحالة Git. لم تُشغّل الاختبارات أو البناء أو بوابات الحوكمة أو فحوص شبكة/قاعدة بيانات؛ لذلك لا توجد درجات تشغيلية أو PASS حديثة.

| # | المحور | الوزن | الحالة |
|---|---|---:|---|
| 01 | قاعدة البيانات والبيانات | 10 | tenant جزئي؛ CI لا يطبق migrations |
| 02 | النواة وجودة الكود | 10 | وظائف أعمال في تطبيق البوت |
| 03 | الموديولات والمخططات | 7 | system:provision يشير لملف مفقود |
| 04 | الاتصال والعزل | 7 | runtime بلا tenant context |
| 05 | الأمان والهوية | 12 | كلمات مرور Compose افتراضية معروفة |
| 06 | الرصد والسجلات | 6 | لا healthcheck لحاوية البوت |
| 07 | المهام والكاش | 5 | آليات موجودة، غير مختبرة |
| 08 | لوحة الإدارة | 4 | مراجعة ساكنة محدودة |
| 09 | Docker وCI | 5 | فجوة migrations وأسرار fallback |
| 10 | الاختبارات | 7 | تقييم ساكن مفصل؛ لم تُشغّل، راجع مجلد تقييم الاختبارات |
| 11 | المالية | 9 | المخطط موجود؛ التحقق غير معاد |
| 12 | Telegram | 6 | polling ومسارات مجال في bot.ts |
| 13 | النسخ والاستعادة | 4 | backup مجدول معرف؛ restore غير مثبت |
| 14 | سلسلة التوريد | 4 | CVE الحالية غير مفحوصة |
| 15 | الوثائق والعمليات | 4 | README غير مطابق بالكامل |

لم تُحسب درجة إجمالية؛ لا يصح مقارنتها بدرجات 23 سبتمبر من دون إعادة تشغيل أدلتها.

## النتائج الأهم
- HIGH مشروط: docker-compose.yml يستخدم كلمات مرور ثابتة معروفة عند غياب overrides.
- HIGH عند قاعدة مشتركة: tenant موجود جزئيًا، لكن سياق التشغيل وبعض الاستعلامات لا تحدده.
- MAJOR: system:provision يستهدف scripts/provision.ts غير الموجود؛ tenant:init موثق وغير ظاهر في سكربتات الجذر.
- MAJOR: CI يستخدم db:push --accept-data-loss بدل تطبيق migrations.
- MAJOR: bot.ts يحتوي رواتب وسلف وموردين وتسجيل منسوب.
- MAJOR: README يذكر Hono/Webhook وPrisma 6.4+ وأرقامًا لا تطابق الملفات.
- MEDIUM: Compose يعرّف postgres-backup يوميًا، بخلاف استنتاج تقرير 23 سبتمبر؛ لم تُختبر استعادة.
- البناء والاختبارات وفحوص الحوكمة والثغرات غير متحققة اليوم.

## التقارير
- [الحكم التنفيذي](./00-executive-audit-verdict.md)
- [01 البيانات](./01-database-and-data-layer.md)
- [02 النواة](./02-core-architecture-and-code-quality.md)
- [03 الموديولات](./03-module-explorer-and-schema-engine.md)
- [04 العزل](./04-inter-module-communication-and-isolation.md)
- [05 الأمان](./05-security-identity-and-compliance.md)
- [06 الرصد](./06-logging-monitoring-and-telemetry.md)
- [07 المهام](./07-background-jobs-and-caching.md)
- [08 لوحة الإدارة](./08-admin-panel-and-ui.md)
- [09 البنية](./09-infrastructure-docker-and-build.md)
- [10 الاختبارات](./10-testing-quality-and-reliability.md)
- [تقييم الاختبارات التفصيلي](./تقييم-الاختبارات/README.md)
- [مراجعة فجوات التوثيق](./مراجعة-فجوات-التوثيق/README.md)
- [فحص الملفات البرمجية](./مراجعة-الملفات-البرمجية/README.md)
- [الفجوات الأخرى](./الفجوات-الأخرى.md)
- [خطة مخطط قاعدة البيانات واكتشاف الموديولات](./16-plan-functional-database-schema-and-module-autodiscovery.md)
- [11 المالية](./11-finance-and-domain-integrity.md)
- [12 Telegram](./12-telegram-flows-and-parity.md)
- [13 النسخ](./13-backup-recovery-and-continuity.md)
- [14 الإصدارات](./14-releases-and-supply-chain.md)
- [15 الوثائق](./15-docs-incidents-and-operations.md)

## حدود وحالة الشجرة
في آخر لقطة Git ظهرت مجلدات تقرير اليوم وملف الخطة `docs/work-plans/110-plan-single-company-consolidation-and-documentation-reality-alignment.md` كغير متتبعة؛ لم أعدل ملف الخطة. لم أغير الشيفرة أو إعدادات المشروع. لم أقرأ ملفات الأسرار المحلية. التقرير عن شجرة التطوير ولا يثبت حالة الإنتاج.



