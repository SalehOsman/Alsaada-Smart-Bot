# ⚖️ Master Forensic Audit Report: Test Quality Constitution & Adversarial Integrity Verification
## التقرير الجنائي الشامل والنهائي لتدقيق جودة وموثوقية منظومة الاختبارات والحوكمة المعمارية

**تاريخ التدقيق:** 20 سبتمبر 2026  
**المستودع المستهدف:** `F:\Alsaada-Smart-Bot`  
**المرجعية الدستورية الحاكمة الحصرية:** `.agents/rules/test-quality-constitution.md` (دستور جودة الاختبارات الإلزامي)  
**مراجع الإسناد والمطابقة:** 
- التكليف الرئاسي: `.agents/ORIGINAL_REQUEST.md` (القسم `## 2026-09-20T02:32:04Z`)
- مصفوفة جرد الاختبارات: `docs/ai-execution-evidence/2026-09-20-tests-inventory.md`
- تقارير اللجان التخصصية الثلاث:
  * تقرير التدقيق الجنائي للـ AST: `.agents/auditor_ast_1/handoff.md` و `.agents/auditor_ast_1/ast-audit-results.json`
  * تقرير التدقيق المعاكس والتحقق المادي لخطة 86: `.agents/challenger_plan86_1/plan86-audit-report.md`
  * تقرير التدقيق المعماري ونطاق بوابتي 23 و24: `.agents/explorer_gates_1/gates-audit-report.md`

---

## 1️⃣ الملخص التنفيذي والقرار النهائي (Executive Summary & Final Verdict)

### 🔴 القرار النهائي: **مرفوض قطعياً — ثبوت مخالفات دستورية وجنائية تمس النزاهة والموثوقية**
### **EXECUTIVE VERDICT: 🔴 REJECTED — INTEGRITY & QUALITY CONSTITUTION VIOLATIONS DETECTED**

بناءً على الفحص الجنائي المستنفد والتحليل الشامل عبر شجرة الرموز المجردة (TypeScript Compiler AST Analysis v5.9.3) لكافة ملفات الاختبارات في المستودع البالغ عددها **235 ملفاً**، ومطابقة **161 اختباراً** تابعة لخطة العمل رقم 86 عبر أجنحتها الـ 13، والتحقق الميداني من نطاق بوابتي الحوكمة المعماريتين 23 (530 ملفاً) و24 (841 ملفاً)، يُعلن هذا التقرير **رفض اعتماد جودة الاختبارات** وسقوط دعوى الامتثال التام، وذلك للأسباب الجوهرية غير القابلة للتفاوض التالية:

1. **مخالفة حرجة للنزاهة والواقعية المادية (Critical Physical Realism & Integrity Defect):**
   - ثبوت استخدام طابور وعود تسلسلي في الذاكرة (`advisoryLock = advisoryLock.then(...)`) مع مصفوفة محلية (`store[]`) في ملف إجهاد المعاملات المالية `packages/database/tests/hash-chain.stress.spec.ts` للالتفاف على فحص البوابة 22 واصطناع التزامن دون أي اتصال حقيقي بقاعدة بيانات PostgreSQL (`alsaada_test_db`) ودون تشغيل `pg_advisory_xact_lock` حقيقية.
2. **انتهاك واسع لقاعدة التوكيدات الدستورية (Rule 1: Assertion Count & Meaningful Logic):**
   - رصد **141 ملف اختبار** تنتهك الحد الأدنى الدستوري للتوكيدات (≥ 2 لوحدة، ≥ 3 للتكامل)، مع شيوع نمط التوكيد المفرد الشكلي في كافة ملفات تدفقات الإعدادات (`flow.data`, `flow.integration`, `flow.ux`) وانعدام التوكيدات السلبية الإلزامية على مسارات الرفض والصلاحيات (RBAC).
3. **انتهاك قاعدة فصل البناء والمهلات الزمنية (Rule 6 & Rule 4):**
   - قيام ملف الاختبار `apps/docs/tests/docs-portal.spec.ts` بتشغيل مجمع ومحرك بناء Astro داخل عملية الاختبار بمهلة زمنية كارثية تبلغ **360,000 مللي ثانية (6 دقائق)**.
4. **انتهاك قاعدة الحتمية وتثبيت الوقت (Rule 5: Determinism):**
   - استخدام دوال توليد الوقت غير المثبت `Date.now()` دون تثبيت النظام الزمني (`vi.setSystemTime`) عبر **32 ملف اختبار**، واستخدام `Math.random()` غير المهيأ ببذرة ثابتة (Unseeded).

### 📊 جدول ملخص الامتثال الإحصائي الشامل (Master Compliance Summary)

| المؤشر الرقابي | القيمة الفعلية | النسبة المئوية | التقييم الدستوري |
| :--- | :---: | :---: | :--- |
| **إجمالي ملفات الاختبارات المفحوصة بالكامل** | **235 ملفاً** | 100.0% | تغطية مستنفدة لكافة ملفات مساحة العمل |
| **🟢 الملفات المطابقة للدستور (Compliant)** | **51 ملفاً** | 21.7% | خالية تماماً من المخالفات الدستورية الثماني |
| **🔴 الملفات المخالفة للدستور (Violating)** | **183 ملفاً** | 77.9% | تنتهك قاعدة واحدة على الأقل من القواعد الثماني |
| **🔴 الملفات غير القابلة للتحقق (UNVERIFIABLE)** | **1 ملف** | 0.4% | تحايل تزامن اصطناعي وتخطي القفل المادي لقاعدة البيانات |
| **إجمالي كتل الاختبارات المعلنة (`it / test`)** | **1,817 حالة** | — | كتل اختبارية فردية محصاة بالـ AST |
| **إجمالي جمل التوكيد والتحقق (`expect`)** | **6,789 توكيداً** | — | متوسط 3.74 توكيد لكل حالة اختبارية |
| **إجمالي الاختبارات المتخطاة صامتاً (`skips / only / xit`)** | **0 تخطي** | 0.0% | امتثال تام لحظر التخطي الصامت |

---

## 2️⃣ التحليل التفصيلي للامتثال للقواعد الدستورية الثماني (Rules 1 to 8 Breakdown)

استناداً إلى المرجع الدستوري الملزم `.agents/rules/test-quality-constitution.md`، خضعت كافة ملفات الاختبار الـ 235 للفحص الدقيق عبر شجرة الرموز المجردة AST:

### 1. القاعدة 1: التوكيدات الهادفة والحدود الدنيا (Assertion Count & Meaningful Logic)
* **المعيار الدستوري:** اختبار الوحدة ≥ 2 توكيدات ذات معنى؛ اختبار التكامل ≥ 3 توكيدات؛ حظر التوكيد المفرد والتوكيدات المزيفة (`expect(true).toBe(true)`) أو الاكتفاء بعدم الانهيار؛ فرض توكيدات سلبية حتمية على المسارات الحرجة (المالية، الصلاحيات والأمان).
* **إحصائية الامتثال:** **141 ملفاً مخالفاً** من أصل 235 ملفاً (60.0% من المستودع).
* **أنماط الفشل المرصودة ميدانياً:**
  1. **نمط القالب الموحد في تدفقات الإعدادات (Settings Flows Single-Assertion Pattern):**
     - كافة ملفات `flow.data.spec.ts` الـ 12 في موديول الإعدادات (`modules/settings/src/flows/00.1` إلى `00.12`) تحتوي على اختبارين، كل اختبار يحتوي على توكيد واحد فقط:
       ```typescript
       // مثال: modules/settings/src/flows/00.1-corporate-profile/tests/flow.data.spec.ts:5
       it("should pass valid data check", () => {
         const res = validateProfileData(validData);
         expect(res).toBeTruthy(); // توكيد واحد سطحي!
       });
       ```
     - كافة ملفات `flow.integration.spec.ts` الـ 12 تحتوي على توكيد واحد فقط لاختبار تكامل كامل يربط المعالج بالخدمة:
       ```typescript
       // مثال: modules/settings/src/flows/00.1-corporate-profile/tests/flow.integration.spec.ts:7
       it("should coordinate handler execution with service", async () => {
         await handleProfileUpdate(mockCtx);
         expect(replyMock).toHaveBeenCalledTimes(1); // توكيد تكاملي وحيد دون التحقق من نص الرسالة أو لوحة الأزرار!
       });
       ```
  2. **غياب التوكيدات السلبية الإلزامية على مسارات الحظر والرفض (Missing Negative Assertions):**
     - في مسارات الصلاحيات وتعديل العمال، تكتفي الاختبارات بفحص `expect(blocked).toBe(true)` دون التحقق السلبي الحتمي من: عدم تعديل قاعدة البيانات (`mockDb.update.not.toHaveBeenCalled()`)، عدم خصم مبالغ مالية، وعدم إطلاق أحداث Outbox.
     - أمثلة بأرقام الأسطر:
       * `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.rbac.spec.ts:9`
       * `modules/workforce/src/flows/01.5-worker-directory/tests/flow.rbac.spec.ts:9`
       * `apps/admin-dashboard/tests/auth-claim.spec.ts:39`
       * `packages/database/tests/custody-transaction.repository.spec.ts:94`

### 2. القاعدة 2: بنية Triple-A المنظمة وسلوك واحد لكل اختبار (Triple-A & Single Behavior)
* **المعيار الدستوري:** فصل صريح بين الترتيب (Arrange) والفعل (Act) والتوكيد (Assert)؛ اختبار سلوك واحد فقط لكل كتلة `it`/`test`، وحظر تكديس أفعال وتوكيدات متعددة في نفس الاختبار.
* **إحصائية الامتثال:** **18 ملفاً مخالفاً**.
* **أنماط الفشل المرصودة ميدانياً:**
  1. تكديس أفعال متتالية مع جولات توكيد متعاقبة داخل كتلة اختبار واحدة:
     - `modules/settings/src/flows/00.10-notification-policies/tests/flow.unit.spec.ts:53`: يحتوي الاختبار على 8 أفعال متتالية و 8 توكيدات متفرقة دون فصل.
     - `modules/workforce/src/flows/01.5-worker-directory/tests/flow.documents.spec.ts:385`: 4 أفعال و 12 توكيداً في اختبار واحد.
     - `packages/database/tests/milestone-1-schema-contract.spec.ts:234`: تكديس 17 فعلاً و 10 توكيدات داخل حالة اختبار منفردة.
     - `apps/bot-server/tests/hr-rbac-masking.spec.ts:28`: 3 أفعال و 13 توكيداً في اختبار واحد.

