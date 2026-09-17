# 21 - معيار الموديولات الإلزامي وبوابات الاعتماد الصارمة

> هذه الوثيقة هي المرجع الحاكم لإعادة هيكلة منظومة Al-Saada Smart Bot. أي تعارض بينها وبين أي وثيقة أقدم يُحسم لصالح هذه الوثيقة حتى يتم تحديث الوثيقة الأقدم.

## 1. القرار المعماري المعتمد

المبدأ المعتمد هو: **نظام الموديولات والفصل التام لكل وظيفة بكل ملفاتها وطبقاتها**.

لا تُقبل أي وظيفة جديدة أو مُرحّلة إذا وُضعت كمنطق أعمال داخل `apps/bot-server/src/handlers` أو داخل ملف مركزي كبير. تطبيق `apps/bot-server` دوره تشغيل البوت، تحميل الموديولات، ربط middleware، وتوجيه الأحداث العامة فقط. أما منطق الأعمال فيجب أن يعيش داخل `modules/*`.

## 2. البنية الإلزامية للموديول

كل موديول أعمال يجب أن يلتزم بالبنية التالية:

```text
modules/<module-name>/
  README.md
  module.contract.json
  index.ts
  src/
    module.register.ts
    module.routes.ts
    module.permissions.ts
    module.telemetry.ts
    shared/
      module.types.ts
      module.errors.ts
      module.messages.ts
      module.validators.ts
    flows/
      <flow-code>-<flow-slug>/
        flow.contract.json
        flow.handler.ts
        flow.keyboard.ts
        flow.service.ts
        flow.repository.ts
        flow.types.ts
        flow.validators.ts
        flow.messages.ts
        flow.telemetry.ts
        flow.docs.md
        tests/
          flow.unit.spec.ts
          flow.integration.spec.ts
          flow.ux.spec.ts
          flow.rbac.spec.ts
          flow.data.spec.ts
```

## 3. مسؤولية كل طبقة داخل الوظيفة

| الملف | المسؤولية | محظورات |
|---|---|---|
| `flow.contract.json` | تعريف كود التدفق، الدور المصرح، المسار، الأزرار، المدخلات، المخرجات، أثر البيانات، SLA | ممنوع ترك أي حقل فارغ أو عام |
| `flow.handler.ts` | استقبال أحداث Telegram واستدعاء الخدمة والكيبورد | ممنوع وضع حسابات مالية أو كتابة مباشرة في قاعدة البيانات |
| `flow.keyboard.ts` | بناء الأزرار فقط عبر مكونات النواة المشتركة | ممنوع بناء بدائل يدوية لمكون موجود في `packages/*` |
| `flow.service.ts` | منطق الأعمال والتحقق وتسلسل العملية | ممنوع التعامل المباشر مع Telegram UI |
| `flow.repository.ts` | القراءة والكتابة من قاعدة البيانات أو outbox | ممنوع وضع منطق أعمال داخل repository |
| `flow.types.ts` | أنواع TypeScript الخاصة بالتدفق | ممنوع استخدام `any` دون استثناء موثق |
| `flow.validators.ts` | تحقق المدخلات وحدود القيم | ممنوع تكرار validator موجود في النواة المشتركة |
| `flow.messages.ts` | نصوص البوت والتقارير الخاصة بالتدفق | ممنوع نصوص تقنية تظهر للمستخدم |
| `flow.telemetry.ts` | قياس زمن كل زر وكل خطوة وكل عملية | ممنوع اعتماد قياس يدوي بديل عن سجلات الأداء |
| `flow.docs.md` | توثيق التشغيل، المسار، الأثر، وسيناريوهات الاختبار | ممنوع إعلان اكتمال الوظيفة دون هذا الملف |

## 4. العقد الإلزامي لكل وظيفة

كل `flow.contract.json` يجب أن يحتوي على الحقول التالية على الأقل:

```json
{
  "flowCode": "01.2.A",
  "flowName": "Record Cash Advance",
  "module": "advances",
  "status": "Pending | InProgress | Implemented | UAT_PASS | Archived",
  "allowedRoles": ["SUPER_ADMIN", "GENERAL_ADMIN", "FIELD_ADMIN"],
  "blockedRoles": ["WORKER", "SUPPLIER", "GUEST"],
  "entryPoints": ["callback:data", "command:/example"],
  "navigationPath": ["Main Menu", "Module", "Flow"],
  "buttons": [],
  "inputs": [],
  "outputs": [],
  "dataImpact": {
    "database": [],
    "googleSheets": [],
    "exports": [],
    "notifications": []
  },
  "linkedFlows": [],
  "performanceSlaMs": {
    "buttonP95": 700,
    "stepP95": 1200,
    "commitP95": 2000
  },
  "requiredTests": ["unit", "integration", "ux", "rbac", "data", "performance"],
  "manualUatRequired": true
}
```

