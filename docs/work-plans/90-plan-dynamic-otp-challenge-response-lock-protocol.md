# خطة عمل رقم 90: بروتوكول التحدي والاستجابة المتغير لفك الأقفال التشفيرية وإلزامية القفل التلقائي للذكاء الاصطناعي
## Work Plan 90: Dynamic OTP Challenge-Response Cryptographic Lock Protocol & Mandatory AI Auto Re-Lock Invariant

> **الحالة:** 🟢 مكتمل وموثق 100% ومطبق ميدانياً  
> **المرجع الدستوري:** `GEMINI.md` (البند 6، 6.3، 6.6)، `docs/26`، `docs/27`، وكتيب القواعد رقم 04 (`.agents/rules/04-cryptographic-immutability-engine.md`)  
> **السلطة الرقابية:** `/saleh` (Sovereign Stakeholder Proxy) × المحرك التشفيري الموحد (`unified-lock-engine.ts`)

---

## 1. الأهداف والغايات
1. **الإلغاء القطعي لراية `--phrase`:** منع وكلاء الذكاء الاصطناعي نهائياً من تمرير عبارات الفتح عبر معاملات سطر الأوامر (CLI flags).
2. **بروتوكول التحدي والاستجابة المتغير (Dynamic OTP Challenge-Response):**
   - **الخطوة 1 (طلب الفتح):** تشغيل `pnpm unlock:request <target> --reason="<justification>"`. يتم توليد رمز OTP مؤقت فريد مشفر (`UNLOCK-XXXXXX`) بصلاحية 300 ثانية (5 دقائق).
   - **الخطوة 2 (التوقف الحتمي وطلب الموافقة البشرية):** يتوقف الوكيل فوراً ويطلب من صالح إصدار الموافقة في الشات:
     `«موافق على الفتح <UNLOCK-XXXXXX>»` أو `«نعم موافق على التعديل <UNLOCK-XXXXXX>»`.
   - **الخطوة 3 (التحقق الجنائي الفيزيائي):** تشغيل `pnpm unlock:confirm <target>`. يفحص المحرك سجل `transcript.jsonl` للتأكد قطيعاً من صدور العبارة والرمز من `USER_EXPLICIT` حصراً، ويحرق الرمز فوراً (Anti-Replay Guard).
3. **حظر التفويض الذاتي الجنائي (Anti-Self-Authorization Guard):** أي محاولة من الوكيل لتوليد أو محاكاة الموافقة تعتبر خرقاً دستورياً جسيماً (`Exit 1`).
4. **إلزامية القفل التلقائي للذكاء الاصطناعي (Mandatory AI Auto Re-Lock Invariant):**
   - فور إنهاء التعديلات المعتمدة، يجب على الوكيل إعادة القفل التشفيري فوراً: `pnpm lock <target>` أو `pnpm lock:all`.
   - إصدار البطاقة الخاتمة الصريحة: `«تم قفل الوظيفة [س]»`.

---

## 2. جدول التحقق الفيزيائي والأدوات المرتبطة
- `tools/scaffold/unlock.ts`: أداة إدارة بروتوكول الفتح (request / confirm).
- `tools/governance/unified-lock-engine.ts`: محرك القفل والتحقق التشفيري الموحد.
- `tools/governance/verify-governance-lock.ts`: فاحص الأقفال وكاتب تجزئات SHA-256.
- `docs/ai-execution-evidence/`: مجلد أدلة التنفيذ الجنائي لعمليات الفتح والقفل.

---
**تاريخ الاعتماد والتنفيذ:** 21 سبتمبر 2026  
**المعتمد:** صالح عثمان (Saleh Osman)
