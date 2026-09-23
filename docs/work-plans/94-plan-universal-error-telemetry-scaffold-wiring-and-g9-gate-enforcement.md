# خطة العمل 94 (النسخة التنفيذية المعتمدة): منظومة تسجيل وتتبع الأعطال المؤسسية والإلزام التلقائي والربط المعماري
## (Work Plan 94: Universal Error Telemetry, Scaffolding Wiring, Sink Injection & Strict G9 AST Gate)

> **المستوى والدرجة:** Tier 2 — The 6-Pillar Spec-First Executive Brief (`/saleh` + `/jev` + `open-code-review`)  
> **السلطة المرجعية:** ميثاق [`GEMINI.md`](../../GEMINI.md) القسم 5 (Gate G9)، القسم 8 (10-File Slice Architecture & 8.3)، والقسم 9 (Enterprise Reliability).  
> **رمز ميزة سجل الهجرة (SSOT):** `NEW-91` (في [`docs/19`](../19-legacy-to-enterprise-master-feature-migration-registry.md)).  
> **الفرع المنعزل المستهدف:** `plan/94-universal-error-telemetry-enforcement`.

---

## 🔍 معالجة الملاحظات الحاسمة والتحسينات الخمسة (Architecture Resolution Matrix)

| # | الملاحظة المثبتة | الحل المعماري المعتمد في الخطة |
|---|---|---|
| **1** | `pnpm make:flow` يستدعي `scaffold-flow.ts` القديم بدلاً من V2 | توحيد الأمر الرسمي في [`package.json`](../../package.json) ليوجه إلى `scaffold-flow-v2.ts`، مع معالجة المدخلات المطلوبة وصيانة التوافق. |
| **2** | `ErrorVaultService` داخل البوت بينما `telemetry` معزولة بصفر تبعيات | تطبيق نمط **حقن المصبات (Sink Injection / Adapter Pattern)**؛ حزمة `telemetry` تعرف واجهة `IncidentSink` و Singleton Registry، ويقوم `bot-server` بحقن `ErrorVaultIncidentSink` عند بدء التشغيل دون كسر حدود الحزم. |
| **3** | المتحكم المولّد يستدعي المعالج دون `await` ويتجاهل نتيجته | ترقية قالبي `controller.ts` و `error.handler.ts` معاً؛ المتحكم ينتظر المعالج (`await`)، والمعالج يسجل العطل ويعيد بطاقة عرض منسقة برمز البلاغ للمستخدم عبر مكتبة العرض المعتمدة. |
| **4** | ضمانات `writeEmergencyIncident` ومسار الطوارئ | توثيق دقيق لحدود الضمان: تسجيل متزامن فوري في `stderr` محصن ضد تجمد المقابس مع إرجاع صريح لحالة الحفظ (`persisted` \| `emergency` \| `failed`). |
| **5** | خطة ترحيل التدفقات الحالية (22 تدفقاً) | جرد كامل: تدفقا V2 (في `sandbox`) يتم ربطهما بعد فك القفل التشفيري بـ OTP، وتدفقات V1 الـ 20 تستمر في الحماية عبر `bot.catch` مع ضمان فحص خلوها من الابتلاع الصامت في G9. |
| **6** | تصادم المعرف `NEW-57` | تخصيص المعرف الشاغر التالي رسمياً: **`NEW-91`**. |
| **7** | استكمال النطاق ومخطط الإغلاق الرباعي | إدراج كافة ملفات النواة، والأدوات، والبوابات، والاختبارات، وسجل الهجرة صراحة، وتفصيل آليات القفل الرباعي هندسياً. |

---

## 🏛️ الركائز الست التنفيذية (The 6-Pillar Spec-First Brief)

