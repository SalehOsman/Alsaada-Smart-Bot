# خطة العمل: إدارة وأرشفة مرفقات ومستندات العامل وتصحيح حفظ صور البطاقة بالمجلد المخصص

بناءً على طلب المستخدم وجلسة الاستجواب الحصرية (`/grill-me`)، تهدف هذه الخطة إلى:
1. **تصحيح وإصلاح حفظ صور البطاقة/الجواز في معالج التعيين (`01.1-worker-registration`)**: حفظ الصورتين فعلياً على القرص في مجلد العامل الخاص `attachments/workers/{workerCode}/` وتحديث حقول مساراتهما في قاعدة البيانات (`idCardFrontPath`, `idCardBackPath`) وقيدهما في جدول `WorkerDocument`.
2. **بناء أرشيف مستندات ومرفقات العامل في دليل العاملين (`01.5-worker-directory`)**:
   - إضافة زر `[ 📁 مستندات ومرفقات العامل (N) ]` في بطاقة العامل (360° Profile).
   - عرض قائمة تفاعلية بالمستندات المرفقة، وعند النقر يرسل البوت الملف للمعاينة والتنزيل.
   - معالج رفع مستند جديد (`➕ إضافة / رفع مستند جديد`) يدعم التصنيفات المعيارية أو كتابة عنوان حر.
   - حصر صلاحية حذف المستند على `SUPER_ADMIN` والإدارة العليا فقط، مع السماح لمشرف الموقع (`FIELD_ADMIN`) بالاستعراض والرفع.

---

## User Review Required

> [!IMPORTANT]
> تم التوافق على كافة القرارات التصميمية الرئيسية في جلسة `/grill-me`:
> 1. إبقاء معالج التعيين سريعاً وميدانياً، وإتاحة رفع المستندات الإضافية حصراً من داخل بطاقة العامل في دليل العاملين.
> 2. استعراض المستندات عبر أزرار تفاعلية ترسل الملف فوراً عند النقر للمعاينة.
> 3. دعم أزرار التصنيفات المعيارية الجاهزة مع خيار كتابة عنوان حر يدوياً.
> 4. حصر حذف المستندات على السوبر أدمن والإدارة العليا فقط.
> 5. إبقاء قسم المرفقات مستقلاً دون التأثير على حساب نسبة اكتمال الملف الحالية.

---

## Proposed Changes

### 1. معالج التعيين (`01.1-worker-registration`)

#### [MODIFY] [flow.handler.ts](file:///f:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.1-worker-registration/flow.handler.ts)
- الاحتفاظ ببافر صورتي الوجه والظهر في الـ state / draft عند تنزيلهما في `handlePhotoInput`.
- عند إتمام التسجيل وتوليد الكود الوظيفي (`workerCode`)، استدعاء `workerStorageService.saveWorkerIdLocally(code, frontBuf, backBuf)`.
- تمرير المسارين المحفوظين إلى `service.registerWorker`.

#### [MODIFY] [flow.service.ts](file:///f:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.1-worker-registration/flow.service.ts)
- دعم مسارات صور البطاقة المحفوظة في مدخلات التسجيل `idCardFrontPath` و `idCardBackPath`.

#### [MODIFY] [flow.repository.ts](file:///f:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.1-worker-registration/flow.repository.ts)
- التأكد من حفظ `idCardFrontPath` و `idCardBackPath` في جدول `Worker`.
- إنشاء سجلين تلقائيين في جدول `WorkerDocument` تحت تصنيف `NATIONAL_ID` أو `PASSPORT`.

---

### 2. أرشيف ومستندات العامل في دليل العاملين (`01.5-worker-directory`)

#### [MODIFY] [flow.types.ts](file:///f:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.5-worker-directory/flow.types.ts)
- تعريف أنواع `WorkerDocumentItem` و `WorkerDocUploadState`.

#### [MODIFY] [flow.repository.ts](file:///f:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.5-worker-directory/flow.repository.ts)
- إضافة استعلامات: `findWorkerDocuments(workerId)`, `findDocumentById(docId)`, `createDocument(payload)`, `deleteDocument(docId)`.

#### [MODIFY] [flow.service.ts](file:///f:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.5-worker-directory/flow.service.ts)
- إضافة منطق جلب المستندات، حساب عدد المرفقات، والتحقق من صلاحية الحذف (Super Admin فقط).

