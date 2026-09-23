# Al-Saada Smart Bot — Sovereign Engineering & AI Agent Micro-Kernel (SSOT)

> [!IMPORTANT]
> This document is the supreme sovereign Single Source of Truth (SSOT) for all agent operations, architectural governance, and engineering standards in `Al-Saada Smart Bot`. All agent instructions, IDE configs, subagents, and contributors derive authority from this charter.

---

### 1. Sovereign Agent Identity, Precedence & Architecture
1. **Precedence Hierarchy:** Direct User Orders > `GEMINI.md` (SSOT) > `docs/27` (Gates) > `.agents/rules/` (Domain Rulebooks) > Legacy Docs.
2. **Constitutional Roles:** `/saleh` is the Sovereign Stakeholder Proxy & Chief Strategy Auditor equipped exclusively with the Triple Guard Arsenal (`clean-code-guard`, `test-guard`, `docs-guard`) in `.agents/skills/saleh/arsenal/` for `/boost` forensic auditing; Chief Arbitrator rules on conflicts; Squads execute vertical slices.
3. **Multi-Agent Protocol:** Every major flow requires Challenger review (`challenger_security_concurrency`, `challenger_viewport_responsive`) and Arbitrator sign-off.

### 2. Primary Functional SSOT (`F:\HR` Parity) & Migration Registry
1. **The Primary Baseline:** `F:\HR` is the functional SSOT for all 126 flows. Behavior, screens, calculations, and accounting must match 100%. Legacy spaghetti code must never be copied; re-engineer cleanly.
2. **Zero Flow Divergence:** AI agents are strictly forbidden from modifying, adding, or skipping wizard steps or business logic without explicit user instruction.
3. **Master Migration Registry (`docs/19`):** Completed flows must be updated in [`docs/19`](docs/19-legacy-to-enterprise-master-feature-migration-registry.md) to `🟢 مكتمل وموثق 100%` with commit hash and path. Novel features must be logged under novel enterprise features.
4. **Suspension of Proactive Inspection:** AI agents are strictly forbidden from proactively inspecting or reading `F:\HR` unless the user explicitly and specifically requests it for a given task.

### 3. Zone-Based Scoped Autonomy & Safe Command Whitelist
1. **Autonomous Zone:** Safe reads, linting, formatting, typechecking, running targeted tests, generating code within the active branch and designated feature slice.
2. **Safe Command Whitelist:** `git status`, `git diff`, `git log`, `pnpm typecheck`, `pnpm test`, `pnpm arch:verify`, `pnpm flow:check`, `pnpm preflight:fix`, `pnpm ci:simulate`, `pnpm audit:saleh`, `pnpm audit:saleh:boost`, `pnpm audit:guards`, `pnpm test:saleh`, `ocr review`.
3. **Command Standardization Standard:** Agents are strictly required to use predefined npm scripts (`pnpm <script>`) rather than arbitrary ad-hoc command strings with custom flags, ensuring IDE command whitelist stability and zero approval prompt friction.
4. **Destructive Blacklist (Strictly Prohibited without user confirmation):** `git reset --hard`, `git clean -f`, `rm -rf`, dropping tables outside isolated test DB, modifying files outside task scope (`Zero Blast Radius`).

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

### 8.4 ميثاق المستشار السيادي الدائم للمهارات والخطط (/jev × /saleh) والرسم البياني المعرفي (Work Plan 96)
1. **الرسم البياني المعرفي السيادي الموحد (.agents/knowledge/sovereign-skill-graph.json):**
   يمثل الرسم البياني المعرفي المرجع الرقمي الإلزامي لكافة مهارات المشروع الـ 11 (`.agents/skills/`)، ويربط كل نقطة مهارة بكتيبات القواعد الـ 12 (`Rulebooks 01–12`) وخطط العمل (`WP 88–96`) وبوابات الجودة الـ 23 (`G1–G23`)؛ ويُحظر وجود أي مهارة يتيمة، ويتم التحقق منه دورياً عبر `pnpm skills:verify`.
2. **بروتوكول الاستشارة الثلاثية الإلزامي (The Triple-Checkpoint JEV Consultation Loop):**
   - **الاستشارة القبلية (Pre-Task Plan Readiness):** قبل الشروع في كتابة أي كود أو اعتماد خطة، يستشير الوكيل محرك JEV عبر `pnpm jev:consult --plan <path>`؛ ويُحظر البدء بأي خطة يقل مؤشر جاهزيتها عن 90% (`Plan Readiness < 90%`).
   - **التوجيه المرافق (Mid-Task Diff Sentinel):** تشغيل `pnpm jev --diff` للتحقق اللحظي من ميزانية الأزرار (36/16/7/3)، واستدعاءات captureFlowError، وعقود RichMessage.
   - **التفتيش الجنائي الختامي (Post-Task Boosted Audit):** تشغيل `pnpm audit:saleh:boost` لحساب مؤشر CGI v2.0 عبر الأبعاد الـ 10؛ ويُمنع دمج أي فرع لا يحقق CGI >= 90%.

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

### 11. Direct Action Appendix (ADHD Protocol)
1. Be concise, direct, and structured. Eliminate conversational filler.
2. Highlight blockers, decisions, and required user inputs using bold headers and markdown tables.
3. Deliver complete, working vertical slices verified by real test execution.