### 1. Pillar 1: Functional Goal & Single Responsibility (المسؤولية الأحادية والهدف)
- **مبدأ النقطة الأحادية لتسجيل الحادث (Single Point of Responsibility):**
  - **طبقة حدود التدفق (`controller.ts` / `error.handler.ts`):** هي المسؤولة حصراً عن توثيق وقوع العطل في الـ Vault وإبلاغ المستخدم.
  - **الطبقات الداخلية (`service.ts`, `repository.ts`, `validator.ts`):** يُحظر عليها استدعاء مسجل الأعطال؛ تكتفي برمي الاستثناءات الصريحة أو إعادة رميها (`re-throw`).
  - **الحارس العام (`bot.catch`):** يعالج فقط الأعطال الشاردة التي لم يلتقطها معالج التدفق، مما يمنع منعاً باتاً مضاعفة العدّ وتكرار التنبيهات لنفس وقوع العطل (No Double-Recording).
- **إعادة استخدام الموجود (Reuse Existing Primitives):**
  - بناء دالة `captureFlowError` كغلاف موجه يستند إلى دالة `normalizeIncident` القائمة مسبقاً في `@alsaada/telemetry`.
  - اعتماد تصنيف أخطاء مبسط وبراغماتي:
    - `OperationalError`: أخطاء متوقعة في إدخال المستخدم (تُعالج محلياً ولا تُرسل لإنذارات المدراء).
    - `UnexpectedSystemError`: أعطال برمجية أو شبكية غير متوقعة (تُسجل فوراً وتولد `#ERR-XXXXXXXX`).
    - `FinancialInvariantError`: خروقات محاسبية كارثية (تصنيف `FATAL`).

### 2. Pillar 2: Blast Radius & Comprehensive File Scope (النطاق المحصور الشامل)

```
[النواة المشتركة - packages/telemetry] (يتطلب فك قفل OTP للكيان package:telemetry)
  ├── [NEW]    packages/telemetry/src/sink.ts               (واجهة IncidentSink وسجل الحقن)
  ├── [NEW]    packages/telemetry/src/errors.ts             (أصناف الاستثناءات الأساسية المبسطة)
  ├── [NEW]    packages/telemetry/src/flow-recorder.ts      (غلاف captureFlowError بالسياق المحدود)
  ├── [MODIFY] packages/telemetry/src/index.ts              (تصدير الواجهات والعقود)
  └── [NEW]    packages/telemetry/tests/flow-recorder.spec.ts (اختبارات الوحدة ومسارات الطوارئ)

[تطبيق خادم البوت - apps/bot-server] (يتطلب فك قفل OTP للكيان app:bot-server)
  ├── [NEW]    apps/bot-server/src/services/telemetry-sink.adapter.ts (محول ربط ErrorVaultService كـ Sink)
  ├── [MODIFY] apps/bot-server/src/index.ts                           (تهيئة وحقن الـ Sink عند الإقلاع)
  └── [NEW]    apps/bot-server/tests/telemetry-sink-integration.spec.ts (اختبار التكامل مع قاعدة البيانات)

[أدوات التوليد والسكربتات - tools/scaffold & package.json]
  ├── [MODIFY] package.json                                (تحديث make:flow لربطه بـ scaffold-flow-v2.ts)
  ├── [MODIFY] tools/scaffold/scaffold-flow-v2.ts          (ترقية قالبي error.handler و controller بالاكتمال والـ await)
  └── [MODIFY] tools/scaffold/tests/flow-v2-scaffold.spec.ts (التحقق من صحة القوالب المولدة)

[بوابات الجودة والحوكمة - tools/governance]
  ├── [MODIFY] tools/governance/verify-observability-contract.ts (ترقية Gate G9 لفحص AST حقيقي مع التمييز الدلالي)
  └── [NEW]    tools/governance/tests/verify-observability-ast.spec.ts (حالات اختبار موجبة وسالبة لفاحص G9)

[التدفقات الحالية - modules/] (يتطلب فك قفل OTP للكيانين flow:99.1 و flow:99.2)
  ├── [MODIFY] modules/sandbox/src/flows/99.1-sandbox-ping/error.handler.ts (ربط تدفق V2 التجريبي بالمنظومة)
  ├── [MODIFY] modules/sandbox/src/flows/99.1-sandbox-ping/controller.ts    (تفعيل await واستقبال رمز البلاغ)
  └── [MODIFY] modules/sandbox/src/flows/99.2-sandbox-calc/error.handler.ts (ربط تدفق V2 الحسابي بالمنظومة)

[التوثيق والدستور]
  ├── [MODIFY] docs/19-legacy-to-enterprise-master-feature-migration-registry.md (تسجيل NEW-91)
  ├── [MODIFY] GEMINI.md                                                        (البند 8.3 الإلزام الدستوري)
  ├── [MODIFY] .agents/rules/09-enterprise-reliability-and-telemetry.md         (تحديث القواعد التشغيلية)
  └── [NEW]    docs/work-plans/94-plan-universal-error-telemetry-scaffold-wiring-and-g9-gate-enforcement.md
```

