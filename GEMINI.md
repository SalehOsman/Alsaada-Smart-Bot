# Al-Saada Smart Bot — Sovereign Engineering & AI Agent Micro-Kernel (SSOT)

> [!IMPORTANT]
> This document is the supreme sovereign Single Source of Truth (SSOT) for all agent operations, architectural governance, and engineering standards in `Al-Saada Smart Bot`. All agent instructions, IDE configs, subagents, and contributors derive authority from this charter.

---

### 1. Sovereign Agent Identity, Precedence & Architecture
1. **Precedence Hierarchy:** Direct User Orders > `GEMINI.md` (SSOT) > `docs/27` (Gates) > `.agents/rules/` (Domain Rulebooks) > Legacy Docs.
2. **Constitutional Roles & Semantic Disambiguation:**
   - **User Saleh (The Human Owner):** The sovereign user, code owner, and ultimate decision-maker who explicitly issues binding checkpoint approvals (`«ادمج الفرع»`, `«موافق على الفتح»`, `«نعم اقفل»`, `«موافق على التعديل او الايقاف او الحذف»`).
   - **Agent Saleh (`/saleh`):** The autonomous Sovereign Stakeholder Proxy & Chief Strategy Auditor equipped with the Triple Guard Arsenal (`clean-code-guard`, `test-guard`, `docs-guard`). When the user references "Saleh" in operational or agent task contexts, it strictly refers to `/saleh`.
   - **Agent Jev (`/jev`):** The Pure Cloud Quality Sentinel and TypeSafe System One coprocessor.
   - **Strict Prohibition of Casual Approvals (حظر الاعتماد الشكلي والكلامي):** AI agents are strictly forbidden from accepting ambiguous or casual confirmations (e.g. «موافق», «تمام», «ok», «yes», «ابدأ») to cross constitutional checkpoints or modify protected entities. Any modification of protected entities without the exact verbatim formula triggers an immediate [REJECT] and Exit Code 1.
3. **Multi-Agent Protocol:** Every major flow requires Challenger review (`challenger_security_concurrency`, `challenger_viewport_responsive`) and Arbitrator sign-off.

### 2. Primary Functional SSOT (`F:\HR` Parity) & Migration Registry
1. **The Primary Baseline:** `F:\HR` is the functional SSOT for all 126 flows. Behavior, screens, calculations, and accounting must match 100%. Legacy spaghetti code must never be copied; re-engineer cleanly.
2. **Zero Flow Divergence:** AI agents are strictly forbidden from modifying, adding, or skipping wizard steps or business logic without explicit user instruction.
3. **Master Migration Registry (`docs/19`):** Completed flows must be updated in [`docs/19`](docs/19-legacy-to-enterprise-master-feature-migration-registry.md) to `🟢 مكتمل وموثق 100%` with commit hash and path. Novel features must be logged under novel enterprise features.
4. **Suspension of Proactive Inspection:** AI agents are strictly forbidden from proactively inspecting or reading `F:\HR` unless the user explicitly and specifically requests it for a given task.

### 3. Zone-Based Scoped Autonomy & Safe Command Whitelist
1. **Autonomous Zone:** Safe reads, linting, formatting, typechecking, running targeted tests, generating code within the active branch and designated feature slice.
2. **Safe Command Whitelist:** `git status`, `git diff`, `git log`, `pnpm typecheck`, `pnpm test`, `pnpm test:smart`, `pnpm test:target`, `pnpm test:changed`, `pnpm test:modules`, `pnpm test:packages`, `pnpm test:governance`, `pnpm pre-commit:fast`, `pnpm arch:verify`, `pnpm flow:check`, `pnpm preflight:fix`, `pnpm ci:simulate`, `pnpm audit:saleh`, `pnpm audit:saleh:boost`, `pnpm audit:guards`, `pnpm test:saleh`, `ocr review`.
3. **Command Standardization Standard:** Agents are strictly required to use predefined npm scripts (`pnpm <script>`) rather than arbitrary ad-hoc command strings with custom flags, ensuring IDE command whitelist stability and zero approval prompt friction.
4. **Destructive Blacklist (Strictly Prohibited without user confirmation):** `git reset --hard`, `git clean -f`, `rm -rf`, dropping tables outside isolated test DB, modifying files outside task scope (`Zero Blast Radius`).
5. **Tri-Tier Test Pyramid & Anti-Slowness Invariant (Work Plan 104):** To preserve engineering velocity without compromising rigor, agents are strictly forbidden from executing the full test suite (`pnpm test` or `pnpm ci:simulate`) during the inner development loop (TDD cycles). Inner-loop execution must strictly use the targeted test runner (`pnpm test:smart` or `pnpm test:target <path>`), achieving < 2s cycle times. Pre-commit hooks execute `pnpm pre-commit:fast` (< 6s budget). Full monorepo simulation (`pnpm ci:simulate`) is strictly reserved for pre-merge validation.

