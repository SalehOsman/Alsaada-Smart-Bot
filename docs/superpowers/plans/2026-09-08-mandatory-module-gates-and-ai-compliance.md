# Mandatory Module Gates And AI Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** تثبيت معيار الموديولات والفصل التام لكل وظيفة، وربطه ببوابات تحقق صارمة تمنع أدوات الذكاء الاصطناعي من تجاوز معايير إعادة الهيكلة.

**Architecture:** يعتمد المشروع على موديولات أعمال معزولة داخل `modules/*`. تطبيق `apps/bot-server` يبقى طبقة تشغيل وتوجيه فقط، بينما كل وظيفة تملك ملفاتها وطبقاتها وعقدها واختباراتها وتوثيقها داخل موديولها.

**Tech Stack:** TypeScript 5.9+, pnpm workspace, Vitest, grammY, Prisma, Google Sheets outbox/sync, Markdown governance docs.

**Spec:** `docs/21-mandatory-module-architecture-and-gates.md`

## Global Constraints

- المبدأ المعتمد: نظام الموديولات والفصل التام لكل وظيفة بكل ملفاتها وطبقاتها.
- لا تمر أي وظيفة إلا باجتياز بوابات G1 إلى G10 بنسبة 100%.
- ممنوع إعلان PASS دون أوامر تحقق ودليل مكتوب.
- ممنوع وضع منطق أعمال جديد داخل `apps/bot-server/src/handlers`.
- كل وظيفة يجب أن تملك `flow.contract.json` وملفات handler/keyboard/service/repository/types/validators/messages/telemetry/docs/tests.

---

### Task 1: تثبيت وثيقة المعيار الحاكم

**Files:**
- Create: `docs/21-mandatory-module-architecture-and-gates.md`
- Modify: `AGENTS.md`
- Modify: `GEMINI.md`

**Interfaces:**
- Consumes: القواعد الحالية في `AGENTS.md`, `GEMINI.md`, `docs/14-ai-agent-governance-and-file-rules.md`, `docs/15-universal-module-and-flow-standard.md`.
- Produces: مرجع حاكم واحد للهيكلة والبوابات.

- [ ] إنشاء وثيقة `docs/21-mandatory-module-architecture-and-gates.md`.
- [ ] إضافة رابط إلزامي في `AGENTS.md`.
- [ ] إضافة رابط إلزامي في `GEMINI.md`.
- [ ] التحقق من عدم وجود تعارض بين مسار `modules/*` وأي مسار قديم.

### Task 2: تنفيذ حارس الهيكلة `arch:verify`

**Files:**
- Create: `tools/governance/verify-architecture.ts`
- Modify: `package.json`

**Interfaces:**
- Produces command: `pnpm arch:verify`.

- [ ] يفحص وجود بنية الموديولات الإلزامية.
- [ ] يفشل عند وجود منطق أعمال جديد خارج `modules/*`.
- [ ] يفشل عند وجود placeholder داخل وظيفة مكتملة.
- [ ] يفشل عند تجاوز حدود أحجام ملفات التدفقات.
- [ ] ربط الأمر في `package.json`.

### Task 3: تنفيذ حارس الترحيل `migration:verify`

**Files:**
- Create: `tools/governance/verify-migration-registry.ts`
- Modify: `package.json`

**Interfaces:**
- Produces command: `pnpm migration:verify`.

- [ ] يقرأ سجل الترحيل.
- [ ] يطابق حالة كل وظيفة مع مسارها الفعلي.
- [ ] يمنع ظهور وظائف Pending في القوائم الحية.
- [ ] يمنع UAT_PASS دون تقرير UAT.

### Task 4: تنفيذ حارس عقود الوظائف `flow-contracts:verify`

**Files:**
- Create: `tools/governance/verify-flow-contracts.ts`
- Modify: `package.json`

**Interfaces:**
- Produces command: `pnpm flow-contracts:verify`.

- [ ] يفحص كل `flow.contract.json`.
- [ ] يتحقق من الصلاحيات والمسار والأزرار والأثر والـ SLA والاختبارات.
- [ ] يفشل عند أي حقل ناقص أو عام.

### Task 5: تنفيذ حارس امتثال أدوات الذكاء الاصطناعي

**Files:**
- Create: `tools/governance/verify-ai-compliance.ts`
- Create: `docs/ai-execution-evidence/README.md`
- Modify: `package.json`

**Interfaces:**
- Produces command: `pnpm ai-compliance:verify`.

- [ ] يفرض وجود تقرير إثبات لكل مهمة.
- [ ] يفحص جدول البوابات G1 إلى G10.
- [ ] يمنع إعلان PASS دون نتائج أوامر تحقق ونظافة Git.

### Task 6: ربط البوابات بسير العمل

**Files:**
- Create: `.github/workflows/governance-gates.yml` أو بديل CI معتمد.
- Create/Modify: Git hooks إذا كانت السياسة المحلية تعتمد hooks.

**Interfaces:**
- Consumes commands: `build`, `test`, `lint`, `arch:verify`, `migration:verify`, `flow-contracts:verify`, `docs:audit`, `docs:parity`, `ai-compliance:verify`.

- [ ] تشغيل كل الحواجز في CI.
- [ ] منع الدمج عند فشل أي حاجز.
- [ ] توثيق مخرجات الفشل بوضوح.

### Task 7: تنظيف الهيكلة الحالية تدريجياً

**Files:**
- Modify: الملفات الضخمة داخل `apps/bot-server/src/handlers` عند ترحيل كل وظيفة.
- Create: مجلدات الوظائف داخل `modules/*` تدريجياً.

**Interfaces:**
- Consumes: سجل الترحيل.
- Produces: وظائف معزولة قابلة للاختبار.

- [ ] اختيار وظيفة واحدة فقط في كل دورة.
- [ ] إنشاء موديولها وملفاتها كاملة.
- [ ] نقل السلوك الوظيفي لا الكود القديم.
- [ ] تشغيل الحواجز كاملة قبل تغيير حالة الوظيفة.

### Task 8: مراجعة نهائية قبل اعتماد أي وظيفة

**Files:**
- Modify: `docs/19-legacy-to-enterprise-master-feature-migration-registry.md`
- Create/Modify: تقرير الوظيفة داخل الموديول.
- Create/Modify: تقرير UAT عند الاختبار اليدوي.

**Interfaces:**
- Produces final decision: `PASS`, `RETEST_REQUIRED`, `BLOCKED`, or `FAIL`.

- [ ] تقديم تقرير البوابات G1 إلى G10.
- [ ] تقديم نتائج أوامر التحقق.
- [ ] تقديم أدلة الأداء وبيانات الشيت/قاعدة البيانات.
- [ ] تحديث السجل بالمسار والـ commit.
