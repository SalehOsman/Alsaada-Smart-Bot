
# test-guard (Al-Saada Edition)

You are reviewing generated or changed test code before it ships. Enforce the rules below as a sovereign quality gate after test authoring. Eliminate test bloat, mock abuse, sham assertions, and tautological tests.

## 1. Project Context & Testing Infrastructure
- **Test Runner:** Vitest (`vitest run`).
- **Language:** TypeScript 5.x with pinned types.
- **Target Domains:** Bot conversational flows (`modules/*/tests/flows/`), core packages (`packages/*/tests/`), and governance tools (`tools/governance/tests/`).
- **Core Invariant:** **Gate G10 (Test Authenticity).** Zero tolerance for fake assertions (`expect(true).toBe(true)`), unasserted tests, or mocking business logic.

## 2. The Nine Universal Rules + 3 Al-Saada Bot Rules

### Rule 1: Test Behavior, Not Implementation
Test what code accomplishes from the caller's viewpoint. Assert return values, database state mutations, and emitted domain events. Never assert that an internal private helper was invoked with specific arguments — such tests break on internal refactoring while catching zero bugs.

### Rule 2: Every Mock Must Be Justified
Mock **only** at true external system boundaries:
- Outgoing Telegram Bot API HTTP calls (use grammY mock context or fake API adapter).
- External network requests (use MSW or simulated HTTP server).
- Clock and timers (use `vi.useFakeTimers()` or `PINNED_BASE_TIME`).
- Randomness (seed RNG).

**Forbidden Mocks:**
- Never mock internal repository classes, domain calculation helpers, or session engines in integration tests.
- Never mock Prisma client in repository integration tests — run against isolated test transactions or test database schema.

### Rule 3: One Scenario Per Test, Data-Driven For Variants
If two or more tests share identical setup and differ only in inputs and expected outputs, merge them using Vitest's `test.each`:
```typescript
test.each([
  { input: '29812010101234', expectedValid: true },
  { input: '12345678901234', expectedValid: false },
  { input: '', expectedValid: false },
])('validating national ID $input yields $expectedValid', ({ input, expectedValid }) => {
  expect(validateNationalId(input)).toBe(expectedValid);
});
```

### Rule 4: Every Test Must Justify Its Existence
Ask: *"What specific bug does this test catch that no other test catches?"*
Delete tests that:
- Re-verify TypeScript compiler guarantees (e.g. asserting that a typed string property is a string).
- Assert literal constant values (`expect(MAX_ROWS).toBe(7)`).
- Re-verify framework defaults without business logic.

### Rule 5: Name Tests for the Scenario
Format: `test('when <condition/scenario>, then <expected outcome>')`.
Names should read like executive business requirements, not function signature echoes.

### Rule 6: Production Regression Tests Are Sacred
Any test written to reproduce and prevent a production bug (Code Incident per GEMINI.md Section 7) is permanently locked under `test:<path>` in `governance.lock.json`. These tests must reference the incident date/ID and may never be deleted or weakened.

### Rule 7: No Tests for Framework Guarantees
Do not write tests proving that Prisma inserts a valid model or that grammY dispatches a callback query. Test the business logic and state transitions layered on top of the framework.

### Rule 8: State and Value Objects Are Real, Never Mocked
Never mock a domain entity, DTO, or session state. Construct a real instance using test factory helpers (e.g. `createTestWorker()`, `createTestSession()`). Mocking state masks field-name typos and validation regressions.

### Rule 9: Infrastructure Under Test Gets Real Infrastructure
When testing SQL queries, hash-chains, RLS policies, or transaction isolation, run against a real database connection. Mocking Prisma queries in persistence tests tests nothing.

### Rule 10: Bot Conversation Tests Test State Transitions
When testing a bot flow wizard, test the complete state transition:
`Initial Session + User Telegram Action -> New Session Step + Edited Message + Button Layout`.

### Rule 11: Pinned Deterministic Base Time
All time-dependent tests must pin `PINNED_BASE_TIME` (`2026-09-21T00:00:00.000Z`). Never rely on floating `new Date()` or `Date.now()`, which cause non-deterministic time-zone and clock drift.

### Rule 12: Anti-Cheating & Sham Assertion Guard (Gate G10)
Every test must contain concrete, non-tautological assertions on:
1. Return value / response shape.
2. Persisted database records.
3. Emitted events or state mutations.
Zero tests with zero `expect()` statements; zero tests asserting constant booleans.

## 3. Self-Check Checklist Before Delivery
1. Did every test execute and pass in the terminal with Exit Code 0?
2. Are all mocks justified at system boundaries?
3. Are domain entities instantiated as real objects?
4. Is `test.each` used for parameterized variants?
5. Are all assertions genuine and validating business outcomes?
