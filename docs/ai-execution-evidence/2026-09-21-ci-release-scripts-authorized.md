---
target-paths:
  - package.json
  - .changeset/config.json
  - pnpm-lock.yaml
  - governance.lock.json
approval-phrase: موافق على التعديل او الايقاف او الحذف
---

# 📜 وثيقة إثبات دستورية: ترخيص سكريبتات إطلاق الإصدارات المؤتمتة وتوافق قفل الحوكمة
## Constitutional Enforcement Evidence: Authorized CI Release Scripts & Changesets Configuration

> **تاريخ الاعتماد:** 21-09-2026  
> **الجهة الآمرة والمفوضة:** المستخدم (صالح) مباشرة في جلسة الحوار  
> **العبارة الحاكمة الدستورية الصادرة:** `«موافق على التعديل او الايقاف او الحذف»`  
> **نطاق الترخيص وتأثير التغيير:** عزل تام ومحدد بنسبة صفر انتشار (Zero Blast Radius)  

---

### 1. بيان المبرر الهندسي (Rationale)
1. **تمكين خط إطلاق الإصدارات المؤتمتة:** إضافة أوامر changesets المفقودة (`version-packages` و `release:tag`) في ملف `package.json` لمطابقة إجراءات GitHub Actions بشكل كامل ومطابق وتمكين نشر الإصدارات أوتوماتيكياً.
2. **اتساق إصدارات الحزم المشتركة:** إدراج حزمة `@alsaada/shared` ضمن مصفوفة الحزم الثابتة `fixed` داخل `.changeset/config.json` لضمان تزامن أرقام الإصدارات لكافة حزم النواة.
3. **سلامة قفل الحزم pnpm-lock.yaml:** تحديث قفل الاعتماديات لتسجيل الحزم المشتركة بصورة رسمية مع منع التعارضات في بيئة البناء والتكامل المستمر (CI).
4. **تحديث القفل التشفيري للحوكمة:** إعادة احتساب البصمات التشفيرية وتحديث `governance.lock.json` بموجب الموافقة الصريحة.

---

### 2. المسارات المرخصة
- `package.json`
- `.changeset/config.json`
- `pnpm-lock.yaml`
- `governance.lock.json`

---

### 3. التعديلات المجراة تحت الترخيص (Applied Changes)
1. **`package.json`**:
   - إضافة سكريبت `"version-packages": "changeset version"`
   - إضافة سكريبت `"release:tag": "changeset publish"`
2. **`.changeset/config.json`**:
   - إدراج `"@alsaada/shared"` في مصفوفة الحزم المتزامنة `fixed`.
3. **`pnpm-lock.yaml`**:
   - توثيق قيد الحزمة المشتركة `packages/shared`.
4. **`governance.lock.json`**:
   - تحديث بصمة SHA-256 للملفات المحمية بموجب أمر `pnpm governance:lock`.

---

### 4. بوابات الجودة والتحقق (Quality & Verification Gates)
- **فحص نزاهة الحوكمة ومكافحة التلاعب:** اجتياز فحص `pnpm governance:tamper-check` (Exit Code 0، فحص 722 كياناً).
- **فحص سلامة الأنواع:** اجتياز `pnpm typecheck` بنجاح تام ودون أخطاء.
- **فحص تدقيق صالح الدستوري:** اجتياز `pnpm audit:saleh` بنجاح تام.