### 4. Git Branch Lifecycle & Strict Main Immunity
1. **Strict Main Immunity:** Direct commits or pushes to `main` are prohibited (`Exit 1`).
2. **One Branch, One Objective (OBOO Invariant) & Branch Taxonomy:**
   - `fix/inc-<date>-<slug>`: Dedicated isolated defect repair branch created strictly from clean `main` via `pnpm branch:incident <slug>`.
   - `feat/<name>`: Dedicated isolated feature branch created from clean `main` via `pnpm branch:feature <name>`.
   - `plan/<wp-number>-<slug>`: Work plan branch created from clean `main` via `pnpm branch:plan <slug>`.
   - `chore/<name>`: Maintenance and infrastructure branch.
   - **Zero Branch Contamination:** Mixing bug fixes into feature branches or piggybacking new features onto defect branches is strictly prohibited.
3. **Pre-Merge Gate:** Must pass `pnpm ci:simulate` (23 gates + vitest), `pnpm incident:verify` (if defect fix), and manual testing recorded in `walkthrough.md`.
4. **Verbatim Merge Approval:** Merging to `main` (`git merge --no-ff`) requires the verbatim, untranslated formula:
   > **«ادمج الفرع»**

### 5. Canonical Quality Gates Matrix (G1–G23)
All code and flows must pass the 23 Quality Gates defined in [`docs/27`](docs/27-enterprise-ai-governance-and-quality-gates-constitution.md) and [`docs/21`](docs/21-mandatory-module-architecture-and-gates.md):
- **G1–G5 (Structure & Parity):** G1 Type Safety, G2 10-File Slice Architecture, G3 Migration Registry Parity, G4 Flow Contracts (`flow.contract.json`), G5 Telegram Contracts (<=512 URL, <=64 Callback).
- **G6–G10 (Performance & Security):** G6 Sub-300ms Latency Budget, G7 RBAC Matrix & Role Immunity, G8 Compensation Field Masking, G9 Observability (Zero silent failure / console.error), G10 Test Authenticity.
- **G11–G15 (Accounting & Governance):** G11 Legacy Accounting Invariants, G12 Financial Ledger Double-Entry, G13 Cryptographic Tamper Guard, G14 Smart Pre-Commit Test Guard, G15 Git Hygiene.
- **G16–G20 (Docs & Hardening):** G16 Secret Leakage Prevention, G17 SAST Security Scan, G18 Release Sync, G19 Documentation Sync & Parity, G20 DB Migration Reversibility.
- **G21–G23 (Enterprise Rigor):** G21 Idempotency & Concurrency Safety, G22 Mobile Viewport Ergonomics, G23 Mutation & Anti-Flake Coverage.

### 6. Cryptographic Immutability Engine (`governance.lock.json`)
1. **Unified Lock Engine:** Monorepo entities are locked via `pnpm lock <target>` (`tools/governance/unified-lock-engine.ts`) with SHA-256 hashes in `governance.lock.json`.
2. **Absolute Zero Blast Radius:** Unlocking one entity never touches other locked entities.
3. **Mandatory Dynamic OTP Challenge-Response Protocol (Work Plan 90):**
   - The `--phrase` CLI flag is **permanently abolished**. AI agents cannot pass approval phrases via CLI arguments.
   - **Step 1 (Request):** Run `pnpm unlock:request <target> --reason="<justification>"`. A unique, cryptographically signed OTP nonce (`UNLOCK-XXXXXX`) is generated with a strict 300s (5-minute) TTL.
   - **Step 2 (Hard Stop & Human Chat Authorization):** The agent MUST STOP immediately and request Saleh to send the approval in chat:
     > **«موافق على الفتح <UNLOCK-XXXXXX>»** or **«نعم موافق على التعديل <UNLOCK-XXXXXX>»**
   - **Step 3 (Forensic Confirmation):** Run `pnpm unlock:confirm <target>`. The engine forensically verifies physical provenance from `transcript.jsonl` ensuring the phrase and OTP nonce were issued strictly by `USER_EXPLICIT` (Saleh) and burns the OTP nonce (single-use anti-replay guard).
4. **Strict Prohibition of Self-Authorization & Fraud Enforcement:** AI agents are strictly forbidden from generating, authoring, or simulating approval formulas or nonces. Any self-authorization attempt triggers an immediate `[REJECT]` verdict, exits code 1, and logs a forensic incident.
5. **Pre-Edit Lock Inspection:** Before modifying any file, agents must verify that the file is not locked in `governance.lock.json`. Touching a locked file without prior authorized unlock execution (`pnpm unlock:confirm`) is a constitutional breach.
6. **Mandatory AI Auto Re-Lock Invariant (إلزامية القفل التلقائي للذكاء الاصطناعي):**
   - Whenever an AI agent completes modifications to any unlocked entity (after receiving verified OTP approval), before requesting branch merge (`git merge --no-ff` / «ادمج الفرع») or concluding its turn, the agent MUST automatically and mandatorily re-lock what was opened: `pnpm lock <target>` (or `pnpm lock:all`).
   - The agent MUST explicitly output the verbatim confirmation in its final message:
     > **«تم قفل الوظيفة [س]»** (e.g. `✅ تم قفل الوظيفة flow:01.1` or `✅ تم قفل الشاشة dashboard:workforce/clearances`).
   - **Strict Pre-Merge Lockdown Gate:** Any unsealed or modified entity that remains unlocked immediately aborts merge and CI execution with Exit 1 (`pnpm lock:verify`).