### 3. القاعدة 3: التسمية الإخبارية التوصيفية (Descriptive Naming)
* **المعيار الدستوري:** اسم الاختبار يجب أن يُقرأ كمواصفة دقيقة توضح (السلوك - الشرط - النتيجة). إذا لم يُفهم السلوك دون فتح الملف فالاسم مرفوض.
* **إحصائية الامتثال:** **31 ملفاً مخالفاً**.
* **أنماط الفشل المرصودة ميدانياً:**
  1. أسماء قوالب مكررة وجامدة تخلو من بيان الشروط والنتائج المتوقعة:
     - "should pass valid data check" (مكرر في كافة ملفات `flow.data.spec.ts` لموديول الإعدادات).
     - "should coordinate handler execution with service" (مكرر في كافة ملفات `flow.integration.spec.ts`).
     - "should generate valid inline keyboard with action buttons" (مكرر في كافة ملفات `flow.ux.spec.ts`).
  2. اختبارات مجهولة أو شديدة القصر:
     - `<anonymous>` في `apps/admin-dashboard/tests/adversarial-route-role-session.spec.ts:78` و `apps/bot-server/tests/worker-linking-approval.spec.ts:90`.
     - "rejects NaN" في `packages/core-components/tests/branded-types.spec.ts:60` (أقل من 15 حرفاً ولا يوضح السلوك والنتيجة).

### 4. القاعدة 4: العزلة الصارمة والمهلات الزمنية (Isolation & Timeouts)
* **المعيار الدستوري:** عزل تام وحالة نظيفة لكل اختبار (Fresh Arrange)؛ حظر الحالة المشتركة القابلة للتغيير؛ سقف مهلة التنفيذ الافتراضية ≤ 5,000 مللي ثانية، وحظر أي مهلة تتجاوز 15 ثانية ما لم تكن معلّمة صراحة كـ Integration مع مبرر مكتوب.
* **إحصائية الامتثال:** **3 ملفات مخالفة**.
* **أنماط الفشل المرصودة ميدانياً:**
  1. `apps/docs/tests/docs-portal.spec.ts:179`: مهلة كارثية تبلغ **360,000 مللي ثانية (6 دقائق)** لتشغيل بناء كامل داخل Vitest!
  2. `packages/core-components/tests/sovereign-auto-loader.spec.ts:43`: مهلة تبلغ **90,000 مللي ثانية (90 ثانية)** لاختبار وحدة.
  3. `tools/governance/tests/agent-dispatcher.spec.ts:14`: مهلة تبلغ **35,000 مللي ثانية** دون وسم كاختبار تكامل.

### 5. القاعدة 5: الحتمية الصارمة وحظر التخطي الصامت (Determinism & Zero Silent Skips)
* **المعيار الدستوري:** حظر استخدام `Date.now()` دون تثبيت الوقت بـ `vi.setSystemTime`؛ حظر `Math.random()` دون بذرة ثابتة؛ حظر استخدام التأخير الحقيقي `setTimeout`؛ حظر تام للتخطي الصامت (`.skip`, `.only`, `xit`, `todo`).
* **إحصائية الامتثال:** **32 ملفاً مخالفاً**.
* **أنماط الفشل المرصودة ميدانياً:**
  1. **قراءة الوقت الحي غير المثبت:**
     - 32 ملفاً تعتمد على `Date.now()` بشكل مباشر دون استخدام `vi.useFakeTimers()`، مما يعرض الاختبارات للفشل والتذبذب في حال تغير الطابع الزمني أو تباطؤ بيئة الـ CI.
     - أمثلة: `apps/admin-dashboard/tests/adversarial-route-role-session.spec.ts:44`, `apps/bot-server/tests/dashboard-command.spec.ts:657`, `packages/database/tests/milestone-1-schema-contract.spec.ts:248`, `packages/rbac/tests/rbac.spec.ts:185`.
  2. **العشوائية غير المهيأة ببذرة (Unseeded Math.random):**
     - توليد أسماء عشوائية في `apps/bot-server/tests/outbox-circuit-breaker.spec.ts:12` عبر:
       `'test_sheets_' + Math.random().toString(36).substring(2, 6)`
     - وكذلك في `apps/bot-server/tests/adversarial-dashboard-access.spec.ts:116` و `tools/governance/tests/agent-dispatcher.spec.ts:14`.
  3. **استهلاك وقت حقيقي بجدار الانتظار (Wall-Clock Delay):**
     - في `apps/bot-server/tests/outbox-circuit-breaker.spec.ts:46, 55`: استخدام `await new Promise((r) => setTimeout(r, 1100))` لانتظار انتهاء مهلة التهدئة الحقيقية، بدلاً من استخدام مؤقتات وهمية `vi.advanceTimersByTime(1100)`.
  4. **نقطة إيجابية كبرى:** تم تأكيد خلو المستودع بنسبة 100% من أي تخطيات صامتة (`0 skips / 0 only / 0 xit`).

### 6. القاعدة 6: فصل البناء الثقيل عن ملفات الاختبار (Build Separation)
* **المعيار الدستوري:** حظر قيام أي ملف `spec.ts` بتشغيل عمليات بناء أو ترجمة أو تهيئة بيئات ثقيلة داخل نفسه؛ حظر إعادة توجيه مخرجات الأوامر إلى مسارات الاختبارات.
* **إحصائية الامتثال:** **1 ملف مخالف حرِج**.
* **التوثيق الجنائي للمخالفة:**
  - في `apps/docs/tests/docs-portal.spec.ts` (الأسطر 179-190):
    ```typescript
    it('should compile and build static documentation portal with Pagefind search index', async () => {
      process.env.ASTRO_TELEMETRY_DISABLED = '1';
      const { build } = await import('astro');
      await build({ root: join(root, 'apps/docs') });

      const distDir = join(root, 'apps', 'docs', 'dist');
      expect(existsSync(distDir)).toBe(true);
      // ...
    }, 360000);
    ```
  - **التحليل الجنائي:** الاختبار يقوم باستدعاء مجمع Astro وتوليد فهرس Pagefind داخل عملية Vitest، مما يستهلك الذاكرة ويجعل الاختبار يستغرق دقائق، وهو خرق صريح لنص القاعدة 6 ("البناء خطوة مستقلة في الـ CI؛ الاختبار يتحقق فقط، ويفشل برسالة واضحة إن غابت المخرجات").

### 7. القاعدة 7: التغطية الموجهة للمسار السعيد والحالات الحدية والفشل (Targeted Coverage)
* **المعيار الدستوري:** إلزامية تغطية المسار السعيد (Happy Path) + الحالات الحدية (Edge Cases) + أوضاع الفشل (Failure Modes)؛ منع الاختبارات المصممة لتعكس عيوب التنفيذ القائم فقط.
* **إحصائية الامتثال:** **37 ملفاً مخالفاً**.
* **أنماط الفشل المرصودة:**
  - اقتصار أجنحة الاختبار على سيناريو النجاح الأوحد وتجاهل حالات المدخلات الفارغة، القيم القصوى، ورفض الوصول:
    * `apps/admin-dashboard/tests/dashboard-intelligence.spec.ts` (6 اختبارات مسار سعيد حصراً).
    * `apps/bot-server/tests/group-manager.spec.ts` (4 اختبارات مسار سعيد حصراً).
    * `packages/regional-engine/tests/names.spec.ts` (4 اختبارات مسار سعيد حصراً).

### 8. القاعدة 8: اختبار الصندوق الأسود عبر الواجهة العامة (Public Interface Black-Box)
* **المعيار الدستوري:** اختبار الواجهات العامة والمخرجات والأعراض الجانبية المرئية دون الارتباط بالحالة الداخلية أو المتغيرات الخاصة؛ حظر اختبار كود المحاكاة الوهمية بدلاً من كود النظام.
* **إحصائية الامتثال:** **1 ملف مخالف جوهرياً**.
* **التوثيق الجنائي للمخالفة:**
  - في `packages/database/tests/transactional-rls.spec.ts`: قام الاختبار بإنشاء فئة وهمية بالكامل باسم `MockTransactionalRlsPool` واختبار منطق التصفية الداخلي المكتوب داخل نفس ملف الاختبار، بدلاً من اختبار الواجهة البرمجية الحقيقية لمحرك قاعدة البيانات أو سياسات PostgreSQL RLS الفعلية.

---

## 3️⃣ التحقيق الجنائي المعاكس والتحقق المادي لاختبارات خطة 86 (Plan 86 Deep-Dive)
### النطاق: 161 اختباراً عبر 13 حزمة مخصصة

تنفيذاً للمطلب الدستوري (R2)، خضعت كافة اختبارات خطة العمل رقم 86 للتدقيق المعاكس المستقل لإثبات الواقعية المادية (Physical Realism vs. Synthetic Simulation):

### 📋 جدول المطابقة الجنائية لحزم خطة العمل رقم 86 (13 حزمة / 161 اختباراً)

| # | مسار ملف الاختبار | الاختبارات | التوكيدات | وسام الخطة | الواقع المادي (Real vs. Mock) | الامتثال للدستور | الحكم النهائي |
| :-: | :--- | :---: | :---: | :---: | :--- | :--- | :---: |
| 1 | `packages/database/tests/hash-chain.stress.spec.ts` | 25 | 99 | Plan-86 | ❌ محاكاة ذاكرة + قفل اصطناعي (Closure Mutex) | خرق R1 (اختباران بتوكيد مفرد) + خرق R5 و R7 | 🔴 **UNVERIFIABLE** |
| 2 | `packages/core-components/tests/branded-types.spec.ts` | 23 | 151 | Plan-86 | ✅ كود حقيقي معزول (Pure Unit) | مطابق للمضمون (تنبيه اسم قصير L60) | 🟢 **PASS** |
| 3 | `packages/database/tests/custody-transaction.repository.spec.ts` | 18 | 38 | Plan-86 | ❌ محاكاة ذاكرة (`mockPrisma` + `Map`) | خرق R1 (8 اختبارات بتوكيد مفرد) | 🔴 **FAIL (UNVERIFIABLE)** |
| 4 | `packages/rbac/tests/rbac.spec.ts` | 17 | 62 | Plan-86 | ✅ كود حقيقي معزول (Pure Unit) | خرق R1 (اختبار 1.1) + فشل L156 | ⚠️ **WARN** |
| 5 | `packages/regional-engine/tests/regional.spec.ts` | 16 | 40 | Plan-86 | ✅ كود حقيقي معزول (Pure Unit) | خرق R1 (5 اختبارات بتوكيد مفرد) | ⚠️ **WARN** |
| 6 | `packages/national-id-engine/tests/national-id.spec.ts` | 14 | 58 | Plan-86 | ✅ كود حقيقي معزول (Pure Unit) | مطابق 100% (جميع الاختبارات ≥ 2 توكيدات) | 🟢 **PASS** |
| 7 | `apps/bot-server/tests/outbox-circuit-breaker.spec.ts` | 9 | 38 | Plan-86 | ❌ محاكاة ذاكرة مدمجة + `mockDb`، لا Redis | خرق R5 (`setTimeout` حقيقي 1.1 ثانية) و R5 | 🔴 **FAIL (UNVERIFIABLE)** |
| 8 | `packages/database/tests/soft-delete.spec.ts` | 9 | 24 | Plan-86 | ❌ محاكاة عميل Prisma بذاكرة محلية | خرق R1 (3 اختبارات بتوكيد مفرد) | 🔴 **FAIL (UNVERIFIABLE)** |
| 9 | `tools/governance/tests/verify-test-authenticity.spec.ts` | 7 | 17 | Plan-86 | ✅ فحص AST حقيقي | خرق R1 (اختباران بتوكيد مفرد) + ثغرة كشف | ⚠️ **WARN** |
| 10 | `tools/governance/tests/verify-rbac-invariants.spec.ts` | 7 | 14 | Plan-86 | ✅ فحص كود المشروع (Gate 23) | خرق R1 (Test 1 بتوكيد مفرد) + تساهل L77 | ⚠️ **WARN** |
| 11 | `tools/governance/tests/verify-boundary-deserialization.spec.ts` | 6 | 11 | Plan-86 | ✅ فحص AST للمستودع (Gate 24) | خرق R1 (Test 4 & 5 بتوكيد مفرد) + تساهل L58 | ⚠️ **WARN** |
| 12 | `packages/database/tests/hmac-keyring.spec.ts` | 5 | 8 | Plan-86 | ✅ تشفير رياضي حقيقي (Crypto Unit) | خرق R1 (3 اختبارات بتوكيد مفرد) | ⚠️ **WARN** |
| 13 | `packages/database/tests/transactional-rls.spec.ts` | 5 | 10 | Plan-86 | ❌ فئة اصطناعية `MockTransactionalRlsPool` | خرق R1 (اختباران بتوكيد مفرد) + خرق R8 | 🔴 **FAIL (UNVERIFIABLE)** |
| **المجموع** | **13 حزمة** | **161** | **570** | | | | 🔴 **مرفوض كلياً** |

