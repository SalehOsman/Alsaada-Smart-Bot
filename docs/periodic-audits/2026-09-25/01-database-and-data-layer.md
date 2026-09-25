# المحور 01: قاعدة البيانات وطبقة البيانات
## 1. الدرجة والوزن
الوزن 10؛ لا درجة تشغيلية.

## 2. الخلاصة والتغطية
PostgreSQL مع Prisma 7.10.0 وadapter-pg. راجعت schema.prisma وdatabase/src/client.ts ومستودعات settings/auth وCI. المخطط واسع؛ عزل tenant غير شامل بالملفات التي ظهرت.

## 3. التقييم
| الجانب | الحالة |
|---|---|
| Tenant schema | جزئي؛ بعض tenantId إلزامي وبعضه اختياري |
| استعلامات محددة بالمستأجر | غير مثبتة |
| migrations في CI | لا؛ db:push --accept-data-loss |
| تحقق البيانات المالية الحية | لم يشغل |

## 4. النتائج
**1.1 tenant ليس حدًا شاملًا:** Tenant معرف في schema.prisma:19. User/Worker/Department تسمح tenantId فارغًا؛ ModuleRuntimeContext لا يحمل المستأجر؛ CorporateProfileRepository يقرأ أحدث profile عمومًا. الخطر عالٍ إذا كانت القاعدة مشتركة، دون إثبات تسريب فعلي.

**1.2 CI لا يختبر migration chain:** يستخدم db:push على DB مؤقتة. لا يثبت ذلك قابلية تطبيق migrations، ولا يعني وحده أن إنتاجًا فقد بيانات.

**1.3 fallback محلي:** database/src/client.ts يتضمن عنوان اتصال افتراضيًا إذا لم يمرر DATABASE_URL.

## 5. التوصيات والمخاطر
حددوا نموذج tenancy، وأضيفوا سياقًا موثوقًا واستعلامات وعلاقات مقيدة؛ اختبروا migration chain على DB نظيفة. لم تراجع كل queries أو DB حية.

## 6. الأولوية
P1 tenant boundary وmigrations؛ P2 توثيق fallback.
