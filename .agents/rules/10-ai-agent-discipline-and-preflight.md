# Domain Rulebook 10: AI Agent Discipline, Pre-Flight & Anti-Drift Protocol

> **Authority:** Derived from [`GEMINI.md`](../../GEMINI.md) Part 10 & [`tools/scaffold/`](../../tools/scaffold/).  
> **Status:** Mandatory Behavioral & Engineering Standard.

---

## 1. The 4 AI Anti-Drift Discipline Principles

To maintain architectural purity and prevent hallucinated patterns, all agents must adhere to:

1. **Invariant Test Lock & Two-Key Exception:**
   - Never weaken, skip, or edit existing tests to force a green build.
   - Any test change requires documented two-key authorization proving specification updates.
2. **Reuse-First Gate:**
   - Before implementing custom math, validation, or string parsing helpers, agents must inspect `@alsaada/shared/domain` and `packages/shared/`.
   - Creating duplicate utility functions across modules will fail architectural verification.
3. **Scaffolding Suite Requirement:**
   - Always use authorized CLI generators:
     - `pnpm make:flow`: Scaffolds standard 10-file vertical slices.
     - `pnpm make:test`: Scaffolds authenticated Vitest suites.
     - `pnpm make:incident`: Scaffolds 5-pillar postmortem reports.
4. **Topology Map Direct Lookup:**
   - Use `.agents/topology.json` for O(1) instantaneous discovery of flows, database models, and active vertical slices rather than issuing expensive recursive scans.
5. **Predefined Script Execution Standard:**
   - Agents must exclusively run standardized npm scripts from `package.json` (`pnpm <script>`) rather than arbitrary ad-hoc command strings with custom dynamic flags, ensuring IDE command whitelist stability and zero approval prompt friction.
6. **Mandatory Auto Re-Lock & Verbal Confirmation (إلزامية القفل التلقائي والتأكيد النصي):**
   - After completing edits on any unlocked entity, the agent must automatically re-lock the entity (`pnpm lock <target>` or `pnpm lock:all`) before requesting branch merge with «ادمج الفرع» or concluding the session.
   - The agent MUST explicitly output the verbatim confirmation in its final message:
     > **«تم قفل الوظيفة [اسم/معرف الوظيفة]»** (e.g., `✅ تم قفل الوظيفة flow:01.1` or `✅ تم قفل الشاشة dashboard:workforce/clearances`).
   - Leaving any entity unsealed before merge is strictly prohibited (`Exit 1`).
7. **Pure Cloud JEV & Resilient /saleh Protocol (Work Plan 97):**
   - Every invocation of `/jev` via CLI (`pnpm jev`, `pnpm jev:diff`, `pnpm jev:consult`) must run against the pure cloud endpoint `https://api.typesafe.ai/v1/systemone` with genuine `Engine: api` provenance. Never accept partial heuristic mock answers.
   - `/saleh` continuously consults JEV cloud to expand its strategic knowledge base and solve complex bugs, but remains resilient: if JEV cloud is down, `/saleh` logs a transparent note and continues independent verification without halting.
   - Prioritize zero-token precedent index lookup (`.agents/knowledge/precedents/index.json`) for known issue signatures before triggering LLM tokens.
   - Every work round and final report involving `/jev` or `/saleh` MUST include the **Mandatory Cloud Model Request Telemetry Statement (`📡 بيان طلبات النموذج السحابي الإلزامي`)** detailing `cloudRequestsSent`, `httpAttemptsTotal`, `cloudCacheHits`, `precedentHits`, `questionsDispatchedToCloud`, and `engineMode`.
8. **Cross-Platform Tool Resolution & Documentation Portal Sync:**
   - Never hardcode bare CLI tools (e.g. `tsc`) in Node child process executions; resolve cross-platform binaries via `node_modules/.bin/tsc.cmd` on Windows.
   - Never run `tsc` without `--noEmit` (`pnpm typecheck`), as emitted `.js`/`.d.ts` files inside `src/` or `tools/` trigger `UNRECORDED` file errors in Gate G13 (`governance:tamper-check`).
   - Prefer `pnpm run lock <target>` over `pnpm lock <target>` in `pnpm@12.4.2` to bypass built-in package manager subcommand collision and execute lock sealing instantaneously.
   - When modifying test files under `tools/governance/tests/*.spec.ts`, always execute **dual-layer sealing**: run `pnpm lock test:tools/governance/tests/<file>.spec.ts` (to update `lockedEntities`) followed by `pnpm governance:lock` (with `tools/governance` active in `.governance-cache/active-governance-unlocks.json` to update the top-level `files` array) before running `pnpm governance:tamper-check`.
   - Whenever documentation files (`docs/19`, ADRs, architecture specs) are modified, always execute `pnpm docs:sync` before `pnpm ci:simulate` to ensure complete AST synchronization with `apps/docs`.
9. **Adversarial Gatekeeper & Zero Casual Approval Policy (Work Plan 100):**
   - AI agents must operate in Adversarial Gatekeeper Mode when touching protected files (`GEMINI.md`, `AGENTS.md`, `.agents/rules/**`, `.agents/skills/**`, `governance.lock.json`).
   - Casual approvals (`موافق`, `تمام`, `ok`, `yes`) in response to `/learn`, plans, or chat queries MUST NEVER be used as authorization to edit protected files.
   - Modifying protected entities strictly mandates the verbatim constitutional formula `«موافق على التعديل او الايقاف او الحذف»` or the dynamic OTP challenge-response protocol `«موافق على الفتح <UNLOCK-XXXXXX>»`.