## 5. البوابات الإلزامية قبل مرور أي وظيفة

لا تمر أي وظيفة من `Pending` إلى `Implemented` أو من `Implemented` إلى `UAT_PASS` إلا إذا اجتازت البوابات التالية بنسبة 100%:

| البوابة | المطلوب | قرار الفشل |
|---|---|---|
| G1 - بوابة العزل الموديولي | كل ملفات الوظيفة داخل موديولها ومسارها المعتمد | `ARCHITECTURE_FAIL` |
| G2 - بوابة العقد | وجود `flow.contract.json` مكتمل ومطابق لسجل الترحيل | `CONTRACT_FAIL` |
| G3 - بوابة النواة المشتركة | استخدام `packages/*` لأي منطق مشترك موجود | `DUPLICATION_FAIL` |
| G4 - بوابة الصلاحيات | إخفاء الأزرار قبل العرض لغير المصرح لهم | `RBAC_FAIL` |
| G5 - بوابة تجربة البوت | رسالة واحدة موضعية، زر رجوع، منع أزرار قديمة، لوحة إتمام موحدة | `UX_FAIL` |
| G6 - بوابة البيانات | أثر قاعدة البيانات والشيت/outbox موثق ومختبر | `DATA_FAIL` |
| G7 - بوابة الأداء | قياس زمن كل زر وكل خطوة من سجلات الأداء الرسمية | `PERFORMANCE_FAIL` |
| G8 - بوابة الاختبارات | unit + integration + ux + rbac + data حسب العقد | `TEST_FAIL` |
| G9 - بوابة التوثيق | تحديث docs وسجل الترحيل وتقرير الوظيفة | `DOCS_FAIL` |
| G10 - بوابة Git والحالة النهائية | لا توجد تعديلات معلقة أو ملفات غير متتبعة، وCommit موثق | `GIT_FAIL` |

## 6. أوامر التحقق الإلزامية

يجب توفير وتشغيل الأوامر التالية كحواجز آلية. إذا لم يكن أمر منها موجوداً بعد، يكون القرار `BLOCKED` وليس `PASS`:

```bash
pnpm build
pnpm test
pnpm lint
pnpm arch:verify
pnpm migration:verify
pnpm flow-contracts:verify
pnpm docs:audit
pnpm docs:parity
pnpm ai-compliance:verify
git status --short
```

## 7. متطلبات حارس `arch:verify`

يجب أن يفشل `arch:verify` عند تحقق أي شرط من الآتي:

1. وجود منطق أعمال لتدفق داخل `apps/bot-server/src/handlers` بدلاً من `modules/*`.
2. وجود تدفق في سجل الترحيل حالته `Implemented` أو `UAT_PASS` دون مجلد فعلي داخل `modules/*`.
3. غياب أي ملف إلزامي من ملفات الوظيفة.
4. وجود `placeholder` داخل تدفق معلن أنه مكتمل.
5. تجاوز `flow.handler.ts` حد 350 سطراً أو `flow.service.ts` حد 500 سطر دون استثناء موثق.
6. استخدام `any` داخل كود التدفق دون استثناء موثق في `flow.contract.json`.
7. عدم وراثة إعدادات TypeScript الصارمة من الجذر.
8. إنشاء ملفات مؤقتة أو مخرجات عشوائية في جذر المشروع.

## 8. متطلبات حارس `migration:verify`

يجب أن يفشل `migration:verify` عند تحقق أي شرط من الآتي:

1. تدفق حالته `Pending` ظاهر للمستخدم في القوائم الحية.
2. تدفق حالته `Implemented` لا يملك اختبارات وتوثيقاً وعقداً.
3. تدفق حالته `UAT_PASS` لا يملك تقرير UAT يدوي مستقل.
4. مسار التدفق في سجل الترحيل لا يطابق مساره الفعلي.
5. وجود تدفق جديد غير مسجل في سجل الترحيل أو سجل الوظائف المستحدثة.

## 9. متطلبات حارس `flow-contracts:verify`

يجب أن يفشل الحارس إذا كان أي عقد وظيفة ينقصه:

1. كود تدفق فريد.
2. أدوار مصرح بها وأدوار محجوبة.
3. مسار وصول وأزرار رئيسية.
4. أثر بيانات صريح: Database / Google Sheets / Export / Notification / None مع سبب.
5. روابط الوظائف المرتبطة.
6. حدود SLA.
7. قائمة الاختبارات المطلوبة.
8. حالة UAT.