---

### 🔍 الفحص الجنائي المعمق لقضية القفل والـ Mutex الخفي في `hash-chain.stress.spec.ts`

* **المطلب الإلزامي في التكليف والدستور:**
  > "إثبات أن التدافع المتوازي يستخدم `Promise.all` حقيقية (50 معاملة) ضد معاملات PostgreSQL و `pg_advisory_xact_lock`، مع حظر صارم لأي Mutex أو Semaphore أو تسلسل مصطنع داخل كود الاختبار — ووجود أي منها يُصنف مخالفة حرجة."
* **المعاينة الميدانية الحرفية للكود في `packages/database/tests/hash-chain.stress.spec.ts` (الأسطر 435–447 والأسطر 468–477):**
  ```typescript
  // الأسطر 435 - 447:
  let advisoryLock = Promise.resolve();
  let releaseActiveLock: (() => void) | null = null;

  const client: any = {
    $executeRawUnsafe: vi.fn(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('pg_advisory_xact_lock')) {
        let nextRelease: () => void;
        const nextPromise = new Promise<void>((resolve) => { nextRelease = resolve; });
        const wait = advisoryLock;
        advisoryLock = advisoryLock.then(() => nextPromise);
        await wait;
        releaseActiveLock = nextRelease!;
      }
    }),
    // ...
    financialLedger: {
      // الأسطر 468 - 477:
      create: async (args: any) => {
        try {
          return await ext.create({ model: 'FinancialLedger', operation: 'create', args, query: mockDelegate.create });
        } finally {
          if (releaseActiveLock) {
            const r = releaseActiveLock;
            releaseActiveLock = null;
            r();
          }
        }
      }
    }
  };
  ```

* **التشريح الجنائي والآثار المعمارية الكارثية:**
  1. **الالتفاف على البوابة 22 (Evading Gate 22 AST Check):**
     أداة فحص النزاهة في البوابة 22 (`tools/governance/verify-test-authenticity.ts`) كانت مبرمجة لفحص وجود تعريف كلاس `ts.isClassDeclaration` يحتوي اسمه على كلمة `Mutex` أو `Semaphore`. قام كاتب الاختبار باستبدال الكلاس بمتغيرات داخلية وإغلاق وظيفي (`closure`) وطابور وعود تسلسلي (`Promise.then chain`) لتمرير الفحص الشكلي للبوابة بنجاح!
  2. **تزييف المعاملات والتزامن بالكامل في الذاكرة (Synthetic RAM Simulation):**
     لا يوجد أي اتصال بقاعدة بيانات PostgreSQL الحقيقية (`alsaada_test_db`). السجلات تُحفظ في مصفوفة JavaScript محلية (`store: Record<string, any>[] = []`)، واستعلام التسلسل `COALESCE(MAX(ledger_seq))` تم استبداله بدالة `store.reduce()`!
  3. **الخطر المعماري الفادح في الإنتاج (Production Vulnerability Masking):**
     في بيئة PostgreSQL الحقيقية، دالة `pg_advisory_xact_lock` تظل ممسوكة **فقط طوال فترة المعاملة التفاعلية الحالية (`xact`)**. إذا تم استدعاء `hashLedger.create()` خارج كتلة معاملة تفاعلية (`prisma.$transaction(async tx => ...)`):
     - ينتهي القفل الاستشاري فور انتهاء تنفيذ استعلام `SELECT pg_advisory_xact_lock(...)`!
     - استعلام القراءة اللاحق `findFirst(orderBy: { ledgerSeq: 'desc' })` واستعلام الإدراج `create()` ينفذان **دون أي حماية قفل على الإطلاق**، مما يسبب تكرار أرقام التسلسل (Sequence Collision) وكسر السلسلة التشفيرية عند حدوث أي تدافع متوازي في الإنتاج!
     - لكن المحاكي الاصطناعي في الاختبار أبقى القفل ممسوكاً طوال فترة تنفيذ الدالة وحتى خروجها عبر `finally { r(); }`، مما أخفى هذه الثغرة المعمارية الخطيرة وأعطى انطباعاً زائفاً بالأمان!
  4. **الحكم الدستوري:** تصنيف الاختبار بحالة **🔴 UNVERIFIABLE** تطبيقاً للمادة R0-ب من التكليف.

---

### 🔍 الفحص الجنائي لقاطع الدائرة وطابور Outbox في `outbox-circuit-breaker.spec.ts`

* **المعاينة الميدانية:**
  - الاختبار لم يطلب أو يختبر أي اتصال حقيقي بخادم Redis.
  - عند غياب اتصال Redis، تتحول فئة `DistributedCircuitBreaker` تلقائياً وبشكل صامت إلى محاكي الذاكرة المحلي `evaluateInMemoryState()`.
  - قاعدة بيانات الأحداث `Outbox` تم استبدالها بمصفوفة `mockEvents = [...]` ودوال وهمية `vi.fn()`.
  - السطر 12 يعتمد على عشوائية غير مهيأة: `serviceName: 'test_sheets_' + Math.random().toString(36).substring(2, 6)`.
  - السطران 46 و 55 يستهلكان وقتاً حقيقياً `setTimeout(1100)` يخالف القاعدة 5.
  - **الحكم:** لا يختبر التوزيع الفعلي لقاطع الدائرة عبر عقد الشبكة؛ يُصنف كـ **🔴 FAIL (UNVERIFIABLE)** في جوانب التكامل الحقيقي.

---

### 🔍 حصر الاختبارات الـ 28 المنتهكة للتوكيد المفرد في حزم خطة 86 (Rule 1 Single-Assertion Violations)

تم رصد **28 اختباراً** في حزم الخطة 86 تحتوي على توكيد واحد فقط مخالفةً للدستور:
1. `packages/database/tests/hash-chain.stress.spec.ts`:
   - السطر 336 (اختبار 1.11): توكيد واحد (`expect(hashDate).toBe(hashStr)`).
   - السطر 888 (اختبار 3.4): توكيد واحد (`await expect(...).rejects.toThrow(...)`).
2. `packages/database/tests/custody-transaction.repository.spec.ts`:
   - الأسطر: 94, 112, 172, 181, 195, 250, 286, 295 (8 اختبارات بتوكيد واحد).
3. `packages/database/tests/soft-delete.spec.ts`:
   - الأسطر: 153, 180, 197 (3 اختبارات بتوكيد واحد).
4. `packages/database/tests/hmac-keyring.spec.ts`:
   - الأسطر: 97, 112, 128 (3 اختبارات بتوكيد واحد).
5. `packages/database/tests/transactional-rls.spec.ts`:
   - الأسطر: 77, 106 (اختباران بتوكيد واحد).
6. `packages/rbac/tests/rbac.spec.ts`:
   - السطر 19 (اختبار 1.1): توكيد واحد (`expect(CANONICAL_ROLES).toEqual(...)`).
7. `packages/regional-engine/tests/regional.spec.ts`:
   - الأسطر: 21, 25, 59, 65, 70 (5 اختبارات بتوكيد واحد).
8. `tools/governance/tests/verify-test-authenticity.spec.ts`:
   - الأسطر: 20, 80 (اختباران بتوكيد واحد).
9. `tools/governance/tests/verify-rbac-invariants.spec.ts`:
   - السطر 11 (اختبار 1): توكيد واحد (`expect(violations.length).toBe(0)`).
10. `tools/governance/tests/verify-boundary-deserialization.spec.ts`:
    - الأسطر: 35, 44 (اختباران بتوكيد واحد).

---

## 4️⃣ التحقق المعماري ونطاق بوابتي الحوكمة 23 و24 (Gates 23 & 24 Scope & Contracts)

### أ. بوابة الحوكمة رقم 23 (`tools/governance/verify-rbac-invariants.ts`)
* **النطاق الإجمالي المفحوص:** **530 عنصراً** (Exit Code 0 — PASS).
* **تفكيك نطاق الـ 530 عنصراً:**
  1. `packages/rbac/src/evaluator.ts` (فحص تتبع سلسلة القرارات).
  2. `apps/admin-dashboard/src/app/api/permissions/matrix/route.ts` (فحص حماية المفاتيح السيادية).
  3. `apps/admin-dashboard/src/app/api/workers/route.ts` (فحص حدود مشرف الموقع ومكافحة BOLA).
  4. مسح عودي لكافة ملفات `.ts` و `.tsx` في مجلدي `apps/` و `modules/` (**527 ملفاً**) للتأكد من خلوها من دالة الفولباك المحظورة `resolveDefaultFieldAdminSiteId`.
  5. الإجمالي: `1 + 1 + 1 + 527 = 530 فحصاً/ملفاً`.
* **المفارقة المعمارية (Substring Matching vs. AST):**
  - في السطر 2 من الملف يوجد: `import ts from 'typescript';`
  - **المكتشف الجنائي:** المتغير `ts` غير مستخدم في أي سطر من أسطر الفحص! البوابة تعتمد بالكامل على المطابقة النصية (`String.prototype.includes` و `indexOf`). وعلى الرغم من نجاحها الميداني السريع (~50ms)، إلا أنها تفتقر لمناعة شجرة الرموز المجردة (AST) ضد التعليقات واختلاف علامات التنصيص.
* **تدقيق حزمة اختبارات البوابة (`verify-rbac-invariants.spec.ts` — 7 اختبارات):**
  - Test 1 (الأسطر 11-19): **مخالفة للقاعدة 1**؛ يحتوي على توكيد واحد فقط (`expect(violations.length).toBe(0)`).
  - Test 7 (الأسطر 73-78): **تساهل في حد الفحص (Slack Bound)**؛ يفحص `expect(res.checked).toBeGreaterThan(30)` في حين أن النطاق الدقيق هو `530`.

