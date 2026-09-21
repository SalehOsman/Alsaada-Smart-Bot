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
