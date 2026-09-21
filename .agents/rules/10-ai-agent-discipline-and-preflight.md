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

---

## 2. Pre-Flight 7-Point Checklist

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

---

## 3. Self-Healing Formatting (`pnpm preflight:fix`)

If Prettier or ESLint detects stylistic divergences, trailing spaces, or unorganized imports:
- Run `pnpm preflight:fix` immediately to self-heal formatting automatically.
- Never prompt the user for trivial formatting corrections.
