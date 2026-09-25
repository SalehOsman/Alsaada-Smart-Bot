# المحور 07: المهام الخلفية والتخزين المؤقت
## 1. الدرجة والوزن
الوزن 5؛ لم تُختبر المهام.

## 2. الخلاصة
Outbox وRedis/cache وcircuit breaker وtimers موجودة. راجعت outbox daemon والworker وsession monitor.

## 3. النتائج
**7.1 advisory lock يحتاج إثباتًا:** OutboxDaemon يطلب pg_try_advisory_lock ويحرره عبر استعلام Prisma لاحق. قفل PostgreSQL session-level؛ يلزم التحقق من استخدام الاتصال نفسه عبر pool.

**7.2 مسؤولية Outbox مزدوجة محتملة:** يوجد daemon في bot-server وعامل في core-components؛ لم أحدد أيهما الفعلي أثناء التشغيل.

## 4. التوصيات والمخاطر
حدد نقطة تشغيل واحدة واختبر تعدد النسخ والفشل/idempotency. لم أشغل ضغطًا أو تعطلًا.

## 5. الأولوية
P2 اختبار القفل ومسار Outbox.