## 10. متطلبات حارس `ai-compliance:verify`

كل أداة ذكاء اصطناعي يجب أن تنشئ أو تحدّث تقرير إثبات في:

```text
docs/ai-execution-evidence/<task-id>.md
```

ويجب أن يحتوي التقرير على:

1. وصف المهمة ونطاقها.
2. الملفات التي تمت قراءتها.
3. الملفات التي تم تعديلها.
4. سبب كل تعديل.
5. نتائج أوامر التحقق بالأرقام.
6. جدول البوابات G1 إلى G10 ونتيجة كل بوابة.
7. المشاكل المتبقية والتحفظات.
8. مقترحات تحسين فنية ووظيفية وتجربة مستخدم وبيانات.
9. في حالة إصلاح خطأ: سبب الخطأ، طريقة المعالجة المستخدمة، وإجراء وقائي قابل للتحقق يمنع تكراره.
10. القرار النهائي: `PASS`, `RETEST_REQUIRED`, `BLOCKED`, أو `FAIL`.

## 11. قاعدة منع إعلان النجاح

يُحظر على أي أداة كتابة أو تسليم أي عبارة تفيد الاكتمال مثل `تم`, `جاهز`, `PASS`, `مكتمل`, `100%` إلا إذا أرفقت:

1. نتائج أوامر التحقق الإلزامية.
2. تقرير إثبات `ai-execution-evidence`.
3. نظافة `git status --short`.
4. رابط تقرير الوظيفة أو الموديول.
5. حالة سجل الترحيل بعد التحديث.

أي نجاح بلا دليل يعامل كـ `INVALID_REPORT` ويعاد للفحص.

## 12. بوابات حماية الحوكمة نفسها والنزاهة المالية وميزانية الأداء

| البوابة | المطلوب | قرار الفشل |
|---|---|---|
| G11 - بوابة قفل الحوكمة | وجود `governance.lock.json` مُحدّث ببصمات SHA-256 لكل ملفات وقواعد وسكربتات الحوكمة المحمية عبر `pnpm governance:lock` | `GOVERNANCE_LOCK_FAIL` |
| G12 - بوابة منع العبث بالحوكمة | تشغيل `pnpm governance:tamper-check` ورفض أي تعديل أو حذف أو تعطيل أو تخفيف لملفات البوابات دون موافقة صريحة موثقة | `GOVERNANCE_TAMPER_FAIL` |
| G13 - بوابة النزاهة المالية | تشغيل `pnpm financial:verify` والتحقق من السلاسل التشفيرية، اتزان العهد، وترابط السلف والقيود العكسية | `FINANCIAL_INTEGRITY_FAIL` |
| G14 - بوابة ميزانية الأداء | تشغيل `pnpm perf-budget:verify` والتحقق من سرعة الكاش، تدفقات البوت، التليميتري، واستقرار الذاكرة | `PERF_BUDGET_FAIL` |

## 13. قاعدة الموافقة الحرفية لتعديل البوابات

يُحظر على أي أداة ذكاء اصطناعي أو مطور تعديل أو حذف أو تعطيل أو تخفيف أي بوابة حوكمة أو سكربت تحقق أو قاعدة من قواعد المشروع، بما في ذلك ملفات `AGENTS.md` و`GEMINI.md` و`package.json` و`docs/14-ai-agent-governance-and-file-rules.md` و`docs/15-universal-module-and-flow-standard.md` و`docs/21-mandatory-module-architecture-and-gates.md` و`tools/governance` وملفات CI، إلا إذا وردت موافقة كتابية صريحة من المستخدم تحتوي نفس اللفظ التالي دون تغيير:

```text
موافق على التعديل او الايقاف او الحذف
```

في غياب هذه العبارة الحرفية، يجب اعتبار الطلب `BLOCKED` وعدم إجراء أي تعديل على ملفات الحوكمة أو تعطيل أي بوابة، حتى لو بدا التعديل منطقياً أو ضرورياً.

## 14. أوامر حماية البوابات الإضافية

```bash
pnpm governance:lock
pnpm governance:tamper-check
```

يجب تشغيل `pnpm governance:tamper-check` ضمن `pnpm governance:verify` قبل `pnpm ai-compliance:verify`. ولا يجوز اعتماد تقرير أي أداة ذكاء اصطناعي ما لم يذكر نتيجة G11 وG12 ونتيجة أمر فحص العبث.
