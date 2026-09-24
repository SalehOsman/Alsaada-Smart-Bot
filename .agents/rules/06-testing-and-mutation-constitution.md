# Domain Rulebook 06: Testing & Mutation Constitution

> **Authority:** Derived from [`GEMINI.md`](../../GEMINI.md) Part 10 & [`docs/27`](../../docs/27-enterprise-ai-governance-and-quality-gates-constitution.md) (G10, G23).  
> **Status:** Mandatory Quality & Testing Standard.

---

## 1. Test Authenticity & Anti-Sham Standard (G10)

1. **Zero Sham Assertions:** Every test must evaluate concrete business outcomes. The following anti-patterns are strictly blocked by `pnpm test-authenticity:verify`:
   - `expect(true).toBe(true)`
   - `expect(result).toBeDefined()` without deep property verification.
   - Assertions lacking negative contrast (must assert both positive status and expected failure modes).
2. **Deterministic Time (`PINNED_BASE_TIME`):**
   - Direct calls to `Date.now()` or `new Date()` inside assertions or mocks are prohibited.
   - Always import and use `PINNED_BASE_TIME` from test helpers to eliminate timezone and execution-time flakiness.

---

## 2. Invariant Test Lock & The Two-Key Exception

1. **Invariant Test Immunity:** Modifying or deleting existing test assertions to make a failing suite pass is considered a **critical defect masking incident**.
2. **Two-Key Confirmation Exception:** Existing tests may only be modified if ALL of the following conditions are met:
   - A formal specification change has been ordered by the user.
   - A 5-Pillar RCA proves that the existing test asserts obsolete behavior.
   - The user has provided explicit two-key confirmation to alter the test specification.

---

## 3. High-Fidelity Test Structure

Every test file must follow the standard Arrange-Act-Assert structure:
```typescript
describe('Feature / Slice Name', () => {
  it('describes expected behavior clearly', async () => {
    // 1. Arrange: Setup deterministic state and inputs
    const ctx = createTestBotContext({ ... });

    // 2. Act: Execute flow controller or service
    const result = await controller.handle(ctx);

    // 3. Assert: Verify outcome, state transition, and side-effects
    expect(result.status).toBe('SUCCESS');
    expect(result.payload.id).toBeDefined();
    expect(result.status).not.toBe('FAILED');
  });
});
```

---

## 4. Mutation Testing & Anti-Flake Verification (G23)

1. **Mutation Resilience:** Tests must survive mutation analysis (Stryker/Vitest mutation scans). If a boundary operator (e.g., `<` to `<=`) is altered, the test suite must fail.
2. **Concurrency & Race Conditions:** Concurrent operations must be tested using `Promise.all` with deterministic race scenarios to prove thread and transaction isolation.

---

## 5. Tri-Tier Test Pyramid & Execution SLA (Work Plan 104)

To preserve maximum engineering velocity without compromising constitutional rigor, all testing must strictly adhere to the **Tri-Tier Test Pyramid**:

1. **Level 1: Inner Development Loop (< 2s SLA):**
   - AI agents are **strictly forbidden** from executing the full test suite (`pnpm test` or `pnpm ci:simulate`) during internal TDD iterations or debugging.
   - Inner-loop verification must exclusively use the targeted smart runner:
     - `pnpm test:smart`: Automatically infers the active scope (flow, module, package, or affected files).
     - `pnpm test:target <path>`: Directly tests a specific file or directory.
     - `pnpm test:changed`: Tests files modified in the active git working tree.
     - `pnpm test:modules <name>` / `pnpm test:packages <name>`: Scoped subsystem execution.
     - `pnpm test:governance`: Tests governance and verification tools.
2. **Level 2: Fast Pre-Commit Gate (< 6s SLA, Target ~2.5s):**
   - Executed automatically by `.githooks/pre-commit` via `pnpm pre-commit:fast`.
   - Concurrently verifies 12 static governance gates in-process via `Promise.all` alongside incremental typechecking (`tsc --incremental`) and smart blast-radius related tests.
   - Never spawns sequential child processes for static gates.
3. **Level 3: Full Monorepo Pre-Merge Simulation:**
   - Full monorepo CI simulation (`pnpm ci:simulate`) is strictly reserved for the final pre-merge gate after all tasks are completed and verified on the isolated branch.

