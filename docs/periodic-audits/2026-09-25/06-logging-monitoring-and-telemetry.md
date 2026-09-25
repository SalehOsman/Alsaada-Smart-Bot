# المحور 06: السجلات والرصد وتتبع الأخطاء
## 1. الدرجة والوزن
الوزن 6؛ مراجعة ساكنة.

## 2. الخلاصة
حزمة telemetry فيها logger وredaction ومحولات. index.ts ينشئ HTTP health endpoint، لكن Compose لا يعرّف healthcheck للبوت.

## 3. النتائج
**6.1 صحة الحاوية:** خدمة bot بلا healthcheck. endpoint متاح لكنه لا يفحص runner بعد البدء.

**6.2 readiness مبسطة:** الرد status=ready وversion وtimestamp؛ لا يظهر probe لTelegram/runner.

## 4. التوصيات والمخاطر
عرّف liveness/readiness، اربط Compose بالفحص، وراقب أخطاء polling. لم أختبر redaction أو sinks.

## 5. الأولوية
P2 healthcheck ومعنى readiness.