10. **Zero-Network Development & Air-Gapped Local Invariant (Work Plan 102):**
    - Prohibits executing package installation commands (`pnpm install`, `pnpm add`, `npm install`) or container image build commands (`docker compose build`, `docker build`) during feature development or defect repair.
    - All testing and verification must execute 100% locally and air-gapped using `vitest`, `pnpm test`, `pnpm dev:bot`, and `pnpm ci:simulate` with zero network downloads (`prefer-offline=true`, `verify-deps-before-run=false`, and `supportedArchitectures` restricted to `win32`/`linux` `x64`).
    - Starting pre-built infrastructure containers (`pnpm docker:infra` / `docker compose up -d postgres redis`) is permitted; rebuilding application containers is strictly reserved for final production release.
11. **The Tri-Tier Test Pyramid & Anti-Slowness Invariant (Work Plan 104):**
    - Prohibits AI agents from running full monorepo test suites (`pnpm test`, `pnpm test:fast`, or `pnpm ci:simulate`) during the inner development loop.
    - AI agents must achieve < 2s feedback cycles during TDD by executing targeted test commands: `pnpm test:smart`, `pnpm test:target <path>`, or `pnpm test:changed`.
    - Static financial and accounting checks (Gate G12) must utilize in-memory verification (`memoryOnly: true`) for HMAC-SHA256 ledger integrity and balance equations unless financial models, accounting ledgers, or database schemas are explicitly modified.

---

## 2. Pre-Flight 10-Point Checklist

Before declaring any coding or refactoring task complete, every agent must verify:

| # | Checkpoint | Verification Command / Target |
| :-: | :--- | :--- |
| 1 | **Code Formatting & Clean Imports** | `pnpm preflight:fix` (Prettier & ESLint) |
| 2 | **Type Safety & Zero `any`** | `pnpm typecheck` |
| 3 | **10-File Slice Architecture** | `pnpm arch:verify` |
| 4 | **Flow & Telegram Contracts** | `pnpm flow-contracts:verify && pnpm telegram-contracts:verify` |
| 5 | **Targeted Vitest Suite** | `pnpm test:pre-commit` (or targeted test run) |
| 6 | **Cryptographic Tamper Check** | `pnpm governance:tamper-check` |
| 7 | **Zero Blast Radius Audit** | `git diff --stat` (only intended files modified) |
| 8 | **Git Hygiene & Version Parity** | `pnpm git-hygiene:verify` |
| 9 | **Docs Parity & Constitutional Links** | `pnpm docs:parity` |
| 10 | **Mandatory Entity Re-Locking** | `pnpm lock:verify` & confirmation: **«تم قفل الوظيفة [س]»** |

---

## 3. Self-Healing Formatting (`pnpm preflight:fix`)

If Prettier or ESLint detects stylistic divergences, trailing spaces, or unorganized imports:
- Run `pnpm preflight:fix` immediately to self-heal formatting automatically.
- Never prompt the user for trivial formatting corrections.

---

## 4. Binding Phase-by-Phase Protocol (بروتوكول المراحل الملزم — WP 94)

1. **Sequential Phase Discipline:** Agents must execute any task in strictly ordered phases (P0 to P5) matching the Tri-Lifecycle standard ([`WP-94`](../../docs/work-plans/94-plan-sovereign-tri-lifecycle-governance-and-ai-agent-invariant.md)).
2. **No Early Declarations:** Agents are strictly prohibited from declaring a task complete, skipping intermediate checkpoints, or assuming success without running physical verification commands for each phase.
3. **Phase Completion Deliverables:** Each phase must produce its verifiable artifacts (reports written, scripts compiled, tests executed, locks sealed) before advancing to the subsequent phase.
4. **Mandatory Final Simulation:** Every execution must culminate in a clean run of `pnpm ci:simulate` (running all quality gates and Vitest suites) before presenting final results.
5. **The 5 Report Cards Delivery:** Agents must deliver the structured 5-card completion report directly in chat prior to requesting merge.
6. **Strict Merge Approval:** Merging to `main` (`git merge --no-ff`) is strictly blocked until the sovereign user issues the verbatim formula: **«ادمج الفرع»**.

---

## 5. Sovereign Skill Graph & Permanent JEV Consultation Protocol (Work Plan 96)

1. **Pre-Task Consultation Gate (`pnpm jev:consult --plan <path>`):**
   Before authoring or modifying any feature, defect repair, or architectural task, the agent must consult JEV to evaluate the proposed work plan. Proceeding with a plan scoring below 90% readiness (`Plan Readiness < 90%`) is strictly prohibited.
2. **Sovereign Skill Graph Alignment (`pnpm skills:verify`):**
   All 11 project skills (`.agents/skills/`) are bound to the authoritative knowledge graph in `.agents/knowledge/sovereign-skill-graph.json`. The agent must run `pnpm skills:verify` to ensure zero orphan skills and bidirectional link integrity across Rulebooks 01–12 and Quality Gates G1–G23.
3. **Continuous Co-Auditor Calibration:**
   During development, the agent should run `pnpm jev --diff` to catch mobile viewport overflows and telemetry wiring defects early. Final sign-off requires `pnpm audit:saleh:boost` validating CGI v2.0 >= 90%.