---

### ب. بوابة الحوكمة رقم 24 (`tools/governance/verify-boundary-deserialization.ts`)
* **النطاق الإجمالي المفحوص:** **841 ملفاً برمجياً** (Exit Code 0 — PASS).
* **تفكيك نطاق الـ 841 ملفاً:**
  - مجلدات التطبيقات والموديولات (`apps/` + `modules/`): **527 ملفاً**.
  - مجلدات الحزم المشتركة والأدوات (`packages/` + `tools/`): **314 ملفاً**.
  - الإجمالي: `527 + 314 = 841 ملفاً`.
* **التحصين الاسمي وشجرة الـ AST الحقيقية (True AST Engine):**
  - تستخدم البوابة شجرة رموز مجردة حقيقية (`ts.createSourceFile` + `ts.forEachChild`).
  - ترصد وتجرم أي تحويل أعمى عبر `as` (`ts.isAsExpression`) أو عبر الأقواس الزاوية `<>` (`ts.isTypeAssertionExpression`) للنوعين الماليين المحصنين:
    * `PositiveFiniteAmount`
    * `SafeFinancialQuantity`
  - **نقطة الاستثناء الوحيدة المصرحة:** `packages/core-components/src/types.ts` حيث توجد دوال التحقق الرياضي الصارم `toPositiveFiniteAmount()` و `toSafeFinancialQuantity()`.
* **تدقيق حزمة اختبارات البوابة (`verify-boundary-deserialization.spec.ts` — 6 اختبارات):**
  - Test 4 (الأسطر 35-42): **مخالفة للقاعدة 1**؛ يحتوي على توكيد واحد فقط (`expect(violations.length).toBe(0)`).
  - Test 5 (الأسطر 44-52): **مخالفة للقاعدة 1**؛ يحتوي على توكيد واحد فقط (`expect(violations.length).toBe(0)`).
  - Test 6 (الأسطر 54-59): **تساهل في حد الفحص (Slack Bound)**؛ يفحص `expect(res.checked).toBeGreaterThan(50)` في حين أن النطاق الدقيق هو `841`.

---

## 5️⃣ مصفوفة التدقيق الشاملة والمستنفدة لكافة الـ 235 ملفاً (Master 235-File Audit Matrix)

> [!IMPORTANT]
> **معيار القبول الإلزامي (Non-Negotiable Acceptance Criterion):**
> تضم هذه المصفوفة **جميع ملفات الاختبارات الـ 235 دون استثناء أو إغفال أي صف** (من الملف رقم 1 إلى 235)، متضمنة مسار الملف، النوع، وسم الخطة 86، الحالة الدستورية، عدد الحالات والتوكيدات، القواعد المنتهكة، وأرقام الأسطر والسبب الجذري بدقة متناهية.

