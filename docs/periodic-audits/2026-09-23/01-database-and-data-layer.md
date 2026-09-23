# المحور 01: قاعدة البيانات وطبقة البيانات
## Database & Data Layer Architecture Audit

> **تاريخ التدقيق:** 2026-09-23  
> **المرجعية:** ميثاق `GEMINI.md`، مخطط Prisma، وملحقات أمان السجلات المالية  
> **المدقق:** المهندس المعماري المؤسسي والمدقق التقني المستقل (`/saleh`)

---

### 1. الدرجة والوزن
- **الدرجة:** **88 / 100**
- **الوزن المستخدم في الحساب:** **10**
- **المساهمة في الدرجة الإجمالية:** **8.80%**

---

### 2. الخلاصة
معمارية قاعدة البيانات مبنية بصلابة بالغة على محرك PostgreSQL 16 ومحرك ORM الحديث Prisma 7 مع استخدام `@prisma/adapter-pg`. تم تفعيل ملحقات مخصصة للأمان المالي تشمل القفل الاستشاري التزامني `pg_advisory_xact_lock`، وحظر الحذف المادي المباشر `LedgerHardDeleteForbiddenError`، وتقييد حقول التحديث بـ `LEDGER_UPDATE_WHITELIST`. يوجد قصور طفيف في استعلام تنظيف الاختبارات واستخدام `db:push` في مسار CI بدلاً من فحص التراجع عن الهجرات.

---

### 3. التغطية
- **المكونات والملفات المفحوصة:**
  - مخطط النماذج الرئيسي: [`packages/database/prisma/schema.prisma`](file:///f:/Alsaada-Smart-Bot/packages/database/prisma/schema.prisma) (1917 سطراً، 12 مجال عمل مؤسسي).
  - مجلد الهجرات: [`packages/database/prisma/migrations/`](file:///f:/Alsaada-Smart-Bot/packages/database/prisma/migrations/) (9 مجلدات هجرة مسجلة).
  - عميل الاتصال وإدارة الـ Pool: [`packages/database/src/client.ts`](file:///f:/Alsaada-Smart-Bot/packages/database/src/client.ts).
  - ملحق الحذف المرن: [`packages/database/src/extensions/soft-delete.extension.ts`](file:///f:/Alsaada-Smart-Bot/packages/database/src/extensions/soft-delete.extension.ts).
  - ملحق دفتر الأستاذ التشفيري: [`packages/database/src/ledger/hash-ledger.extension.ts`](file:///f:/Alsaada-Smart-Bot/packages/database/src/ledger/hash-ledger.extension.ts).
  - سكريبت التحقق المالي: [`tools/governance/verify-financial-integrity.ts`](file:///f:/Alsaada-Smart-Bot/tools/governance/verify-financial-integrity.ts).
- **ما استُثني:** لم يتم فحص أداء الاستعلامات تحت ملايين السجلات في قاعدة إنتاج حية لعدم توفر بيئة Staging محملة.

---

### 4. تقييم الجوانب الفرعية

| الجانب الفرعي | الحالة | الملاحظات والنتيجة |
|:---|:---:|:---|
| **نماذج البيانات والقيود والعلاقات** | **سليم** | علاقات محكمة وتعيين دقيق للأكواد الفريدة ومفاتيح UUID. |
| **حدود المعاملات والتزامن** | **سليم** | تأمين العمليات المالية بـ `pg_advisory_xact_lock` لمنع Race Conditions. |
| **سلامة السجلات ومنع الحذف** | **سليم** | حظر قطعي للحذف المادي عبر `LedgerHardDeleteForbiddenError`. |
| **إدارة الاتصالات والمهلات (Pool)** | **سليم** | Pool Max = 15 في الإنتاج و3 في الاختبارات مع مهلة 5 ثوانٍ للاتصال. |
| **إجراءات الهجرة وقابلية التراجع** | **يحتاج تحسينًا** | اعتماد `db:push --accept-data-loss` في مسار CI بدلاً من `prisma migrate deploy`. |
| **كود تنظيف بيئة الاختبارات** | **خلل مؤكد** | استثناء SQL بسبب عدم تطابق اسم الحقل في جدول الضيافة. |

---

### 5. النتائج المفصلة

#### نتيجة 1.1: خطأ استعلام SQL في كود تنظيف بيئة الاختبارات المالية
- **الوصف والأثر:** تستدعي دالة `cleanupFinancialTestFixtures` استعلام حذف مباشر:  
  `DELETE FROM "hospitality_expenses" WHERE "voucherNumber" LIKE ...`  
  مما يتسبب في استثناء من بريزما برمز `42703` (P2010: `column "voucherNumber" does not exist`)، نظراً لأن الاسم الصحيح للعمود في مخطط Prisma وقاعدة البيانات هو `voucherId`.
- **مستوى الخطورة:** **Minor** (ينحصر أثره في إخراج تحذير أحمر أثناء تشغيل الاختبارات المؤقتة ولا يؤثر على سلامة بيانات الإنتاج).
- **حالة الدليل:** **مؤكدة** (مخرج تشغيل أمر `pnpm financial:verify`).
- **المسار:** [`tools/governance/verify-financial-integrity.ts#L265`](file:///f:/Alsaada-Smart-Bot/tools/governance/verify-financial-integrity.ts#L265).
- **بوابة المشروع المرتبطة:** Gate G10, Gate G12.

#### نتيجة 1.2: تخطي فحص التراجع عن الهجرات في CI
- **الوصف والأثر:** خطوة تهيئة قاعدة البيانات في ملف `.github/workflows/ci.yml` تستخدم الأمر:  
  `pnpm --filter @alsaada/database db:push --accept-data-loss`  
  بدلاً من تطبيق الهجرات التراكمية، مما يمنع التحقق التلقائي من سلامة ملفات الهجرة وقابلية التراجع (Reversibility).
- **مستوى الخطورة:** **Minor**
- **حالة الدليل:** **مؤكدة** ([`.github/workflows/ci.yml#L75`](file:///f:/Alsaada-Smart-Bot/.github/workflows/ci.yml#L75)).
- **بوابة المشروع المرتبطة:** Gate G20.

---

### 6. الحلول المقترحة
1. **تصحيح استعلام تنظيف الاختبارات المالية (اقتراح غير مطبق):**
   ```typescript
   // في tools/governance/verify-financial-integrity.ts السطر 265
   await client.$executeRawUnsafe(
     `DELETE FROM "hospitality_expenses" WHERE "voucherId" LIKE 'HOSP-GOV-2026-%'`
   );
   ```
2. **استبدال `db:push` في مسار CI:** استخدام `prisma migrate deploy` لضمان اختبار تطابق سجلات الهجرة الحقيقية.

---

### 7. المخاطر المتبقية
- مخاطر حدوث تعارض في الهجرات (Migration Drift) إذا قام مطور بتعديل المخطط يدوياً دون توليد هجرة مقابلة.

---

### 8. الأولويات
1. تصحيح اسم الحقل في `verify-financial-integrity.ts` (الجهد: 5 دقائق | الأثر: تصفية سجلات التحقق من التحذيرات).
2. تحديث خطوات CI لفحص الهجرات التراكمية (الجهد: 30 دقيقة).