7. **Comprehensive Monorepo Sealing & Strict Ban on Unlock-All:**
   - `pnpm lock:all` seals 100% of all lockable components across the monorepo independently (Zero Blast Radius): 8 packages, 22 bot flows, 33 dashboards, 3 applications, 3 domain modules, infrastructure, and all 267 test suites.
   - Any `unlock:all` or mass unlocking capability is strictly, permanently, and constitutionally prohibited (fatal error). Unlocking is exclusively allowed on a granular, per-entity basis via the dynamic OTP challenge protocol.
8. **Physical Lock Armor & Active Unlock Session Guard (Work Plan 100):**
   - Re-hashing and sealing modified protected governance files into `governance.lock.json` (`pnpm governance:lock` / `pnpm lock:all`) strictly requires an active authorized unlock session in `.governance-cache/active-governance-unlocks.json`.
   - Attempting to seal modifications without an active session triggers `🚨 [CRITICAL GOVERNANCE BREACH: UNAUTHORIZED PROTECTED ENTITY MODIFICATION]` and immediately halts execution (Exit 1).
   - Upon completing modifications, re-locking automatically burns the active session token.

### 7. Code Defect Lifecycle, Spec-First Dossier & Incident Attestation (Work Plan 93)
1. **Spec-Before-Code Invariant (حظر التعديل بلا خطة مسبقة):** No source code modification (`src/`) or bug fix is permitted without an approved work plan or incident dossier. Jumping directly to code edits upon test failure is strictly prohibited.
2. **Dedicated Branch Isolation (العزل الإلزامي التام في فروع Git منفصلة):** Every fix must occur in a dedicated isolated branch `fix/inc-<date>-<slug>` created directly from clean `main` (`pnpm branch:incident <slug>`).
3. **Comprehensive Forensic Defect Dossier (`docs/code-incidents/`):** Mandatory authenticated report conforming strictly to `TEMPLATE.md` with all 6 sections:
   (1) Metadata & Scope (including branch name), (2) Symptoms & Failure Signatures (Actual vs Expected terminal output), (3) 5 Whys RCA & `F:\HR` parity baseline, (4) Resolution details with exact diff and approval formula, (5) Permanent regression proof and real terminal execution log, (6) Preventive recommendations.
4. **Zero-Placeholder Invariant (حظر التقارير الشكلية):** All reports must pass `pnpm incident:verify` with zero unfilled placeholders (`[...]`, `TODO`, `TBD`, `path/to/...`, etc.) and all referenced test/source file paths verified physically on disk.
5. **Verbatim Code Fix Authorization Formula:** Modification requires verbatim approval:
   > **«موافق على خطة الإصلاح»** or **«موافق على تعديل الكود المصدري»**
6. **Mandatory Completion Attestation Card (بطاقة إقرار الاكتمال الجنائي الإلزامي):**
   Upon completing the defect repair, the agent MUST output the verbatim attestation card in its completion report:
   > **«✅ تم توثيق وحل الخلل بالكامل في مجلد المشاكل [INC-YYYYMMDD-SLUG] داخل الفرع المنعزل واجتياز الفحص الجنائي»**
7. **Pre-Merge Incident Gate:** Passing `pnpm incident:verify` and `pnpm test:incidents` is a mandatory blocker before requesting branch merge (`git merge --no-ff` / «ادمج الفرع»).

