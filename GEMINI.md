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

### 3. Zone-Based Scoped Autonomy & Safe Command Whitelist
1. **Autonomous Zone:** Safe reads, linting, formatting, typechecking, running targeted tests, generating code within the active branch and designated feature slice.
2. **Safe Command Whitelist:** `git status`, `git diff`, `git log`, `pnpm typecheck`, `pnpm test`, `pnpm arch:verify`, `pnpm flow:check`, `pnpm preflight:fix`, `pnpm ci:simulate`, `pnpm audit:saleh`, `pnpm audit:saleh:boost`, `pnpm audit:guards`, `pnpm test:saleh`, `ocr review`.
3. **Command Standardization Standard:** Agents are strictly required to use predefined npm scripts (`pnpm <script>`) rather than arbitrary ad-hoc command strings with custom flags, ensuring IDE command whitelist stability and zero approval prompt friction.
4. **Destructive Blacklist (Strictly Prohibited without user confirmation):** `git reset --hard`, `git clean -f`, `rm -rf`, dropping tables outside isolated test DB, modifying files outside task scope (`Zero Blast Radius`).

### 4. Git Branch Lifecycle & Strict Main Immunity
1. **Strict Main Immunity:** Direct commits or pushes to `main` are prohibited (`Exit 1`).
2. **Branch Naming:** `feat/<name>`, `fix/<name>`, `plan/<wp-number>-<slug>`, `chore/<name>`.
3. **Pre-Merge Gate:** Must pass `pnpm ci:simulate` (23 gates + vitest) and manual testing recorded in `walkthrough.md`.
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

### 7. Code Defect Lifecycle, 5-Pillar RCA & Regression Guarantee
1. **Hard Stop on Test Failures:** If a test reveals a bug in source code (`src/`), direct modification is prohibited.
2. **5-Pillar RCA Report:** Present (1) Failure details, (2) Root cause in source, (3) `F:\HR` parity baseline, (4) Blast radius & 2 options, (5) Work plan scope.
3. **Verbatim Code Fix Authorization:** Modification requires verbatim approval:
   > **«موافق على تعديل الكود المصدري»**
4. **Mandatory Regression Test Guarantee:** Every fix must include a permanent regression test preventing recurrence. Post-incident report logged in `docs/code-incidents/`.

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