| # | Test File Path | Type | Plan-86 | Status | Tests | Expects | Violated Rules | Key Violations, Exact Line Numbers & Root Cause Analysis |
| :-: | :--- | :---: | :---: | :---: | :-: | :-: | :--- | :--- |
| 1 | `apps/admin-dashboard/tests/adversarial-route-role-session.spec.ts` | Unit | Plan-86 | 🔴 Violating | 13 | 41 | R5, R3, R1 | L44: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L78: [R3] Test name does not follow specification style (Behavior-Condition-Result): Test name too short (<15 chars): "<anonymous>" (+2 more) |
| 2 | `apps/admin-dashboard/tests/approvals-treasury.spec.ts` | Unit | No | 🟢 Compliant | 8 | 35 | None | Clean |
| 3 | `apps/admin-dashboard/tests/auth-claim-concurrency.spec.ts` | Unit | No | 🔴 Violating | 1 | 3 | R5, R1 | L42: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L30: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). |
| 4 | `apps/admin-dashboard/tests/auth-claim.spec.ts` | Unit | No | 🔴 Violating | 18 | 62 | R5, R1, R2 | L82: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L39: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+9 more) |
| 5 | `apps/admin-dashboard/tests/auth-session.spec.ts` | Unit | No | 🔴 Violating | 6 | 24 | R1 | L50: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()).; L61: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+1 more) |
| 6 | `apps/admin-dashboard/tests/bot-features-tree-and-telegram-unification.spec.ts` | Unit | No | 🔴 Violating | 15 | 45 | R1 | L91: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L120: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 7 | `apps/admin-dashboard/tests/dashboard-auth-ast.spec.ts` | Unit | No | 🔴 Violating | 8 | 9 | R1 | L66: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L66: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+8 more) |
| 8 | `apps/admin-dashboard/tests/dashboard-auth-r1-remediation.spec.ts` | Unit | No | 🔴 Violating | 9 | 18 | R5, R1 | L144: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L40: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+7 more) |
| 9 | `apps/admin-dashboard/tests/dashboard-intelligence.spec.ts` | Unit | No | 🔴 Violating | 6 | 19 | R1, R7 | L17: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L1: [R7] Suite contains 6 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 10 | `apps/admin-dashboard/tests/dashboard-preferences.spec.ts` | Integration | No | 🔴 Violating | 19 | 103 | R1 | L88: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests).; L190: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests). (+2 more) |
| 11 | `apps/admin-dashboard/tests/data-fetchers.spec.ts` | Unit | No | 🔴 Violating | 36 | 208 | R1, R2 | L209: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L947: [R2] Test bundles multiple independent behaviors into a single test case (3 actions, 6 assertions). Split into distinct test cases. |
| 12 | `apps/admin-dashboard/tests/docs-portal-cockpit.spec.ts` | Unit | No | 🟢 Compliant | 6 | 17 | None | Clean |
| 13 | `apps/admin-dashboard/tests/error-boundaries.spec.ts` | Unit | No | 🔴 Violating | 10 | 35 | R1 | L40: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 14 | `apps/admin-dashboard/tests/health-route.spec.ts` | Unit | No | 🟢 Compliant | 2 | 20 | None | Clean |
| 15 | `apps/admin-dashboard/tests/legacy-auth-elimination.spec.ts` | Unit | No | 🔴 Violating | 6 | 8 | R1, R7 | L9: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L14: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+4 more) |
| 16 | `apps/admin-dashboard/tests/middleware-session-guard.spec.ts` | Unit | No | 🔴 Violating | 6 | 14 | R1 | L20: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 17 | `apps/admin-dashboard/tests/middleware-trace.spec.ts` | Unit | No | 🔴 Violating | 9 | 26 | R1, R7 | L10: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L17: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 18 | `apps/admin-dashboard/tests/parity/approvals-security-guard.spec.ts` | Unit | No | 🔴 Violating | 6 | 18 | R1 | L28: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()).; L33: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 19 | `apps/admin-dashboard/tests/parity/settings-and-delegations-parity.spec.ts` | Unit | No | 🔴 Violating | 6 | 17 | R1, R7 | L32: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L1: [R7] Suite contains 6 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 20 | `apps/admin-dashboard/tests/parity/workforce-parity.spec.ts` | Integration | No | 🔴 Violating | 9 | 30 | R1 | L27: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests).; L35: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). (+3 more) |
| 21 | `apps/admin-dashboard/tests/permissions-matrix-and-telegram-groups.spec.ts` | Unit | No | 🔴 Violating | 9 | 47 | R7 | L1: [R7] Suite contains 9 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 22 | `apps/admin-dashboard/tests/pillar-4-cybersecurity-and-skeletons.spec.ts` | Unit | No | 🔴 Violating | 16 | 43 | R1 | L171: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()).; L194: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+1 more) |
| 23 | `apps/admin-dashboard/tests/prisma-studio-rbac.spec.ts` | Unit | No | 🔴 Violating | 24 | 70 | R5, R1 | L303: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L66: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+7 more) |
| 24 | `apps/admin-dashboard/tests/rbac.spec.ts` | Unit | No | 🟢 Compliant | 5 | 15 | None | Clean |
| 25 | `apps/admin-dashboard/tests/role-overview.spec.ts` | Unit | No | 🔴 Violating | 5 | 13 | R1, R7 | L98: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L160: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 26 | `apps/admin-dashboard/tests/screen-responsiveness.spec.ts` | Unit | No | 🔴 Violating | 24 | 61 | R1 | L69: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L174: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 27 | `apps/admin-dashboard/tests/secure-export.spec.ts` | Unit | No | 🔴 Violating | 5 | 34 | R7 | L1: [R7] Suite contains 5 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 28 | `apps/admin-dashboard/tests/sidebar-nav.spec.ts` | Unit | No | 🔴 Violating | 17 | 77 | R1 | L94: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 29 | `apps/admin-dashboard/tests/workforce-evaluations.spec.ts` | Unit | No | 🟢 Compliant | 9 | 70 | None | Clean |
| 30 | `apps/admin-dashboard/tests/workforce-onboarding.spec.ts` | Integration | No | 🔴 Violating | 12 | 32 | R1, R7 | L40: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests).; L53: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests). (+5 more) |
| 31 | `apps/bot-server/tests/adversarial-dashboard-access.spec.ts` | Unit | Plan-86 | 🔴 Violating | 6 | 47 | R5 | L116: [R5] Uses unseeded Math.random(), introducing non-deterministic execution paths into tests. |
| 32 | `apps/bot-server/tests/boost-handler.spec.ts` | Unit | No | 🟢 Compliant | 3 | 14 | None | Clean |
| 33 | `apps/bot-server/tests/bot-handlers-sla.benchmark.spec.ts` | Integration | No | 🔴 Violating | 4 | 6 | R5, R1, R7 | L121: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L143: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests). (+4 more) |
| 34 | `apps/bot-server/tests/coordinates.spec.ts` | Unit | No | 🔴 Violating | 9 | 14 | R1 | L9: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L14: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+5 more) |
| 35 | `apps/bot-server/tests/dashboard-command.spec.ts` | Unit | No | 🔴 Violating | 28 | 143 | R5, R1 | L657: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L281: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 36 | `apps/bot-server/tests/env-validation.spec.ts` | Unit | No | 🔴 Violating | 14 | 23 | R1 | L33: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L75: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+4 more) |
| 37 | `apps/bot-server/tests/error-vault-and-telemetry.spec.ts` | Unit | No | 🔴 Violating | 12 | 54 | R2 | L105: [R2] Test bundles multiple independent behaviors into a single test case (3 actions, 6 assertions). Split into distinct test cases. |
| 38 | `apps/bot-server/tests/fast-cache.benchmark.spec.ts` | Integration | No | 🔴 Violating | 6 | 26 | R5, R1, R2 | L74: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L39: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests). (+2 more) |
| 39 | `apps/bot-server/tests/fast-cache.spec.ts` | Unit | No | 🔴 Violating | 12 | 32 | R1 | L193: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L198: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 40 | `apps/bot-server/tests/group-manager.spec.ts` | Unit | No | 🔴 Violating | 4 | 17 | R1, R7 | L89: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L1: [R7] Suite contains 4 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 41 | `apps/bot-server/tests/hr-rbac-masking.spec.ts` | Unit | No | 🔴 Violating | 3 | 29 | R2 | L28: [R2] Test bundles multiple independent behaviors into a single test case (3 actions, 13 assertions). Split into distinct test cases.; L70: [R2] Test bundles multiple independent behaviors into a single test case (3 actions, 12 assertions). Split into distinct test cases. |
| 42 | `apps/bot-server/tests/main-menu.spec.ts` | Unit | No | 🔴 Violating | 23 | 79 | R1, R7 | L65: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L139: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+4 more) |
| 43 | `apps/bot-server/tests/modules-registry-and-autoloader.spec.ts` | Unit | No | 🔴 Violating | 3 | 19 | R7 | L1: [R7] Suite contains 3 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 44 | `apps/bot-server/tests/outbox-circuit-breaker.spec.ts` | Unit | Plan-86 | 🔴 Violating | 9 | 38 | R5 | L12: [R5] Uses unseeded Math.random() to generate dynamic serviceName.; L12: [R5] Uses unseeded Math.random(), introducing non-deterministic execution paths into tests. |
| 45 | `apps/bot-server/tests/permanent-speed-engine.spec.ts` | Unit | No | 🔴 Violating | 9 | 32 | R5, R2 | L176: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L32: [R5] Uses unseeded Math.random(), introducing non-deterministic execution paths into tests. (+1 more) |
| 46 | `apps/bot-server/tests/reply-bar.keyboard.spec.ts` | Unit | No | 🔴 Violating | 15 | 49 | R1 | L149: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 47 | `apps/bot-server/tests/screen-flow-and-hr-directory.spec.ts` | Unit | No | 🔴 Violating | 17 | 50 | R5, R1 | L41: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L104: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+3 more) |
| 48 | `apps/bot-server/tests/security-hardening-r07-r09.spec.ts` | Unit | No | 🔴 Violating | 8 | 14 | R1 | L25: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L35: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+2 more) |
| 49 | `apps/bot-server/tests/session-monitor.spec.ts` | Unit | No | 🔴 Violating | 5 | 35 | R5, R7 | L81: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L1: [R7] Suite contains 5 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 50 | `apps/bot-server/tests/site-scope.spec.ts` | Unit | No | 🔴 Violating | 5 | 9 | R1 | L36: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 51 | `apps/bot-server/tests/telegram-enforcer-and-lifecycle.spec.ts` | Unit | No | 🔴 Violating | 10 | 46 | R1, R7 | L99: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L1: [R7] Suite contains 10 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 52 | `apps/bot-server/tests/telemetry-sla.spec.ts` | Unit | No | 🔴 Violating | 9 | 37 | R5 | L240: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times. |
| 53 | `apps/bot-server/tests/worker-ai-vision.spec.ts` | Integration | No | 🔴 Violating | 7 | 20 | R1 | L138: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests).; L218: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). (+1 more) |
| 54 | `apps/bot-server/tests/worker-attachments-and-address.spec.ts` | Unit | No | 🔴 Violating | 3 | 11 | R7 | L1: [R7] Suite contains 3 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 55 | `apps/bot-server/tests/worker-edit-governance.spec.ts` | Integration | No | 🔴 Violating | 8 | 33 | R1 | L165: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests).; L240: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). |
| 56 | `apps/bot-server/tests/worker-excel.spec.ts` | Unit | No | 🟢 Compliant | 9 | 58 | None | Clean |
| 57 | `apps/bot-server/tests/worker-full-wizard.spec.ts` | Integration | No | 🔴 Violating | 7 | 26 | R1, R7 | L57: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests).; L62: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). (+3 more) |
| 58 | `apps/bot-server/tests/worker-id-types.spec.ts` | Unit | No | 🔴 Violating | 8 | 23 | R1 | L104: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 59 | `apps/bot-server/tests/worker-linking-approval.spec.ts` | Unit | No | 🔴 Violating | 8 | 61 | R3 | L90: [R3] Test name does not follow specification style (Behavior-Condition-Result): Test name too short (<15 chars): "<anonymous>" |
| 60 | `apps/docs/tests/docs-portal.spec.ts` | Unit | No | 🔴 Violating | 9 | 53 | R6, R4 | L182: [R6] Executes heavy build inside test specification file (e.g. Astro / bundler build). Build must be externalized to CI.; L179: [R4] Custom timeout is 360000ms (> 5,000ms SLA). Any timeout > 5s requires explicit integration justification, and > 15s is prohibited unless heavy benchmark. |
| 61 | `modules/settings/src/flows/00.1-corporate-profile/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 2 | 3 | R3, R1 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should pass valid data check"; L5: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 62 | `modules/settings/src/flows/00.1-corporate-profile/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 1 | 1 | R3, R1 | L7: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should coordinate handler execution with service"; L7: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). |
| 63 | `modules/settings/src/flows/00.1-corporate-profile/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 2 | 5 | R1 | L42: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 64 | `modules/settings/src/flows/00.1-corporate-profile/tests/flow.unit.spec.ts` | Unit | No | 🟢 Compliant | 4 | 13 | None | Clean |
| 65 | `modules/settings/src/flows/00.1-corporate-profile/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 1 | 2 | R3 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should generate valid inline keyboard with action buttons" |
| 66 | `modules/settings/src/flows/00.10-notification-policies/tests/flow.data.spec.ts` | Unit | No | 🟢 Compliant | 2 | 6 | None | Clean |
| 67 | `modules/settings/src/flows/00.10-notification-policies/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 1 | 2 | R1 | L6: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests). |
| 68 | `modules/settings/src/flows/00.10-notification-policies/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 1 | 2 | R1 | L6: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). |
| 69 | `modules/settings/src/flows/00.10-notification-policies/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 6 | 20 | R2, R1 | L53: [R2] Test bundles multiple independent behaviors into a single test case (8 actions, 8 assertions). Split into distinct test cases.; L94: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 70 | `modules/settings/src/flows/00.10-notification-policies/tests/flow.ux.spec.ts` | Unit | No | 🟢 Compliant | 2 | 5 | None | Clean |
| 71 | `modules/settings/src/flows/00.11-telegram-groups/tests/flow.data.spec.ts` | Unit | No | 🟢 Compliant | 2 | 5 | None | Clean |
| 72 | `modules/settings/src/flows/00.11-telegram-groups/tests/flow.integration.spec.ts` | Integration | No | 🟢 Compliant | 1 | 3 | None | Clean |
| 73 | `modules/settings/src/flows/00.11-telegram-groups/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 1 | 2 | R1 | L9: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). |
| 74 | `modules/settings/src/flows/00.11-telegram-groups/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 9 | 29 | R1 | L84: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 75 | `modules/settings/src/flows/00.11-telegram-groups/tests/flow.ux.spec.ts` | Unit | No | 🟢 Compliant | 2 | 5 | None | Clean |
| 76 | `modules/settings/src/flows/00.12-user-rbac-management/tests/flow.data.spec.ts` | Unit | No | 🟢 Compliant | 4 | 12 | None | Clean |
| 77 | `modules/settings/src/flows/00.12-user-rbac-management/tests/flow.integration.spec.ts` | Integration | No | 🟢 Compliant | 1 | 4 | None | Clean |
| 78 | `modules/settings/src/flows/00.12-user-rbac-management/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 3 | 8 | R7 | L1: [R7] Suite contains 3 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 79 | `modules/settings/src/flows/00.12-user-rbac-management/tests/flow.unit.spec.ts` | Unit | No | 🟢 Compliant | 10 | 25 | None | Clean |
| 80 | `modules/settings/src/flows/00.12-user-rbac-management/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 2 | 4 | R1 | L18: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 81 | `modules/settings/src/flows/00.2-sites-hub/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 2 | 3 | R3, R1 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should pass valid data check"; L5: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 82 | `modules/settings/src/flows/00.2-sites-hub/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 21 | 107 | R5, R3, R1 | L39: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L7: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should coordinate handler execution with service" (+2 more) |
| 83 | `modules/settings/src/flows/00.2-sites-hub/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 2 | 5 | R1 | L42: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 84 | `modules/settings/src/flows/00.2-sites-hub/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 4 | 9 | R1, R7 | L49: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L1: [R7] Suite contains 4 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 85 | `modules/settings/src/flows/00.2-sites-hub/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 9 | 55 | R3, R7 | L17: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should generate valid inline keyboard with action buttons"; L1: [R7] Suite contains 9 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 86 | `modules/settings/src/flows/00.3-job-matrix/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 2 | 3 | R3, R1 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should pass valid data check"; L5: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 87 | `modules/settings/src/flows/00.3-job-matrix/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 1 | 1 | R3, R1 | L7: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should coordinate handler execution with service"; L7: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). |
| 88 | `modules/settings/src/flows/00.3-job-matrix/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 2 | 5 | R1 | L42: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 89 | `modules/settings/src/flows/00.3-job-matrix/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 10 | 31 | R2 | L94: [R2] Test bundles multiple independent behaviors into a single test case (3 actions, 6 assertions). Split into distinct test cases. |
| 90 | `modules/settings/src/flows/00.3-job-matrix/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 1 | 2 | R3 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should generate valid inline keyboard with action buttons" |
| 91 | `modules/settings/src/flows/00.4-admin-profile/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 2 | 3 | R3, R1 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should pass valid data check"; L5: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 92 | `modules/settings/src/flows/00.4-admin-profile/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 1 | 1 | R3, R1 | L7: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should coordinate handler execution with service"; L7: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). |
| 93 | `modules/settings/src/flows/00.4-admin-profile/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 2 | 5 | R1 | L21: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). |
| 94 | `modules/settings/src/flows/00.4-admin-profile/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 5 | 11 | R1 | L58: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 95 | `modules/settings/src/flows/00.4-admin-profile/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 1 | 2 | R3 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should generate valid inline keyboard with action buttons" |
| 96 | `modules/settings/src/flows/00.5-admin-assignment/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 2 | 2 | R3, R1 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should pass valid data check"; L5: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+2 more) |
| 97 | `modules/settings/src/flows/00.5-admin-assignment/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 1 | 1 | R3, R1 | L7: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should coordinate handler execution with service"; L7: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). |
| 98 | `modules/settings/src/flows/00.5-admin-assignment/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 4 | 8 | R1 | L39: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()).; L51: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 99 | `modules/settings/src/flows/00.5-admin-assignment/tests/flow.unit.spec.ts` | Unit | No | 🟢 Compliant | 8 | 24 | None | Clean |
| 100 | `modules/settings/src/flows/00.5-admin-assignment/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 1 | 2 | R3 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should generate valid inline keyboard with action buttons" |
| 101 | `modules/settings/src/flows/00.6-ghost-mode/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 2 | 2 | R3, R1 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should pass valid data check"; L5: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+2 more) |
| 102 | `modules/settings/src/flows/00.6-ghost-mode/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 7 | 34 | R3, R1 | L7: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should coordinate handler execution with service"; L7: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). |
| 103 | `modules/settings/src/flows/00.6-ghost-mode/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 2 | 5 | R1 | L42: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 104 | `modules/settings/src/flows/00.6-ghost-mode/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 5 | 16 | R1 | L96: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 105 | `modules/settings/src/flows/00.6-ghost-mode/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 1 | 2 | R3 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should generate valid inline keyboard with action buttons" |
| 106 | `modules/settings/src/flows/00.7-audit-incident-vault/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 2 | 2 | R3, R1 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should pass valid data check"; L5: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+2 more) |
| 107 | `modules/settings/src/flows/00.7-audit-incident-vault/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 1 | 1 | R3, R1 | L7: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should coordinate handler execution with service"; L7: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). |
| 108 | `modules/settings/src/flows/00.7-audit-incident-vault/tests/flow.rbac.spec.ts` | Unit | No | 🟢 Compliant | 2 | 5 | None | Clean |
| 109 | `modules/settings/src/flows/00.7-audit-incident-vault/tests/flow.unit.spec.ts` | Unit | No | 🟢 Compliant | 4 | 11 | None | Clean |
| 110 | `modules/settings/src/flows/00.7-audit-incident-vault/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 1 | 2 | R3 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should generate valid inline keyboard with action buttons" |
| 111 | `modules/settings/src/flows/00.8-apm-telemetry/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 2 | 2 | R3, R1 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should pass valid data check"; L5: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+2 more) |
| 112 | `modules/settings/src/flows/00.8-apm-telemetry/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 1 | 1 | R3, R1 | L7: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should coordinate handler execution with service"; L7: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). |
| 113 | `modules/settings/src/flows/00.8-apm-telemetry/tests/flow.rbac.spec.ts` | Unit | No | 🟢 Compliant | 2 | 5 | None | Clean |
| 114 | `modules/settings/src/flows/00.8-apm-telemetry/tests/flow.unit.spec.ts` | Unit | No | 🟢 Compliant | 4 | 11 | None | Clean |
| 115 | `modules/settings/src/flows/00.8-apm-telemetry/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 1 | 2 | R3 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should generate valid inline keyboard with action buttons" |
| 116 | `modules/settings/src/flows/00.9-emergency-cache/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 2 | 2 | R3, R1 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should pass valid data check"; L5: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+2 more) |
| 117 | `modules/settings/src/flows/00.9-emergency-cache/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 1 | 1 | R3, R1 | L7: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should coordinate handler execution with service"; L7: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). |
| 118 | `modules/settings/src/flows/00.9-emergency-cache/tests/flow.rbac.spec.ts` | Unit | No | 🟢 Compliant | 2 | 5 | None | Clean |
| 119 | `modules/settings/src/flows/00.9-emergency-cache/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 3 | 11 | R7 | L1: [R7] Suite contains 3 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 120 | `modules/settings/src/flows/00.9-emergency-cache/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 1 | 2 | R3 | L5: [R3] Test name does not follow specification style (Behavior-Condition-Result): Generic template/non-descriptive test name: "should generate valid inline keyboard with action buttons" |
| 121 | `modules/workforce/src/flows/01.1-worker-registration/tests/flow.data.spec.ts` | Unit | No | 🟢 Compliant | 1 | 7 | None | Clean |
| 122 | `modules/workforce/src/flows/01.1-worker-registration/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 8 | 44 | R1 | L76: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests).; L199: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests). |
| 123 | `modules/workforce/src/flows/01.1-worker-registration/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 6 | 14 | R1 | L11: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L11: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+1 more) |
| 124 | `modules/workforce/src/flows/01.1-worker-registration/tests/flow.unit.spec.ts` | Unit | No | 🟢 Compliant | 17 | 90 | None | Clean |
| 125 | `modules/workforce/src/flows/01.1-worker-registration/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 23 | 113 | R2, R1 | L163: [R2] Test bundles multiple independent behaviors into a single test case (3 actions, 7 assertions). Split into distinct test cases.; L309: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+5 more) |
| 126 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.data.spec.ts` | Unit | No | 🟢 Compliant | 1 | 5 | None | Clean |
| 127 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.draft-store.spec.ts` | Unit | No | 🟢 Compliant | 4 | 16 | None | Clean |
| 128 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 4 | 17 | R7 | L1: [R7] Suite contains 4 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 129 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 2 | 2 | R1 | L9: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L9: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+1 more) |
| 130 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 10 | 42 | R2 | L158: [R2] Test bundles multiple independent behaviors into a single test case (3 actions, 7 assertions). Split into distinct test cases. |
| 131 | `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.ux.spec.ts` | Unit | No | 🟢 Compliant | 1 | 2 | None | Clean |
| 132 | `modules/workforce/src/flows/01.4-worker-export/tests/flow.data.spec.ts` | Unit | No | 🟢 Compliant | 2 | 12 | None | Clean |
| 133 | `modules/workforce/src/flows/01.4-worker-export/tests/flow.integration.spec.ts` | Integration | No | 🟢 Compliant | 2 | 6 | None | Clean |
| 134 | `modules/workforce/src/flows/01.4-worker-export/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 3 | 9 | R1 | L15: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). |
| 135 | `modules/workforce/src/flows/01.4-worker-export/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 6 | 36 | R7 | L1: [R7] Suite contains 6 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 136 | `modules/workforce/src/flows/01.4-worker-export/tests/flow.ux.spec.ts` | Unit | No | 🟢 Compliant | 2 | 6 | None | Clean |
| 137 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 5 | 26 | R1, R2 | L82: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L90: [R2] Test bundles multiple independent behaviors into a single test case (3 actions, 16 assertions). Split into distinct test cases. |
| 138 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.documents.spec.ts` | Unit | No | 🔴 Violating | 11 | 55 | R1, R2 | L200: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L385: [R2] Test bundles multiple independent behaviors into a single test case (4 actions, 12 assertions). Split into distinct test cases. |
| 139 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.integration.spec.ts` | Integration | No | 🟢 Compliant | 2 | 7 | None | Clean |
| 140 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 2 | 2 | R1 | L9: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L9: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+1 more) |
| 141 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 7 | 27 | R1 | L86: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 142 | `modules/workforce/src/flows/01.5-worker-directory/tests/flow.ux.spec.ts` | Unit | No | 🟢 Compliant | 3 | 6 | None | Clean |
| 143 | `modules/workforce/src/flows/01.6-worker-self-edit/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 3 | 20 | R7 | L1: [R7] Suite contains 3 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 144 | `modules/workforce/src/flows/01.6-worker-self-edit/tests/flow.integration.spec.ts` | Integration | No | 🟢 Compliant | 1 | 5 | None | Clean |
| 145 | `modules/workforce/src/flows/01.6-worker-self-edit/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 1 | 3 | R1 | L7: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). |
| 146 | `modules/workforce/src/flows/01.6-worker-self-edit/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 5 | 17 | R1 | L45: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 147 | `modules/workforce/src/flows/01.6-worker-self-edit/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 3 | 7 | R7 | L1: [R7] Suite contains 3 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 148 | `modules/workforce/src/flows/01.7-guest-join-and-linking/tests/flow.data.spec.ts` | Unit | No | 🟢 Compliant | 1 | 4 | None | Clean |
| 149 | `modules/workforce/src/flows/01.7-guest-join-and-linking/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 3 | 10 | R5, R1 | L115: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L92: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests). (+1 more) |
| 150 | `modules/workforce/src/flows/01.7-guest-join-and-linking/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 2 | 6 | R1 | L7: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()).; L29: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). |
| 151 | `modules/workforce/src/flows/01.7-guest-join-and-linking/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 5 | 10 | R5, R1 | L20: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L26: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 152 | `modules/workforce/src/flows/01.7-guest-join-and-linking/tests/flow.ux.spec.ts` | Unit | No | 🟢 Compliant | 4 | 9 | None | Clean |
| 153 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.challenger-m2-sanitization.stress.spec.ts` | Integration | Plan-86 | 🔴 Violating | 27 | 139 | R1 | L268: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests).; L268: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+6 more) |
| 154 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.challenger-m2.stress.spec.ts` | Integration | Plan-86 | 🔴 Violating | 17 | 80 | R1 | L116: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests).; L295: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). (+4 more) |
| 155 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.data.spec.ts` | Unit | No | 🟢 Compliant | 2 | 15 | None | Clean |
| 156 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.integration.spec.ts` | Integration | No | 🟢 Compliant | 1 | 9 | None | Clean |
| 157 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 1 | 3 | R1 | L7: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). |
| 158 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.repository.stress.spec.ts` | Integration | No | 🔴 Violating | 13 | 107 | R1 | L72: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests).; L609: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). (+3 more) |
| 159 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.service.spec.ts` | Unit | No | 🔴 Violating | 25 | 103 | R1 | L458: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L496: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+2 more) |
| 160 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.unit.spec.ts` | Unit | No | 🟢 Compliant | 2 | 10 | None | Clean |
| 161 | `modules/workforce/src/flows/01.8-worker-offboarding/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 22 | 92 | R1 | L72: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L143: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+3 more) |
| 162 | `modules/workforce/src/flows/01.9-worker-commitment-index/tests/flow.data.spec.ts` | Unit | No | 🔴 Violating | 4 | 15 | R7 | L1: [R7] Suite contains 4 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 163 | `modules/workforce/src/flows/01.9-worker-commitment-index/tests/flow.integration.spec.ts` | Integration | No | 🔴 Violating | 3 | 17 | R1, R7 | L57: [R1] Test contains only 2 assertion(s) (minimum required is >= 3 for integration tests).; L1: [R7] Suite contains 3 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 164 | `modules/workforce/src/flows/01.9-worker-commitment-index/tests/flow.rbac.spec.ts` | Unit | No | 🔴 Violating | 3 | 10 | R1 | L33: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 165 | `modules/workforce/src/flows/01.9-worker-commitment-index/tests/flow.unit.spec.ts` | Unit | No | 🔴 Violating | 9 | 49 | R2, R1, R7 | L129: [R2] Test bundles multiple independent behaviors into a single test case (4 actions, 14 assertions). Split into distinct test cases.; L253: [R2] Test bundles multiple independent behaviors into a single test case (4 actions, 9 assertions). Split into distinct test cases. (+2 more) |
| 166 | `modules/workforce/src/flows/01.9-worker-commitment-index/tests/flow.ux.spec.ts` | Unit | No | 🔴 Violating | 7 | 26 | R7 | L1: [R7] Suite contains 7 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 167 | `packages/ai-vision-engine/tests/engine.spec.ts` | Unit | No | 🟢 Compliant | 13 | 51 | None | Clean |
| 168 | `packages/core-components/tests/amount-picker.spec.ts` | Unit | No | 🔴 Violating | 10 | 17 | R5, R1 | L47: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L27: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+3 more) |
| 169 | `packages/core-components/tests/approval-workflow.spec.ts` | Unit | No | 🔴 Violating | 3 | 14 | R5 | L19: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times. |
| 170 | `packages/core-components/tests/attachment-pipeline.spec.ts` | Unit | No | 🔴 Violating | 2 | 8 | R5 | L8: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times. |
| 171 | `packages/core-components/tests/bot-catalog.spec.ts` | Unit | No | 🔴 Violating | 9 | 27 | R1 | L189: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 172 | `packages/core-components/tests/branded-types.spec.ts` | Unit | Plan-86 | 🔴 Violating | 23 | 151 | R3 | L60: [R3] Test name does not follow specification style (Behavior-Condition-Result): Test name too short (<15 chars): "rejects NaN" |
| 173 | `packages/core-components/tests/clearing-engine.spec.ts` | Unit | No | 🟢 Compliant | 5 | 19 | None | Clean |
| 174 | `packages/core-components/tests/completion-card.spec.ts` | Unit | No | 🟢 Compliant | 6 | 26 | None | Clean |
| 175 | `packages/core-components/tests/custody-gate.spec.ts` | Unit | No | 🟢 Compliant | 3 | 9 | None | Clean |
| 176 | `packages/core-components/tests/date-picker.spec.ts` | Unit | No | 🔴 Violating | 7 | 16 | R5, R1 | L34: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L40: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 177 | `packages/core-components/tests/governorate-picker.spec.ts` | Unit | No | 🔴 Violating | 7 | 36 | R7 | L1: [R7] Suite contains 7 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 178 | `packages/core-components/tests/in-place-flow.spec.ts` | Unit | No | 🔴 Violating | 19 | 71 | R1 | L41: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L60: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 179 | `packages/core-components/tests/installment-engine.spec.ts` | Unit | No | 🔴 Violating | 8 | 28 | R1 | L57: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()).; L100: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 180 | `packages/core-components/tests/location-picker.spec.ts` | Unit | No | 🔴 Violating | 11 | 40 | R7 | L1: [R7] Suite contains 11 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 181 | `packages/core-components/tests/notification-engine.spec.ts` | Unit | No | 🔴 Violating | 7 | 35 | R2 | L40: [R2] Test bundles multiple independent behaviors into a single test case (6 actions, 6 assertions). Split into distinct test cases. |
| 182 | `packages/core-components/tests/notification-helper.spec.ts` | Unit | No | 🔴 Violating | 4 | 10 | R1 | L45: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 183 | `packages/core-components/tests/outbox-queue.spec.ts` | Unit | No | 🔴 Violating | 3 | 16 | R2 | L39: [R2] Test bundles multiple independent behaviors into a single test case (4 actions, 6 assertions). Split into distinct test cases. |
| 184 | `packages/core-components/tests/purchase-picker.spec.ts` | Unit | No | 🟢 Compliant | 1 | 6 | None | Clean |
| 185 | `packages/core-components/tests/quantity-picker.spec.ts` | Unit | No | 🟢 Compliant | 5 | 10 | None | Clean |
| 186 | `packages/core-components/tests/shift-accrual.spec.ts` | Unit | No | 🔴 Violating | 3 | 10 | R1, R7 | L18: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L1: [R7] Suite contains 3 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 187 | `packages/core-components/tests/source-picker.spec.ts` | Unit | No | 🔴 Violating | 5 | 15 | R1 | L15: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L36: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 188 | `packages/core-components/tests/sovereign-auto-loader.spec.ts` | Unit | No | 🔴 Violating | 18 | 82 | R1, R4 | L43: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L48: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+3 more) |
| 189 | `packages/core-components/tests/telegram-formatters.spec.ts` | Unit | No | 🔴 Violating | 23 | 34 | R1 | L20: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L25: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+13 more) |
| 190 | `packages/core-components/tests/topic-router.spec.ts` | Unit | No | 🟢 Compliant | 2 | 8 | None | Clean |
| 191 | `packages/core-components/tests/wizard-session.spec.ts` | Unit | No | 🔴 Violating | 15 | 51 | R1 | L98: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L257: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 192 | `packages/core-components/tests/worker-commitment-engine.spec.ts` | Unit | No | 🟢 Compliant | 10 | 53 | None | Clean |
| 193 | `packages/core-components/tests/worker-picker.spec.ts` | Unit | No | 🔴 Violating | 10 | 39 | R1, R7 | L77: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L183: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 194 | `packages/database/tests/adversarial-m2-audit.spec.ts` | Unit | Plan-86 | 🔴 Violating | 20 | 68 | R1 | L179: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L384: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 195 | `packages/database/tests/custody-transaction.repository.spec.ts` | Unit | No | 🔴 Violating | 18 | 38 | R1 | L94: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L94: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). (+7 more) |
| 196 | `packages/database/tests/hash-chain.spec.ts` | Unit | No | 🔴 Violating | 5 | 8 | R1 | L35: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L56: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 197 | `packages/database/tests/hash-chain.stress.spec.ts` | Integration | Plan-86 | 🔴 UNVERIFIABLE | 25 | 99 | R1, R5, R2 | [UNVERIFIABLE] Uses synthetic client-side in-memory Promise mutex queue (advisoryLock = advisoryLock.then) and in-memory store rather than executing real concurrent Promise.all transactions against PostgreSQL pg_advisory_xact_lock on alsaada_test_db. |
| 198 | `packages/database/tests/hash-ledger.extension.spec.ts` | Unit | No | 🔴 Violating | 15 | 50 | R1 | L249: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()).; L275: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+6 more) |
| 199 | `packages/database/tests/hmac-keyring.spec.ts` | Unit | Plan-86 | 🔴 Violating | 5 | 8 | R1 | L97: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L112: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 200 | `packages/database/tests/migration-rbac-and-sessions.spec.ts` | Unit | No | 🔴 Violating | 3 | 16 | R5, R2, R7 | L56: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L37: [R2] Test bundles multiple independent behaviors into a single test case (6 actions, 8 assertions). Split into distinct test cases. (+2 more) |
| 201 | `packages/database/tests/migration-trace-and-magic-claim.spec.ts` | Unit | No | 🔴 Violating | 3 | 7 | R5, R1, R7 | L110: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L26: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+2 more) |
| 202 | `packages/database/tests/milestone-1-schema-contract.spec.ts` | Unit | No | 🔴 Violating | 8 | 55 | R5, R2 | L248: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L234: [R2] Test bundles multiple independent behaviors into a single test case (17 actions, 10 assertions). Split into distinct test cases. |
| 203 | `packages/database/tests/security.spec.ts` | Unit | No | 🔴 Violating | 12 | 30 | R1 | L79: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L108: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 204 | `packages/database/tests/soft-delete.spec.ts` | Unit | No | 🔴 Violating | 9 | 24 | R1 | L153: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 205 | `packages/database/tests/transactional-rls.spec.ts` | Unit | Plan-86 | 🔴 Violating | 5 | 10 | R1 | L77: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L106: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 206 | `packages/database/tests/verify-ledger-chain.spec.ts` | Unit | No | 🔴 Violating | 6 | 18 | R1 | L109: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 207 | `packages/national-id-engine/tests/national-id.spec.ts` | Unit | No | 🟢 Compliant | 14 | 58 | None | Clean |
| 208 | `packages/rbac/tests/cascading-rbac.spec.ts` | Unit | No | 🔴 Violating | 17 | 44 | R1 | L136: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). |
| 209 | `packages/rbac/tests/dashboard-auth.spec.ts` | Unit | No | 🔴 Violating | 15 | 62 | R1 | L81: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L96: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+8 more) |
| 210 | `packages/rbac/tests/rbac.spec.ts` | Unit | No | 🔴 Violating | 17 | 62 | R5, R1 | L185: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L19: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 211 | `packages/regional-engine/tests/names.spec.ts` | Unit | No | 🔴 Violating | 4 | 11 | R7 | L1: [R7] Suite contains 4 tests but lacks explicit edge case or failure mode coverage (tested happy paths exclusively). |
| 212 | `packages/regional-engine/tests/regional.spec.ts` | Unit | No | 🔴 Violating | 16 | 40 | R1 | L21: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L25: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+3 more) |
| 213 | `packages/telemetry/tests/adapters.spec.ts` | Unit | No | 🔴 Violating | 15 | 47 | R1 | L187: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L194: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+4 more) |
| 214 | `packages/telemetry/tests/challenger-m1-2.stress.spec.ts` | Integration | Plan-86 | 🔴 Violating | 48 | 134 | R1, R3 | L27: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests).; L32: [R1] Test contains only 1 assertion(s) (minimum required is >= 3 for integration tests). (+31 more) |
| 215 | `packages/telemetry/tests/context.spec.ts` | Unit | No | 🔴 Violating | 8 | 17 | R5, R1, R7 | L40: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L78: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+3 more) |
| 216 | `packages/telemetry/tests/empirical-challenger-m1-r2.spec.ts` | Unit | No | 🟢 Compliant | 7 | 46 | None | Clean |
| 217 | `packages/telemetry/tests/incidents.spec.ts` | Unit | No | 🔴 Violating | 4 | 16 | R1 | L41: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 218 | `packages/telemetry/tests/logger.spec.ts` | Unit | No | 🟢 Compliant | 5 | 26 | None | Clean |
| 219 | `packages/telemetry/tests/redaction.spec.ts` | Unit | No | 🔴 Violating | 26 | 98 | R1 | L75: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L101: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+4 more) |
| 220 | `tools/governance/tests/agent-dispatcher.spec.ts` | Unit | No | 🔴 Violating | 6 | 18 | R5, R4 | L14: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L14: [R5] Uses unseeded Math.random(), introducing non-deterministic execution paths into tests. (+6 more) |
| 221 | `tools/governance/tests/docker-governance-lock.spec.ts` | Unit | No | 🔴 Violating | 8 | 40 | R5, R1 | L33: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L33: [R5] Uses unseeded Math.random(), introducing non-deterministic execution paths into tests. (+1 more) |
| 222 | `tools/governance/tests/governance-verifiers.spec.ts` | Integration | No | 🔴 Violating | 44 | 177 | R5, R1 | L105: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L105: [R5] Uses unseeded Math.random(), introducing non-deterministic execution paths into tests. (+30 more) |
| 223 | `tools/governance/tests/legacy-parity-verifier.spec.ts` | Unit | No | 🔴 Violating | 9 | 15 | R5, R1 | L8: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L8: [R5] Uses unseeded Math.random(), introducing non-deterministic execution paths into tests. (+3 more) |
| 224 | `tools/governance/tests/pre-commit-test-guard.spec.ts` | Unit | No | 🔴 Violating | 7 | 28 | R1 | L8: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L47: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 225 | `tools/governance/tests/rag-engine.spec.ts` | Unit | No | 🔴 Violating | 33 | 137 | R5, R1 | L21: [R5] Uses raw unpinned Date.now() without vi.useFakeTimers() or vi.setSystemTime(), risking flaky tests under different execution times.; L21: [R5] Uses unseeded Math.random(), introducing non-deterministic execution paths into tests. (+3 more) |
| 226 | `tools/governance/tests/unified-lock-engine.spec.ts` | Unit | No | 🔴 Violating | 11 | 49 | R1 | L81: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L87: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 227 | `tools/governance/tests/verify-boundary-deserialization.spec.ts` | Unit | Plan-86 | 🔴 Violating | 6 | 11 | R1, R7 | L35: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L44: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+1 more) |
| 228 | `tools/governance/tests/verify-code-security.spec.ts` | Unit | No | 🔴 Violating | 7 | 17 | R1 | L54: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()). |
| 229 | `tools/governance/tests/verify-financial-integrity.spec.ts` | Unit | No | 🔴 Violating | 11 | 22 | R1 | L101: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 230 | `tools/governance/tests/verify-git-hygiene.spec.ts` | Unit | No | 🔴 Violating | 10 | 34 | R1 | L127: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 231 | `tools/governance/tests/verify-latency-anti-patterns.spec.ts` | Unit | No | 🔴 Violating | 8 | 17 | R1 | L43: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests).; L60: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 232 | `tools/governance/tests/verify-performance-budget.spec.ts` | Unit | No | 🟢 Compliant | 9 | 28 | None | Clean |
| 233 | `tools/governance/tests/verify-rbac-invariants.spec.ts` | Unit | Plan-86 | 🔴 Violating | 7 | 14 | R1 | L11: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). |
| 234 | `tools/governance/tests/verify-secret-leakage.spec.ts` | Unit | No | 🟢 Compliant | 4 | 11 | None | Clean |
| 235 | `tools/governance/tests/verify-test-authenticity.spec.ts` | Unit | No | 🔴 Violating | 7 | 17 | R1 | L5: [R1] Critical domain test for rejection/denial lacks mandatory negative assertions (e.g. not.toBe..., toBe(false), not.toHaveBeenCalled(), toThrow()).; L20: [R1] Test contains only 1 assertion(s) (minimum required is >= 2 for unit tests). (+5 more) |