### 7.1 الإلزام القطعي بالمسارات التشغيلية الثلاثة (The Tri-Lifecycle Sovereignty — WP 94)
بموجب ميثاق خطة العمل السيادية رقم 94 (`docs/work-plans/94-plan-sovereign-tri-lifecycle-governance-and-ai-agent-invariant.md`)، يخضع أي وكيل ذكاء اصطناعي أو أداة برمجية تعمل في هذا المستودع للإلزام الصارم والقطعي بالمسارات التشغيلية الثلاثة، مع حظر تام لأي خروج عنها:
1. **مسار التعديل البرمجي (Rulebook 11):** صياغة الخطة واعتمادها أولاً، فك القفل المشفر برمز OTP المؤقت، التطوير بـ TDD، الفحص والتحقق، إعادة القفل التلقائي فوراً، تسليم البطاقات الخمس في الشات، والدمج بصيغة «ادمج الفرع».
2. **مسار الإنشاء الجديد (Rulebook 12):** صياغة المواصفة السداسية واعتمادها أولاً، التوليد الهيكلي الآلي عبر `pnpm make:flow` لشريحة الـ 10 ملفات، التطوير المنضبط وعقود Zod، القفل التشفيري الأولي في `governance.lock.json`، توثيق سجل الترحيل `docs/19`، وتسليم البطاقات الخمس في الشات.
3. **مسار إصلاح الأعطال والتحقيق الجنائي (Rulebook 08 / WP 93):** تجميد الكود فوراً عند فشل الاختبارات (حظر الترقيع الفوري)، فتح فرع الحادثة المنعزل `fix/inc-*`، تحرير الملف الجنائي المسبق في `docs/code-incidents/`، اعتماد الخطة بصيغة «موافق على خطة الإصلاح»، كتابة اختبار تراجع دائم (Permanent Regression Test)، اجتياز الفحص الآلي `pnpm incident:verify` و `pnpm test:incidents`، وإصدار بطاقة الإقرار الجنائي الإلزامية.
- **عقوبة المخالفة:** يُسقط عمل الوكيل فوراً بحكم `[REJECT]` قطعي من `/saleh`، ويُمنع دمج الفرع نهائياً.

### 7.2 الإلزام الدستوري الصارم بميثاق منهجية وكلاء الذكاء الاصطناعي وحظر السراب البرمجي (The Anti-Mirage Constitution — Rulebook 13 & WP 116)
بموجب ميثاق خطة العمل السيادية رقم 116 وكتيب القواعد رقم 13 (`.agents/rules/13-ai-agent-methodology-and-anti-mirage-constitution.md`)، يُلزم كافة وكلاء الذكاء الاصطناعي والمهندسين بالامتثال الصارم والقطعي للمحددات المنهجية الأربعة، مع حظر الوقوع في عيوب الاستنتاج التخميني أو الترقيع السطحي:
1. **محدد التكافؤ التام لقاعدة البيانات المؤقتة (Zero-Assumption Ephemeral Database Parity Invariant):**
   - يُحظر قطعياً افتراض صحة قاعدة البيانات بمجرد نجاح أو تخطي أمر `pnpm test` محلياً. بيئة التكامل المستمر (GitHub CI) تعتمد على قاعدة بيانات PostgreSQL خالية تماماً ومؤقتة (`alsaada_db`).
   - يجب ضمان اكتشاف ونشر كافة الهجرات الـ 10 عبر التحديد الصريح لمسار المخطط (`prisma migrate deploy --schema=prisma/schema.prisma`)، والتحقق الصارم من حالة الهجرات وعدم الاكتفاء برسالة مضللة كـ `No migration found in prisma/migrations`.
2. **محدد التشخيص الجنائي القاطع المبني على الواقع الفيزيائي (Zero-Mirage Diagnostic Invariant):**
   - يُحظر قطعياً على أي وكيل صياغة فرضيات أو أسباب لأي عطل أو تقديم حلول تخمينية دون قراءة وفحص سجلات الخطأ الفعلية الكاملة (`Terminal Output` / `gh run view --log`).
   - يُمنع الخلط بين أعطال الحاويات والبناء (`Docker Build`) وأعطال الاختبارات التشغيلية (`pnpm test`)؛ كل عطل يجب عزله وتوثيقه بدقة جنائية 100%.
3. **محدد تحسين أداء الحاويات وهندسة البناء السريع (Monorepo Build Optimization Invariant):**
   - يُحظر قطعياً تعطيل مزايا مديري الحزم المتطورة مثل استبدال الروابط الصلبة بالنسخ البطيء (`package-import-method copy`).
   - يجب استغلال ذاكرة التخزين المؤقت لبناء الحاويات (`BuildKit Cache Mounts`) مع الحفاظ على مدة بناء تقل عن 60 ثانية، وحظر نسخ المجلدات الزائدة داخل صورة التشغيل النهائية (`runner`).
4. **محدد الحوكمة الديناميكية للمجموعات وحظر العدادات الصماء (Dynamic Set Governance Invariant):**
   - يُحظر قطعياً كتابة اختبارات حوكمة تعتمد على أرقام صماء ثابتة ومطلقة (`toBe(367)`) تتسبب في كسر الـ CI عند إضافة أي اختبار تراجع دائم جديد.
   - يجب صياغة اختبارات الحوكمة دوماً باستخدام محددات المجموعات الديناميكية (`toBeGreaterThanOrEqual(minBaseline)`) مع التحقق الصارم من تغطية 100% من الملفات المكتشفة دون استثناء (`unlockedEntities.length === 0`).
- **عقوبة المخالفة:** يُسقط عمل الوكيل فوراً بحكم `[REJECT]` قطعي، ويُعد الإخلال بهذه المحددات خرقاً دستورياً موجباً للتراجع الفوري.

