
# clean-code-guard (Al-Saada Edition)

You are reviewing generated or changed TypeScript code across `modules/`, `packages/`, and `apps/` before it ships. Apply the rules below as a sovereign guard pass after implementation. Once activated, maintain this standard across every code modification.

## 1. Project Context & Ecosystem
- **Runtime & Language:** Node.js 24+, ECMAScript Modules (`"type": "module"`), Strict TypeScript 5.x (`strict: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: true`).
- **Frameworks:** grammY (Telegram Bot API), Prisma ORM (PostgreSQL), Redis (bullmq/session store).
- **Architecture Invariants:** 10-File Vertical Slice (`modules/*/src/flows/`), Unified Presentation Library (`@alsaada/core-components/formatting`), Domain Event Bus (`@alsaada/core-components/module-bus`), Zero `console.log` (`@alsaada/shared/logger`).
- **Exclusions:** Excludes PHP, WordPress, Python, and WooCommerce legacy patterns. All code must conform to modern sovereign TypeScript standards.

## 2. The Three Operating Modes
1. **Guard-Pass Mode (Default):** After code is written or modified, audit the diff or target files against the 24 Imperatives below. Fix violations before presenting or committing.
2. **Review Mode:** When triggered via `/saleh` or `/boost`, walk `references/review-checklist.md` against target files and produce a structured findings report with line numbers and severity.
3. **Live Mode:** Apply the rules interactively during code generation, executing self-check before final presentation.

## 3. The 24 Always-Applied Imperatives

### A. Functions and Naming (Clean Code Ch. 2–3)
1. **Names Reveal Intent:** Never use generic names like `data`, `data2`, `result`, `result_final`, `item`, `temp`, `value`, `obj`, `info`, `helper`, `manager`, `utils`, or `handle_*`/`process_*`/`do_*` without domain qualifiers. Name should state *why it exists and what it does*.
2. **Small Functions:** Target ≤20 lines, one level of abstraction, single responsibility. If a function requires comments explaining "steps", extract dedicated private helpers.
3. **Four Arguments Ceiling:** At 5 arguments, refactor to a typed options object / DTO interface. Never use boolean flag parameters (`doAction(true)`) — split into two distinct functions (`activateAction()`, `deactivateAction()`).
4. **Command-Query Separation (CQS):** A function either mutates state or returns a computation, never both without explicit architectural justification. Command functions use verbs (`calculateAndPersistLedger`); query functions use nouns/getters (`getWorkerBalance`).

### B. Comments and Formatting (Clean Code Ch. 4)
5. **Comments Explain "Why", Never "What":** Delete comments that paraphrase the line of code. Delete numbered scaffolding comments (`// Step 1: validate`). Delete commented-out dead code — git history preserves past states.
6. **Architectural Parity:** Match existing module structure. Observe casing (camelCase for variables/functions, PascalCase for classes/types/interfaces, kebab-case for files). Adhere strictly to the 10-file vertical slice standard.

### C. SOLID Principles in TypeScript
7. **Single Responsibility (SRP):** One actor / stakeholder group per module. Financial calculation logic, Telegram presentation formatting, and database queries must never mix in a single file.
8. **Open-Closed Principle (OCP):** Extend via new handlers, registries, or strategy objects, not by adding endless `switch/case` or `else if` ladders in existing controllers.
9. **Liskov Substitution (LSP):** Never override a method to throw `Error('Not implemented')` or weaken type contracts.
10. **Interface Segregation (ISP):** Prefer small, client-specific interfaces. Do not force classes to implement massive monolithic interfaces.
11. **Dependency Inversion (DIP):** Depend on abstractions. Flow services interact with repositories through domain interfaces, never tightly coupled to raw database drivers.

### D. DRY, KISS, YAGNI
12. **Duplicate Knowledge vs Duplicate Text:** Don't unify code that looks similar by coincidence if the underlying business rules evolve independently. Unify identical business rules across code, docs, and validation schemas.
13. **Wrong Abstraction is Worse Than Duplication:** If an abstraction requires multiple caller-specific flags, inline it back and refactor cleanly.
14. **Complexity Ceiling:** Cyclomatic complexity ≤ 10, nesting depth ≤ 4. Refactor deeply nested callbacks into early returns or pipeline methods.
15. **Zero Speculative Code (YAGNI):** No unused flags, no speculative `enable_*` toggles, no `*_v2` dead code. If it doesn't have a present-day caller, delete it.

### E. AI-Specific Failure Modes (The Critical Guardrails)
16. **Never Swallow Errors with Broad Catch-All:** Never use empty `catch {}` blocks or `catch (err) { return ok; }`. Catch specific domain errors or log with `@alsaada/shared/logger` and rethrow.
17. **Guard the Trust Boundary; Trust the Contract:** Validate untrusted external data (Telegram callback payloads, HTTP bodies, CSV uploads) with Zod at the boundary. Inside the application core, trust TypeScript types; avoid redundant defensive null-checks where types guarantee non-null.
18. **Zero API Hallucinations:** Confirm method names and signatures against Prisma schema, grammY API types, and `@alsaada/*` packages. Never invent convenience methods.
19. **No Hardcoded "Success" Fixtures in Production:** Never return `{ status: 'success' }` or canned mock data in production service or repository methods. If logic is pending, throw a descriptive domain error.
20. **Zero Presentation Library Bypass:** In bot flows, never call `ctx.reply("raw string")` directly. All messages must route through `flow.messages.ts` and `@alsaada/core-components/formatting` with mandatory breadcrumbs and formatters.
21. **Mandatory Sensitive Data Masking (Gate G8):** All financial amounts, salaries, worker wages, and national IDs must be masked with spoiler formatting (`formatSpoiler` / `<tg-spoiler>`) and `protect_content: true`.
22. **Transaction & Idempotency Integrity:** Financial mutations, ledger balancing, and worker balance updates must execute inside Prisma `$transaction` and verify `idempotencyKey`.
23. **Strip Dead Exports & Unused Imports:** Remove dead branches, unused variables, and orphaned exports before delivery.
24. **Behavior Preservation in Refactoring:** Refactoring changes internal structure without changing observable behavior. Bug fixes and refactorings must be separate commits.

## 4. Self-Check Before Delivery
1. Did I check all 24 imperatives against the git diff?
2. Are all variable and function names domain-specific and descriptive?
3. Are error handlers specific with zero silent swallowed exceptions?
4. Is all bot output using `flow.messages.ts` and presentation formatters?
5. Are all sensitive numbers masked with spoilers and protected content?
6. Are financial operations transactional and idempotent?

---

## 5. References
- [`references/ai-failure-modes.md`](references/ai-failure-modes.md) — The 14 systematic LLM coding failure modes.
- [`references/naming-and-functions.md`](references/naming-and-functions.md) — Clean Code naming and function rules.
- [`references/solid.md`](references/solid.md) — SOLID principles in enterprise TypeScript.
- [`references/dry-kiss-yagni.md`](references/dry-kiss-yagni.md) — Duplication vs wrong abstraction.
- [`references/comments-and-formatting.md`](references/comments-and-formatting.md) — Clean commenting and formatting rules.
- [`references/review-checklist.md`](references/review-checklist.md) — Review checklist for `/boost` mode.
- [`references/sources.md`](references/sources.md) — Research and foundational citations.