---

## 6️⃣ سجل المعالجات الإلزامية المرتب حسب الأولوية (Prioritized Remediation Backlog)

تنفيذاً للمبدأ الدستوري الحاكم لانفصال الأدوار (R0 — Separation of Concerns)، يسجل هذا القسم خارطة طريق المعالجات الإلزامية المصنفة في 4 مستويات أولوية صارمة، الواجب إنجازها بواسطة فرق التطوير قبل أي اعتماد أو دمج مستقبلي:

### 🚨 المستوى الأول: أولوية حرجة قصوى (Tier 1: Critical — Blockers)
*معالجات ملزمة فوراً قبل أي عمل آخر لأنها تمس النزاهة التشفيرية وسلامة البناء:*
1. **تصحيح وإعادة بناء `packages/database/tests/hash-chain.stress.spec.ts` ضد PostgreSQL حقيقي:**
   - استئصال طابور الوعود التسلسلي الاصطناعي `advisoryLock = advisoryLock.then(...)` ومتغير `releaseActiveLock` (الأسطر 435–447 و 468–477).
   - استئصال المصفوفة المحلية `store: Record<string, any>[] = []` وربط الاختبار بـ `alsaada_test_db`.
   - تنفيذ 50 معاملة إدراج متوازية حقيقية عبر `Promise.all` ضد محرك PostgreSQL واستدعاء `SELECT pg_advisory_xact_lock(...)` داخل معاملات تفاعلية حقيقية `$transaction(async tx => ...)`.
   - إضافة اختبار تدافع سلبي يثبت أن استدعاء `hashLedger.create()` خارج `$transaction` يُرفض أو لا يحصل على حماية القفل الممتد، لمعالجة الخطر المعماري الكامن.