### 8. Telegram Mobile Ergonomics & 10-File Vertical Slice Standard
1. **Strict 10-File Vertical Slice:** Every bot flow under `modules/<name>/src/flows/<code-slug>/` must contain exactly:
   `flow.contract.json`, `index.ts`, `controller.ts`, `menu.builder.ts`, `action.handler.ts`, `service.ts`, `types.ts`, `validator.ts`, `error.handler.ts`, and test under `<module>/tests/flows/`.
2. **Telegram Button & Text Budget (36/16/7/3):**
   - Max 36 bytes for callback data (hard limit 64 bytes).
   - Max 16 characters per inline button label (mobile viewport clipping prevention).
   - Max 7 rows per inline keyboard; max 3 buttons per row.
   - Every flow walkthrough must include a visual Mermaid `stateDiagram-v2` in `walkthrough.md`.

### 8.1 الإلزام المطلق بمحرر النصوص الغني (@alsaada/core-components/rich-message)
1. **حظر الرسائل العادية (Zero Raw Text Policy):** يُحظر قطعيًا على أي وكيل ذكاء اصطناعي أو مطور استخدام نصوص مجردة، أو استدعاء `ctx.reply("string")` أو `ctx.editMessageText("string")` مباشرة في أي تدفق (`flow.handler.ts`).
2. **العقد الموحد (InputRichMessage):** كافة رسائل البوت يجب أن تصاغ حصراً عبر قوالب الكتل الرسمية (`buildRichPage`, `buildRichTable`, `buildRichConfirmation`) المستوردة من `@alsaada/core-components/rich-message`.
3. **الفحص الجنائي القبلي (assertRichMessage):** كل رسالة يجب أن تمر عبر `assertRichMessage(msg)` للتحقق الصارم من:
   - تحديد نمط واحد فقط: إما `blocks` أو `markdown` أو `html`.
   - عدم تجاوز الحدود الخمسة: 32,768 حرفاً، 500 كتلة، 16 مستوى تداخل، 50 مرفق وسائط، 20 عموداً للجدول.
4. **عقوبة المخالفة:** يُسقط التدفق فوراً في Gate G5 و Gate G22 ويُصدر ضده حكم `[REJECT]` قطعي من `/saleh`.

