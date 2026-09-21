---
target-paths:
  - .agents/rules/04-cryptographic-immutability-engine.md
  - .agents/rules/02-autonomous-execution-and-checkpoints.md
  - GEMINI.md
  - governance.lock.json
approval-phrase: موافق على التعديل او الايقاف او الحذف
---

# 📜 وثيقة إثبات دستورية: حظر الترخيص الذاتي والإلزام المسبق بالأقفال التشفيرية
## Constitutional Enforcement Evidence: Anti-Self-Authorization & Pre-Edit Lock Invariant

> **تاريخ الاعتماد:** 21-09-2026  
> **الجهة الآمرة والمفوضة:** المستخدم (صالح) مباشرة في جلسة الحوار  
> **العبارة الحاكمة الدستورية الصادرة:** `«موافق على التعديل او الايقاف او الحذف»`  
> **نطاق الترخيص وتأثير التغيير:** عزل تام ومحدد بنسبة صفر انتشار (Zero Blast Radius)  

---

### 1. بيان المبرر الهندسي والدستوري (Rationale)
1. **تجريم الترخيص الذاتي (Criminalizing Self-Authorization):** منع أي وكيل ذكاء اصطناعي من توليد أو محاكاة عبارات الاعتماد السيادية داخل ملفات الإثبات أو نصوص الالتزام، واشتراط اقتباسها الحرفي المباشر من مدخلات المستخدم في نافذة الدردشة حصراً.
2. **إلزامية الفحص المسبق قبل التعديل (Mandatory Pre-Edit Lock Inspection):** إلزام الوكلاء بفحص حالة قفل أي ملف في `governance.lock.json` قبل استخدام أي أداة كتابة، والتوقف الفوري لطلب صيغة الفك النظامية.
3. **تعزيز الميثاق الدستوري وموجهات الوكلاء:** تثبيت هذه القواعد بشكل دائم في `GEMINI.md` و `.agents/rules/02` و `.agents/rules/04`.

---

### 2. المسارات المرخصة
- `.agents/rules/04-cryptographic-immutability-engine.md`
- `.agents/rules/02-autonomous-execution-and-checkpoints.md`
- `GEMINI.md`
- `governance.lock.json`

---

### 3. التعديلات المجراة تحت الترخيص (Applied Changes)
1. **`.agents/rules/04-cryptographic-immutability-engine.md`**: إضافة البند 3.4 (حظر الترخيص الذاتي) والبند 5 (الفحص المسبق قبل التعديل).
2. **`.agents/rules/02-autonomous-execution-and-checkpoints.md`**: إضافة البند 1.3 (حظر الترخيص الذاتي والمساس المسبق).
3. **`GEMINI.md`**: إضافة البندين 4 و 5 في القسم 6 لربط الحظر بميثاق النواة السيادي.
4. **`governance.lock.json`**: إعادة احتساب بصمات التشفير SHA-256 وتحديث قفل الحوكمة عبر `pnpm governance:lock`.

---

### 4. بوابات الجودة والتحقق (Quality & Verification Gates)
- فحص نزاهة الحوكمة: `pnpm governance:tamper-check` (Exit Code 0).
- فحص سلامة الأنواع: `pnpm typecheck` (Exit Code 0).
- فحص تدقيق صالح الجنائي: `pnpm audit:saleh` (Verdict: PASS).