2. **تطهير ملف `apps/docs/tests/docs-portal.spec.ts` من عمليات البناء وخفض المهلة:**
   - حذف استدعاء مجمع ومحرك بناء Astro `await build({ root: ... })` من السطور 181-182 تطبيقاً للقاعدة 6.
   - نقل مهمة البناء لتكون خطوة سابقة مستقلة في الـ CI عبر `pnpm docs:build`.
   - قصر الاختبار على التحقق الخفيف من وجود المخرجات المنتهية في `apps/docs/dist/` (`index.html`, `pagefind/pagefind.js`).
   - خفض المهلة الزمنية من 360,000ms إلى سقف الدستور ≤ 5,000ms تطبيقاً للقاعدة 4.
3. **إصلاح عطل اختبار الصلاحيات في `packages/rbac/tests/rbac.spec.ts`:**
   - إصلاح التوكيد الفاشل في السطر 156 (`denies worker supervisor when accessing a different site`) ومطابقة نص رسالة الرفض الفعلية الصادرة من `evaluateAccess`.
4. **مزامنة بصمات قفل الحوكمة في `tools/governance/tests/docker-governance-lock.spec.ts`:**
   - إعادة توليد وتحديث بصمات SHA-256 للحزم المعدلة في `governance.lock.json` لاجتياز اختبار التحقق من التلاعب الجنائي بالسطر 190.

