# خطة عمل رقم 101: تقنين وتوحيد المنهجية البرمجية الملزمة (FCIS) وحارس شجرة الكود الشامل (AST Paradigm Gate) مع التحصين المطلق لعزل الوظائف والموديولات
## Work Plan 101: Sovereign Full-Monorepo FCIS Coding Paradigm (`Functional Core, Injectable Service Shell`), 100% Vertical Slice Isolation & Universal AST Enforcement

> **الحالة:** 🟢 قيد التنفيذ الفعلي داخل الفرع المعزول `plan/101-fcis-paradigm-standardization`  
> **المرجع الدستوري:** [`GEMINI.md`](../../GEMINI.md) (البنود 1, 5, 6, 8, 8.5)، [`docs/21`](../21-mandatory-module-architecture-and-gates.md)، [`docs/27`](../27-enterprise-ai-governance-and-quality-gates-constitution.md)، وكتيبات القواعد (`Rulebooks 01–12`)  
> **السلطة الرقابية:** `/saleh` × `/jev` (Pure Cloud Sentinel `https://api.typesafe.ai/v1/systemone` — `Plan Readiness: 98%`)  
> **نطاق الإلزام:** إلزام قطعي وشامل بنسبة **100%** على كافة وكلاء وأدوات الذكاء الاصطناعي (`Gemini`, `Claude`, `Cursor`, `Copilot`, `Subagents`) وعلى جميع المناطق الخمس للمستودع (`packages/*`, `modules/*`, `apps/bot-server`, `apps/admin-dashboard`, `tools/*`).

---

## 🏛️ 1️⃣ الأركان الستة للمواصفة التنفيذية (The 6-Pillar Executive Specification)

### Pillar 1: Scope & Functional Baseline Parity (`F:\HR` Zero-Divergence Baseline)
- **النطاق الشامل (Full-Monorepo Scope):** تسري منهجية **`FCIS` (`Functional Core, Injectable Service Shell`)** إلزامياً وبنسبة **100%** على كافة مناطق المستودع الخمس:
  1. `packages/*` (النواة المشتركة والمحركات الثمانية).
  2. `modules/*` (موديولات الأعمال وجميع التدفقات `flows/*` والخدمات المشتركة).
  3. `apps/bot-server` & `apps/worker-outbox` (خادم البوت ومعالجات الخلفية).
  4. `apps/admin-dashboard` (لوحة التحكم الإدارية Next.js وواجهات الـ API).
  5. `tools/*` & `scripts/*` (أدوات الحوكمة والنسخ الاحتياطي والمولدات).
- **تطابق خط الأساس (`F:\HR` Parity Invariant):** التوحيد البرمجي في التدفقات الـ 6 بـ `modules/workforce` يحافظ بنسبة `100.0%` على منطق الأعمال والخطوات والحسابات وشاشات التيليجرام دون أي انحراف (`Zero Flow Divergence` — Gate G3 & G11).

### Pillar 2: Blast Radius & Data Contracts (`10-File Vertical Slice Isolation`)
- **العزل الهيكلي التام (`Strict 10-File Vertical Slice & Module Isolation`):**
  - كل وظيفة (`Flow`) داخل `modules/<module>/src/flows/<id>-<slug>/` تمتلك ملفاتها الـ 10 المستقلة بالكامل (`flow.contract.json`, `flow.handler.ts` / `controller.ts`, `flow.keyboard.ts` / `menu.builder.ts`, `flow.service.ts` / `service.ts`, `flow.repository.ts` / `repository.ts`, `flow.types.ts` / `types.ts`, `flow.validators.ts` / `validator.ts`, `flow.messages.ts`, `flow.telemetry.ts`, `flow.docs.md`).
  - **حظر الاستيراد العابر بين التدفقات (`Zero Cross-Flow Imports`):** يُمنع قطعياً استيراد أي ملف من تدفق `Flow A` داخل تدفق `Flow B` (`CROSS_FLOW_ISOLATION_BREACH`).
  - **حظر الاستيراد العابر بين الموديولات (`Zero Cross-Module Imports`):** يُمنع قطعياً استيراد أي ملف من `modules/A` داخل `modules/B`.
- **عقود البيانات (`Data Contracts`):** كافة المدخلات والمخرجات في `flow.types.ts` هي `interface` / `type` غير قابلة للتعديل (`Readonly DTOs`) ومحمية بمخططات `Zod` في `flow.validators.ts`.

### Pillar 3: Telegram Mobile UX & Ergonomics Budget (`36/16/7/3` & Rich Message)
- كافة دوال بناء الرسائل النقية (`export function format*` في `flow.messages.ts` / `menu.builder.ts`) تلتزم بعقد `@alsaada/core-components/rich-message` (`buildRichPage`, `buildRichTable`, `assertRichMessage`) وإخفاء الرواتب والمستحقات عبر `formatSpoiler` (`<tg-spoiler>` — Gate G8).
- كافة دوال بناء الأزرار النقية (`export function build*Keyboard` في `flow.keyboard.ts` / `menu.builder.ts`) تلتزم بميزانية شاشات الجوال (`<= 36 bytes callback_data`, `<= 16 chars button label`, `<= 7 rows`, `<= 3 buttons/row` — Gate G5 & G22).