### 3. Pillar 3: Mandatory Quality Gates (G1–G23)
- **Gate G1 (Type Safety):** سياق تشخيصي مقيد ومحصن بالكامل `BoundedFlowContext`؛ حظر `ctx?: unknown` أو تمرير كائن تليجرام الضخم.
- **Gate G2 (10-File Slice Architecture):** تكامل حقيقي بين الملف 8 (`error.handler.ts`) والملف 9 (`controller.ts`) وتأكيد استدعاء العرض في بطاقات الخطأ.
- **Gate G8 (Sensitive Data Masking):** استمرار فحص خلو الرسائل والـ Stack وسياق الطوارئ من الأرقام القومية المصرية، التوكنات، والمفاتيح.
- **Gate G9 (Deep AST Observability):** محرك فحص AST يستند إلى `typescript` Compiler API للتمييز بين:
  1. الابتلاع الصامت غير المصرح به (`Empty Catch / Silent Swallow`).
  2. إعادة الرمي الصحيحة (`Rethrow`).
  3. استدعاء معالج الأخطاء المعتمد مع الـ `await` الحقيقي.
- **Gate G10 & G23 (Authenticity & Anti-Cheating):** اختبارات إثبات حفظ الحادث واختبارات طفرات AST تثبت فشل الاختبار إذا عُطل التسجيل.

### 4. Pillar 4: Invariants, Security & Non-Blocking Guarantees
- **عقد السياق التشخيصي المحدود (Bounded Diagnostics Contract):**
  ```typescript
  export interface BoundedFlowContext {
    readonly flowId: string;
    readonly moduleId: string;
    readonly action: string;
    readonly traceId?: string | undefined;
    readonly actorTelegramId?: bigint | undefined;
    readonly actorRole?: string | undefined;
    readonly metadata?: Readonly<Record<string, string | number | boolean>> | undefined;
  }
  ```
- **ضمانات التنفيذ غير المعطل والمهلة (Testable Non-Blocking Guarantees):**
  - مهلة كتابة قصوى للـ Sink: **1500ms**.
  - في حال انتهاء المهلة أو تعطل المصب، يتم فوراً اللجوء إلى `writeEmergencyIncident` وإرجاع الحالة:
    ```typescript
    export type IncidentPersistStatus = 'persisted' | 'emergency' | 'failed';
    export interface CaptureFlowErrorResult {
      readonly handled: boolean;
      readonly errorReference: string;
      readonly traceId: string;
      readonly status: IncidentPersistStatus;
      readonly userMessageArabic: string;
    }
    ```
  - **فصل إشعارات المدراء:** إرسال إشعارات تليجرام للمدراء يتم عبر مسار غير متزامن تماماً (Fire-and-Forget / Background Dispatch) لضمان عدم تأخير رد البوت على المستخدم المتأثر نهائياً.