#### [MODIFY] [flow.keyboard.ts](file:///f:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.5-worker-directory/flow.keyboard.ts)
- إضافة زر `[ 📁 مستندات ومرفقات العامل ]` في `profile360ActionsKeyboard`.
- لوحة أزرار `documentsListKeyboard` لقائمة المستندات وزر الإضافة.
- لوحة أزرار `documentViewKeyboard` للمعاينة والحذف للمصرح لهم.
- لوحة أزرار `documentCategoryPickerKeyboard` لاختيار تصنيف المستند.

#### [MODIFY] [flow.messages.ts](file:///f:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.5-worker-directory/flow.messages.ts)
- نصوص رسائل قسم المستندات، تفاصيل المستند، طلب إرسال الملف، والنجاح/الخطأ.

#### [MODIFY] [flow.handler.ts](file:///f:/Alsaada-Smart-Bot/modules/workforce/src/flows/01.5-worker-directory/flow.handler.ts)
- معالجة `action:worker:docs:${workerId}` (فتح الأرشيف).
- معالجة `action:worker:doc_view:${docId}` (إرسال الملف بالـ replyWithPhoto / replyWithDocument).
- معالجة `action:worker:doc_del:${docId}` (حذف المستند للسوبر أدمن فقط).
- معالجة معالج الرفع `action:worker:doc_add:${workerId}` (اختيار التصنيف، إدخال الاسم، استلام الملف، الحفظ في مجلد العامل وقيده في الداتابيز).

---

### 3. خدمة التخزين المخصصة للعامل (`worker-storage.service.ts`)

#### [MODIFY] [worker-storage.service.ts](file:///f:/Alsaada-Smart-Bot/modules/workforce/src/services/worker-storage.service.ts)
- التأكد من مطابقة مسار التخزين `attachments/workers/{workerCode}/` لصور البطاقة والمرفقات.
- إضافة دالة مساعدة لحذف ملف مادي عند حذف المستند.

---

## Verification Plan

### Automated Tests
- اختبارات شاملة في `modules/workforce/src/flows/01.5-worker-directory/tests/flow.documents.spec.ts`:
  1. فحص جلب وعرض قائمة المستندات الخاصة بالعامل.
  2. فحص إضافة مستند بتصنيف معياري وآخر بعنوان مخصص وحفظه في مجلد العامل.
  3. فحص معاينة الملف وإرساله بالنوع الصحيح (صورة / PDF).
  4. فحص الصلاحيات: منع `FIELD_ADMIN` من الحذف وقصر الحذف على `SUPER_ADMIN`.
- تشغيل حزمة الاختبارات:
  ```powershell
  pnpm --filter @alsaada/workforce test
  pnpm --filter @alsaada/workforce build
  ```

### Governance Verification
- التحقق من الالتزام بكافة معايير المشروع:
  ```powershell
  pnpm governance:verify
  ```

---

## 🏁 تقرير الإنجاز النهائي والمطابقة (Execution & Verification Report)

- **الحالة النهائية:** 🟢 **مكتمل وموثق 100%**
- **تاريخ الاعتماد:** 2026-09-16
- **رقم الميزة في سجل الترحيل:** `NEW-78` (`docs/19-legacy-to-enterprise-master-feature-migration-registry.md`)
- **نتائج الاختبارات الآلية:**
  - `pnpm --filter @alsaada/workforce test`: **40/40 ملف اختبار ناجح، 251/251 اختبار ناجح (100% Pass Rate)**.
  - `pnpm --filter @alsaada/workforce test src/flows/01.5-worker-directory/tests/flow.documents.spec.ts`: **10/10 اختبارات شاملة ناجحة**.
- **بناء التايب سكريبت:** `pnpm --filter @alsaada/workforce build` مخرجات نظيفة بنسبة 100% (`tsc exit code 0`).
- **بوابات الحوكمة المؤسسية:**
  - `pnpm arch:verify`: **PASS** (19 فحص معماري وسقف أسطر وخلو تام من `any`).
  - `pnpm migration:verify`: **PASS** (197 وظيفة مسجلة ومطابقة).
  - `pnpm flow-contracts:verify`: **PASS** (19 عقداً مدققاً).
  - `pnpm telegram-contracts:verify`: **PASS** (826 زر ورابط متوافق مع حد 64 بايت).
  - `pnpm docs:audit` & `pnpm docs:parity`: **PASS**.
  - `pnpm financial:verify` & `pnpm perf-budget:verify`: **PASS**.