### 8.2 الإلزام الدستوري بالموسوعة المرجعية الرسمية لتليجرام (Work Plan 95)
1. **المرجع الدستوري الأعلى للواجهات:** تمثل الموسوعة المرجعية الرسمية في [`docs/telegram/official-telegram-bot-features-and-formatting-encyclopedia.md`](docs/telegram/official-telegram-bot-features-and-formatting-encyclopedia.md) المستندة لمواصفات منصة تليجرام الرسمية ([Telegram Bot Features](https://core.telegram.org/bots/features) و [Rich Markdown Style & Formatting Options](https://core.telegram.org/bots/api#rich-markdown-style)) المرجع التوثيقي والإرشادي الإلزامي لكافة وكلاء الذكاء الاصطناعي (AI Agents).
2. **حظر الاستحداث بلا مرجعية (Zero Specless Innovation):** يُحظر قطعيًا على أي وكيل ذكاء اصطناعي تصميم أو توليد أو تعديل أي ميزة، أمر، لوحة مفاتيح، رسالة خفية (`ephemeral`)، مسودة متدفقة (`streaming draft`)، أو كولاج وسائط دون مطابقة الهيكل والمحددات الواردة في الموسوعة.
3. **قائمة الفحص الذاتي الإلزامية:** يُلزم كل وكيل ذكاء اصطناعي بمراجعة قائمة الفحص الذاتي (AI Self-Inspection Checklist) المحددة في الجزء السابع من الموسوعة قبل إنهاء مهمته البرمجية، واجتياز Gate G5 و Gate G22.

### 8.3 الإلزام الدستوري بتسجيل وتتبع الأعطال في التدفقات وبوابة Gate G9 AST (`NEW-91`)
1. **النقطة الأحادية للمسؤولية (Single Point of Responsibility):** تتحمل طبقة حدود التدفق (`controller.ts` و `error.handler.ts`) حصراً مسؤولية تسجيل الأعطال عبر `await captureFlowError(error, boundedContext)` المستورد من `@alsaada/telemetry` وإرجاع بطاقة البلاغ (`#ERR-XXXXXXXX`) للمستخدم؛ يُحظر على الطبقات الداخلية (`service.ts`, `repository.ts`, `validator.ts`) استدعاء خزينة الأعطال مباشرة وتلتزم برمي الاستثناءات أو إعادة رميها (`re-throw`).
2. **السياق التشخيصي المقيد (`BoundedFlowContext`):** يُحظر تمرير `ctx?: unknown` إلى معالجات الأخطاء؛ يجب الالتزام بعقد `BoundedFlowContext` والمهلة القصوى غير المعطلة (`1500ms`) مع التراجع التلقائي إلى `writeEmergencyIncident`.
3. **بوابة الفحص النحوي العميق (Gate G9 AST Sentinel):** يفحص `pnpm observability:verify` شجرة الـ AST عبر TypeScript Compiler API لإسقاط أي كتلة `catch` تبتلع الأخطاء صامتاً، أو دوال صورية غير مستوردة من `@alsaada/telemetry`، أو استدعاءات `captureFlowError` / `handle*Error` غير مسبوقة بـ `await`.

### 8.4 ميثاق المستشار السيادي الدائم للمهارات والخطط (/jev × /saleh) وحارس الجودة السحابي (Work Plans 96 & 97)
1. **الرسم البياني المعرفي السيادي الموحد (.agents/knowledge/sovereign-skill-graph.json):**
   يمثل الرسم البياني المعرفي المرجع الرقمي الإلزامي لكافة مهارات المشروع الـ 11 (`.agents/skills/`)، ويربط كل نقطة مهارة بكتيبات القواعد الـ 12 (`Rulebooks 01–12`) وخطط العمل (`WP 88–97`) وبوابات الجودة الـ 23 (`G1–G23`)؛ ويُحظر وجود أي مهارة يتيمة، ويتم التحقق منه دورياً عبر `pnpm skills:verify`.
2. **بروتوكول الاستشارة الثلاثية الإلزامي (The Triple-Checkpoint JEV Consultation Loop):**
   - **الاستشارة القبلية (Pre-Task Plan Readiness):** قبل الشروع في كتابة أي كود أو اعتماد خطة، يستشير الوكيل محرك JEV عبر `pnpm jev:consult --plan <path>`؛ ويُحظر البدء بأي خطة يقل مؤشر جاهزيتها عن 90% (`Plan Readiness < 90%`).
   - **التوجيه المرافق (Mid-Task Diff Sentinel):** تشغيل `pnpm jev --diff` للتحقق اللحظي من ميزانية الأزرار (36/16/7/3)، واستدعاءات captureFlowError، وعقود RichMessage.
   - **التفتيش الجنائي الختامي (Post-Task Boosted Audit):** تشغيل `pnpm audit:saleh:boost` لحساب مؤشر CGI v2.0 عبر الأبعاد الـ 10؛ ويُمنع دمج أي فرع لا يحقق CGI >= 95%.
3. **الإلزام السحابي الحصري لحارس الجودة (/jev Pure Cloud Sentinel - WP 97):**
   - يرتبط `/jev` سحابياً حصراً بمحرك TypeSafe System One (`https://api.typesafe.ai/v1/systemone`) عبر الـ CLI والـ CI، مع حظر قاطع ونهائي لأي تراجع صامت إلى الهجين المحلي (Zero Silent Local Fallback).
   - تحمل كافة معايير الفحص الـ 25 إسناداً سحابياً حقيقياً `Engine: api`.
   - في حال تعذر الاتصال، يُطبق بروتوكول التراجع التصاعدي الثلاثي (`1s -> 2s -> 4s Backoff` مع مهلة 5000ms لكل محاولة) ويسقط الفحص فوراً بـ Exit Code 1 مع طباعة البطاقة التشخيصية.
4. **المستشار الاستراتيجي المرن والمطور ذاتياً (/saleh Resilient Coprocessor):**
   - يستعين `/saleh` بـ JEV السحابي لتطوير قدراته وتدقيق الخطط وحل المعضلات بصورة دائمة.
   - يتمتع `/saleh` بالمرونة؛ فإذا تعذر الاتصال بالسيرفر السحابي، لا يتعطل بل يسجل إشعار التعذر بشفافية ويستكمل أعماله الرقابية والفيزيائية مستقلاً.
5. **اقتصاد التوكينات وفهرس السوابق الجنائية (Zero-Token Precedent Index):**
   - يُلزم بالاستعلام أولاً من فهرس السوابق `.agents/knowledge/precedents/index.json` للاسترجاع الفوري بصفر توكن وزمن استجابة <1ms قبل استدعاء السحابة، وضغط الفروقات الكبيرة (>300 سطر) عبر AST Delta Compression.
6. **الإلزام الصارم ببيان عداد طلبات النموذج السحابي (Mandatory Cloud Model Request Telemetry Invariant):**
   - يُلزم الوكيلان `/jev` و `/saleh` إلزاماً قطعياً وصارماً في **كل جولة عمل وكل تقرير نهائي** بإدراج جدول **«📡 بيان طلبات النموذج السحابي الإلزامي (Mandatory Cloud Model Request Telemetry)»** موضحاً بدقة: عدد الطلبات الفعلية المرسلة للنموذج السحابي (`cloudRequestsSent`)، وإجمالي محاولات الاتصال بالشبكة (`httpAttemptsTotal`)، والاستجابات المسترجعة من الكاش التشفيري (`cloudCacheHits`)، وفهرس السوابق (`precedentHits`)، وإجمالي المعايير المقيمة (`questionsDispatchedToCloud`)؛ ويُعد غياب هذا البيان مخالفة تستوجب `[REJECT]` فوري.

### 8.5 الإلزام الدستوري القطعي بمنهجية FCIS البرمجية وعزل الشرائح وحارس شجرة الكود الشامل (Work Plan 101)
بموجب ميثاق خطة العمل السيادية رقم 101 (`docs/work-plans/101-plan-sovereign-fcis-coding-paradigm-and-ast-enforcement.md`)، يخضع كل وكيل ذكاء اصطناعي أو أداة برمجية في كافة مناطق المستودع الخمس (`packages/*`, `modules/*`, `apps/bot-server`, `apps/admin-dashboard`, `tools/*`) لمنهجية **«FCIS: Functional Core, Injectable Service Shell»** بلا أي استثناء:
1. **النواة الوظيفية النقية (Pure Functional Core — 80%):**
   - تُكتب كافة ملفات (`validator.ts` / `flow.validators.ts`, `menu.builder.ts` / `flow.keyboard.ts`, `flow.messages.ts`, `controller.ts` / `flow.handler.ts`, `action.handler.ts`, `error.handler.ts`, `flow.telemetry.ts`) وكافة مكونات React والـ Hooks (`*.tsx`, `use*.ts`) ومسارات الـ API (`route.ts`) وأدوات الحوكمة (`tools/*`) والدوال المشتركة في `packages/*` **حصراً كدوال نقية مصدرة مباشرة (`export function` / `export async function`)** ومخططات `Zod`.
   - **حظر الكلاسات الاستاتيكية الصورية:** يُحظر قطعياً تعريف `class` يحتوي على دوال `static` (مثل `class XKeyboards { static ... }`) أو الاكتفاء بكائن تجميع بدون تصدير الدوال النقية مباشرة.
2. **غلاف حقن الاعتماديات (Injectable OOP Shell Only — 20%):**
   - يُحصر تعريف `export class` في ملفات الخدمات والمستودعات والمحركات فقط (`*.service.ts` / `service.ts`, `*.repository.ts` / `repository.ts`, `*.store.ts`, `*.engine.ts`, `*.client.ts`, `*.manager.ts`) أو أخطاء النظام (`extends Error`).
   - يجب أن تكون جميع خصائص الكلاس عديمة الحالة الخاصة بالمستخدم (`private readonly` محقونة عبر الـ `constructor` حصراً لمنع تداخل الجلسات `Race Conditions` — Gate G21).
3. **حظر الوراثة بين الخدمات (Zero Inheritance Invariant — Ban extends):**
   - يُحظر استخدام الوراثة (`extends`) بين أي خدمات أو مستودعات؛ ويُعتمد مبدأ التركيب (`Composition`) وتطبيق الواجهات (`implements`) حصراً.
4. **العزل الهيكلي التام وحظر الاستيراد العابر بين التدفقات (100% Vertical Slice Isolation):**
   - تحتفظ كل وظيفة (`Flow`) بملفاتها الـ 10 المستقلة داخل مجلدها المعزول، ويُحظر قطعياً على أي ملف داخل وظيفة `Flow A` أن يستورد أي دالة أو كلاس أو نوع من داخل مجلد وظيفة شقيقة `Flow B` (`CROSS_FLOW_ISOLATION_BREACH`).
5. **بوابة الفحص النحوي الشامل (Gate G2 Universal FCIS AST Sentinel):**
   - يفحص `pnpm arch:verify` (`tools/governance/verify-architecture.ts`) شجرة الكود (`TypeScript AST`) لجميع التدفقات والملفات، ويُسقط أي مخالفة فوراً بـ `Exit Code 1`.

### 8.6 المعيار الرباعي السيادي لقواعد بيانات الموديولات وحظر المفاتيح الأجنبية الصلبة (Work Plan 117 Modular DB Invariant)
بموجب ميثاق خطة العمل السيادية رقم 117 (`docs/work-plans/117-plan-sovereign-modular-database-emancipation-and-ghost-table-purge.md`)، يُلزم كافة وكلاء الذكاء الاصطناعي والمطورين بالامتثال الصارم والقطعي للمحددات الهندسية لقواعد البيانات:
1. **المعمارية الرباعية الإلزامية لكل موديول أعمال (`modules/<name>/database/`):**
   - كل موديول يتطلب استبقاء بيانات يجب أن يحتوي حصراً واستقلالاً على 4 مكونات معمارية:
     - `schema.prisma`: النماذج والتعدادات الحصرية للموديول.
     - `relations.contract.json`: عقد إعلان التبعيات والعلاقات الرخوة المفهرسة.
     - `erd.mermaid`: مخطط علاقات الكيانات البصري التفاعلي الخاص بالموديول.
     - `migrations/`: مسار ترحيلات SQL الحتمية الخاصة بالموديول.
2. **محدد التفكيك التام وحظر المفاتيح الأجنبية الصلبة (Strict Loose ID Coupling Invariant):**
   - **يُحظر قطعياً** على أي وكيل ذكاء اصطناعي صياغة علاقات مفاتيح أجنبية فيزيائية عابرة للموديولات باستخدام `@relation`.
   - يتم الربط بين الموديولات حصراً عبر **معرفات رخوة مفهرسة (Indexed Loose Scalars)**، مثل `workerId String @db.Uuid` أو `targetAdminId String? @db.Uuid` مع وضع `@index` صريح.
   - استعلامات طبقة التطبيق ولوحة الإدارة تعتمد البحث المنفصل (Separate Loose ID Lookups)، ويُمنع الـ Nested Include العابر للموديولات.
3. **حصانة النواة المشتركة وتطهير الجداول الشبحية (Central Core Immunity):**
   - تقتصر نواة قاعدة البيانات المركزية في `packages/database/prisma/schema.prisma` حصراً على **14 نموذجاً سيادياً** للبنية التحتية والقيود المالية العامة.
   - يُحظر تماماً إضافة أي جدول أعمال داخل النواة المشتركة. الجداول المستقبلية تحفظ كمسودات في `docs/schemas/future-modules-draft-schemas/` وتسجل في `docs/schemas/deprecated-models.json`.
4. **التجميع السيادي وصمام التكافؤ (Gate G20 Sentinel):**
   - يتم تجميع المخططات آلياً وتوليد عميل Prisma Client الموحد عبر المحرك السيادي:
     ```bash
     pnpm db:reconcile
     ```
   - اجتياز صمام حراسة بوابة الجودة G20 (`pnpm db:parity:verify`) شرط قطعي غير قابل للاستثناء لأي دمج أو اعتماد.

### 8.7 محددات سلامة خطافات الالتزام ومزامنة التوثيق المشفر (Pre-Commit & Docs Sync Invariants)
1. **إلزامية إعادة قفل بوابة التوثيق بعد المزامنة (Docs Sync Auto-Relock):** تشغيل أمر `pnpm docs:sync` يقوم آلياً بتحديث محتوى `apps/docs/src/content/docs/`. يُلزم الوكيل فوراً بتنفيذ `pnpm lock app:docs` لختم الكيان المشفر ومنع كسر `pnpm lock:verify`.
2. **صيانة بيئة خطافات الالتزام السريع (Pre-Commit Environment Guard):** عند ارتكاب أي Commit يتضمن تعديلات في المخططات أو النواة المالية، يجب ضمان تمرير متغير `DATABASE_URL` صراحة أو الاعتماد على وضع الفحص التشفيري الذاكراتي الخفيف (`memoryOnly: true`) لتفادي تجويع حلقة الأحداث الناتج عن التوازي الكثيف.
3. **التسلسل الإلزامي لفك الأقفال المشفرة (Sequential OTP Challenge Invariant):** ملف التحدي `.governance-cache/pending-unlock.json` ذو سعة أحادية؛ يُحظر طلب فك أقفال متعددة بالتوازي، ويلتزم الوكيل ببروتوكول الخطوات الخمس تسلسلياً (طلب -> اعتماد -> تأكيد -> تعديل -> إعادة قفل).

### 9. Novel Enterprise Reliability Suite
1. **Strict Idempotency:** Every state transition and financial action must use idempotency keys.
2. **Zod Runtime Deserialization:** Zero untyped `JSON.parse` across boundaries.
3. **Deterministic Pinned Clock:** Tests must pin `PINNED_BASE_TIME` — zero `Date.now()` drift.
4. **Zero Console Policy:** Use `@alsaada/shared/logger` exclusively. `console.log` / `console.error` will fail G9.
5. **Regression Test Lock:** Regression tests are permanently locked under `test:<path>` in `governance.lock.json`.

### 10. Advanced AI Discipline Framework
1. **Invariant Test Lock & Two-Key Exception:** Modifying existing tests is strictly forbidden unless proving a specification change with explicit two-key user confirmation.
2. **Reuse-First Gate:** Always inspect `@alsaada/shared/domain` and `packages/shared/` before creating custom helpers.
3. **Scaffolding Suite:** Always use generators: `pnpm make:flow`, `pnpm make:test`, `pnpm make:incident`.
4. **Topology Map:** Query `.agents/topology.json` for O(1) instant location of flows, models, and slices.
5. **Self-Healing Formatting:** Run `pnpm preflight:fix` to resolve formatting and lint errors cleanly.
6. **Zero-Network Development & Air-Gapped Local Invariant (Work Plan 102):** Prohibits running `pnpm install`, `pnpm add`, `npm install`, or `docker compose build` during feature development or defect repair. All development and verification execute 100% locally via `vitest`, `pnpm test`, `pnpm dev:bot`, and `pnpm ci:simulate` (`prefer-offline=true`, `verify-deps-before-run=false`, and `supportedArchitectures` restricted to `win32`/`linux` `x64`).

### 11. Direct Action Appendix (ADHD Protocol)
1. Be concise, direct, and structured. Eliminate conversational filler.
2. Highlight blockers, decisions, and required user inputs using bold headers and markdown tables.
3. Deliver complete, working vertical slices verified by real test execution.