---

### ⚠️ المستوى الثاني: أولوية عالية (Tier 2: High — Assertion & Specification Upgrades)
*معالجات لمعالجة القصور الشائع في التوكيدات والتسمية وتطبيق القواعد 1 و 2 و 3:*
1. **ترقية كافة ملفات تدفقات الإعدادات الـ 12 (`flow.data.spec.ts`):**
   - رفع عدد التوكيدات من 1 إلى ≥ 2 توكيدات هادفة لكل اختبار (التحقق من صحة الكائن، تطابق الحقول المنطقية، ورسائل التحقق).
   - استبدال التسمية النمطية "should pass valid data check" بأسماء مواصفات دقيقة بنمط (السلوك - الشرط - النتيجة).
2. **ترقية كافة ملفات التكامل لتدفقات الإعدادات الـ 12 (`flow.integration.spec.ts`):**
   - رفع عدد التوكيدات من 1 إلى ≥ 3 توكيدات تكاملية حقيقية (فحص نص الرسالة المرتجعة، فحص بنية الأزرار، والتحقق من استدعاء خدمة الحفظ).
   - استبدال الاسم المكرر "should coordinate handler execution with service".
3. **ترقية كافة ملفات واجهة المستخدم لتدفقات الإعدادات الـ 12 (`flow.ux.spec.ts`):**
   - إضافة اختبارات سلبية وحالات حدية (القوائم الفارغة، تجاوز السعة، وإخفاء الأزرار لغير المخولين).
4. **تضمين التوكيدات السلبية الإلزامية في تدفقات القوى العاملة والصلاحيات:**
   - في `modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.rbac.spec.ts` و `01.5-worker-directory/tests/flow.rbac.spec.ts` و `packages/database/tests/custody-transaction.repository.spec.ts`:
     إلزام التحقق من أن محاولة التعديل غير المصرحة **لم تعدل أي سجل في قاعدة البيانات**، و**لم تخصم أي عهدة**، و**لم تطلق أي حدث في الـ Outbox**.
5. **معالجة التوكيدات المفردة في الـ 28 اختباراً التابعة لخطة 86:**
   - إضافة توكيد قيمي نوعي ومصفوفي لكل من الاختبارات الـ 28 المذكورة تفصيلاً في القسم 3 من هذا التقرير.

---

### ⏱️ المستوى الثالث: أولوية متوسطة (Tier 3: Medium — Determinism & Timeouts)
*معالجات لحظر التذبذب الزمني وتأكيد الحتمية وتطبيق القاعدتين 4 و 5:*
1. **تثبيت الوقت عبر المؤقتات الوهمية (`vi.setSystemTime`) عبر الـ 32 ملفاً:**
   - حظر القراءة المباشرة لـ `Date.now()` دون تغليفها بـ `vi.useFakeTimers()` و `vi.setSystemTime(new Date('2026-09-20T00:00:00Z'))`، لضمان استقرار نتائج التواريخ وحسابات الأقساط والمدد.
2. **استئصال العشوائية غير المهيأة والتأخير الزمني في `outbox-circuit-breaker.spec.ts`:**
   - إزالة `Math.random()` في السطر 12 واستخدام معرف ثابت محدد.
   - استبدال `setTimeout(1100)` في السطرين 46 و 55 بـ `vi.advanceTimersByTime(1100)`.
3. **خفض المهلات الزمنية المبالغ فيها:**
   - خفض مهلة `packages/core-components/tests/sovereign-auto-loader.spec.ts` من 90 ثانية إلى ≤ 5 ثوانٍ.
   - خفض مهلة `tools/governance/tests/agent-dispatcher.spec.ts` من 35 ثانية إلى ≤ 5 ثوانٍ.

---

### 🔧 المستوى الرابع: أولوية منخفضة / تحسينات معمارية (Tier 4: Low — Governance Enhancements)
*تحسينات في أدوات الحوكمة وبوابات الفحص:*
1. **ترقية Gate 23 (`tools/governance/verify-rbac-invariants.ts`) إلى شجرة AST حقيقية:**
   - تفعيل استيراد TypeScript المستورد بالسطر 2 (`import ts from 'typescript'`) وبناء زائر AST لفحص عقد استدعاءات `trace.push` بدلاً من الاعتماد على فحص النصوص السطحي `String.prototype.includes`.
2. **تشديد حدود الفحص المتساهلة في اختبارات بوابتي 23 و 24:**
   - في `verify-rbac-invariants.spec.ts:77`: تعديل `expect(res.checked).toBeGreaterThan(30)` إلى:
     `expect(res.checked).toBeGreaterThanOrEqual(530)`.
   - في `verify-boundary-deserialization.spec.ts:58`: تعديل `expect(res.checked).toBeGreaterThan(50)` إلى:
     `expect(res.checked).toBeGreaterThanOrEqual(841)`.
3. **تحديث بوابة 22 (`verify-test-authenticity.ts`) لسد ثغرة كشف القفل الاصطناعي:**
   - توسيع فاحص الـ AST ليرصد ويجرم أي استخدام لطوابير الوعود (`Promise queues`) أو محاكيات القفل الوظيفية داخل دوال الاختبار، وعدم الاقتصار على الكشف الشكلي لكلمات `class Mutex` أو `class Semaphore`.

---

## 7️⃣ إقرار النزاهة الجنائية والمسؤولية المهنية (Forensic Attestation & Sign-off)

نقر نحن `worker_report_1` بصفتنا الوكيل المسؤول عن تجميع وتحرير تقرير التدقيق النهائي:
1. أن هذا التقرير تم إعداده دون أي تحريف أو مجاملة أو تزييف للحقائق البرمجية، وفقاً للأدلة المادية القطعية المستخرجة من شجرة الرموز المجردة AST والتدقيق الميداني المعاكس.
2. أن قاعدة القراءة فقط (R0 Read-Only Directive) تم احترامها بنسبة 100%؛ حيث لم يتم لمس أو تعديل أو حذف أي ملف مصدري أو اختباري داخل مساحات عمل `apps/` و `modules/` و `packages/` و `tools/`.
3. أن التقرير تضمن فحصاً كاملاً وموثقاً لـ **235 ملف اختبار من أصل 235 ملفاً** دون إسقاط أي ملف أو صف من مصفوفة التدقيق.

**حرر في:** 20 سبتمبر 2026  
**المحرر:** `worker_report_1` (Teamwork Preview Worker — Lead Auditor Synthesis)  
**الحالة التنفيذية:** 🔴 **REJECTED / FAIL — تقرير تدقيق نهائي معتمد وموثق في المستودع.**