### Pillar 4: Concurrency, Invariants & Security (`RBAC`, `Idempotency` & `Stateless DI`)
- **انعدام الحالة في الخدمات (`Stateless Service Classes — Concurrency Safety Gate G21`):**
  - يُحظر تخزين أي متغير حالة خاص بجلسة المستخدم داخل خصائص كلاس `Service` أو `Repository`؛ جميع خصائص الكلاس يجب أن تكون `private readonly` محقونة عبر الـ `constructor` لمنع تداخل جلسات المستخدمين (`Race Conditions`).
- **التقاط الأعطال القياسي (`Gate G9 Observability`):**
  - تلتزم دوال التوجيه في `flow.handler.ts` / `controller.ts` و `error.handler.ts` باستدعاء `await captureFlowError(error, boundedContext)` مع التمرير المقيد لـ `BoundedFlowContext`.
- **حماية الأقفال التشفيرية (`Rulebook 04`):** يتم فتح وإعادة قفل الكيانات المستهدفة عبر بروتوكول `OTP` الديناميكي (`pnpm unlock:request` ➔ `pnpm unlock:confirm` ➔ `pnpm lock:all`).

### Pillar 5: Test Matrix & Verification Commands (`Vitest` & AST Regression Suite)
- تثبيت الساعة الزمنية في جميع اختبارات الحارس والوحدات على `PINNED_BASE_TIME = '2026-04-19T00:00:00.000Z'` ومراعاة حدود دورة الرواتب (`26th–25th`).
- اختبارات التحقق الحقيقية (`Real Domain Assertions — Gate G10`) في `tools/governance/tests/verify-fcis-paradigm.spec.ts` وجميع اختبارات `modules/workforce`.

### Pillar 6: Acceptance Criteria & Quality Gates (`G1–G23` & Attestation)
- اجتياز جميع البوابات الـ 23 (`G1–G23`) عبر `pnpm arch:verify`, `pnpm typecheck`, `pnpm test`, `pnpm ci:simulate`, و `pnpm audit:saleh:boost` بمؤشر حوكمة مركب `CGI >= 95%`، وإصدار البطاقات الخمس الإلزامية قبل طلب الدمج `«ادمج الفرع»`.

---

## 🏛️ 2️⃣ المصفوفة الدستورية الشاملة للمناطق الخمس (The 5-Zone FCIS + Isolation Matrix)

| المنطقة المعمارية | قاعدة العزل الهيكلي (`Isolation Rule`) | قاعدة النمط البرمجي (`FCIS AST Rule`) | المحظورات القاطعة (`[REJECT] Exit 1`) |
| :--- | :--- | :--- | :--- |
| **1. `modules/*/src/flows/<id>-<slug>/`** | **شريحة رأسية معزولة 100% (10 ملفات + اختباراتها)**. ممنوع الاستيراد من أي تدفق آخر (`../<other-flow>`). | `export function` في (`validators`, `keyboard`/`menu.builder`, `messages`, `handler`/`controller`, `telemetry`). و `export class` المحقون في (`service`, `repository`) فقط. | الكلاسات الاستاتيكية (`static`)، كائنات التجميع الوحيدة بدون دوال مصدرة، الوراثة (`extends`)، أو مشاركة ملفات بين تدفقين. |
| **2. `modules/*/src/` (خارج `flows/`)** | **عزل تام للموديول (`module.contract.json`)**. ممنوع الاستيراد من أي موديول آخر (`modules/<other>`). | `export function` في (`module.register`, `module.routes`, `module.permissions`, `shared/*`). و `export class` في (`services/*.service.ts`). | وضع منطق تدفق فرعي داخل ملفات الموديول العامة بدلاً من مجلد `flows/` المستقل. |
| **3. `packages/*` (النواة المشتركة)** | **8 حزم مستقلة (`package.json`)** لا تستورد أبداً من `modules/*` أو `apps/*` (اتجاه الاعتماد أحادي). | `export function` لجميع الحسابات والتشفير والمحركات. و `export class` فقط لعملاء الاتصال ومخازن الحالة (`*.engine.ts`, `*.service.ts`, `*.store.ts`). | الكلاسات الاستاتيكية الصورية أو الوراثة أو وجود أي كود خاص بتدفق معين داخل النواة. |
| **4. `apps/admin-dashboard`** | **عزل كامل لكل شاشة (`app/admin/<module>/<feature>/`)** بملفاتها المستقلة وقفلها المستقل في `governance.lock.json`. | `100%` مكونات React وظيفية (`export function` / `export default function`) ودوال HTTP نقية (`export async function GET/POST`) في `route.ts`. | `Class Components`، أو الكلاسات الاستاتيكية، أو وضع منطق أعمال قاعدة البيانات داخل ملفات الواجهة. |
| **5. `apps/bot-server` & `tools/*`** | `bot-server` للتشغيل والربط فقط (ممنوع وضع منطق أعمال تدفقات بداخله). وكل أداة حوكمة في `tools/` مستقلة بملفها. | `export function` للميدلوير والتوجيه وحراس الفحص (`verify-*.ts`) والمولدات (`scaffold-*.ts`). و `export class` فقط لـ `services/*.service.ts`. | وضع معالجات تدفقات داخل `apps/bot-server` (خرق `docs/21` البند 1). |
