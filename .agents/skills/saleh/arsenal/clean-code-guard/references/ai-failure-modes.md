# The 14 AI Failure Modes in Enterprise TypeScript

LLM-assisted coding agents exhibit specific, systematic failure patterns that traditional linters often miss. This document catalogues these 14 failure modes, their detection patterns in Al-Saada Smart Bot, and the required remedy.

---

### Failure Mode 1: The Catch-All Error Swallower
- **Smell:** Wrapping complex asynchronous operations in `try { ... } catch (err) { return null; }` or empty `catch {}`.
- **Al-Saada Risk:** Silently hides database deadlocks, Redis timeouts, or financial balance discrepancies.
- **Remedy:** Catch explicit custom error classes (e.g. `InsufficientFundsError`, `EntityNotFoundError`). If unexpected, log via `@alsaada/shared/logger` with correlation ID and rethrow.

### Failure Mode 2: The Hallucinated API / Convenience Method
- **Smell:** Calling helper methods that sound plausible but don't exist on the library (e.g. `prisma.worker.upsertAndBalance(...)` or `ctx.replyWithButtonGrid(...)`).
- **Remedy:** Verify against physical types (`index.d.ts` or source export). Always import from canonical packages.

### Failure Mode 3: The Green Mirage / Hardcoded Success
- **Smell:** A function whose implementation is supposed to calculate complex accounting returning `{ ok: true, balance: 1500 }` directly.
- **Remedy:** Real calculations using double-entry ledger invariants. Throw `UnimplementedError` if work is pending.

### Failure Mode 4: The Presentation Layer Bypass
- **Smell:** Calling `ctx.reply("تم حفظ البيانات بنجاح")` or `ctx.editMessageText("...")` with raw strings.
- **Remedy:** Move all text to `flow.messages.ts`. Use `formatBreadcrumbs()`, `formatSpoiler()`, and Unified Presentation Library formatters.

### Failure Mode 5: Mock Abuse & Sham Unit Isolation
- **Smell:** Mocking Prisma client, domain entities, or internal repositories in unit tests so thoroughly that the test only asserts the mock was called.
- **Remedy:** Test against real test transactions or test database containers. Assert state changes and database rows, not mock call counts.

### Failure Mode 6: Blind Copy-Paste Semantic Drift
- **Smell:** Copying a flow from another domain (e.g., advances) to implement another (e.g., custody settlement) and leaving mismatched status enums or calculation rules.
- **Remedy:** Re-derive the flow from the `F:\HR` parity specification and domain rulebook.

### Failure Mode 7: The Unsafe Any & Type Erasure
- **Smell:** Using `as any`, `(msg as any).data`, or non-null assertions `!` to silence TypeScript compiler errors.
- **Remedy:** Use Zod schemas or TypeScript type guards (`isRecord(val)`) to safely narrow types at runtime.

### Failure Mode 8: Missing Transaction & Race Condition Blindness
- **Smell:** Performing balance checks in one query, then debiting in a separate query outside of a Prisma transaction.
- **Remedy:** Wrap state-modifying multi-table operations in `prisma.$transaction(async (tx) => { ... })` and enforce `idempotencyKey`.

### Failure Mode 9: Defensive Over-Checking Inside Core Boundaries
- **Smell:** Checking `if (worker && worker.id && worker.name)` in core internal methods when the parameter type is strictly `WorkerEntity`.
- **Remedy:** Validate at the outer boundary (controller/handler via Zod). Inside the core domain, trust the strong types.

### Failure Mode 10: Speculative Abstraction & Future-Proofing Bloat
- **Smell:** Adding abstract factories, `enableV2Feature` flags, and generic plugin systems for simple CRUD actions.
- **Remedy:** YAGNI. Write the direct, clean implementation. Abstract only when 2+ distinct present-day callers require it.

### Failure Mode 11: Leaking Sensitive Financial Data (Gate G8)
- **Smell:** Displaying net salaries, wages, or worker national IDs in plain text in Telegram chats.
- **Remedy:** Format with `formatSpoiler()` and set `protect_content: true` to prevent screen grabbing and chat forwarding.

### Failure Mode 12: Mobile Viewport Keyboard Overflows (Rule 07)
- **Smell:** Inline keyboard buttons with labels longer than 16-32 characters, or callback data exceeding 36-64 bytes.
- **Remedy:** Adhere to the 36/16/7/3 Telegram ergonomics budget.

### Failure Mode 13: Dead Code & Orphaned Exports
- **Smell:** Functions and constants exported from files that are never imported anywhere in the monorepo.
- **Remedy:** Strip unused exports and run dead code pruning before delivery.

### Failure Mode 14: Silent Test Refactoring / Weakening
- **Smell:** Modifying an existing test suite or deleting assertions when code fails, rather than fixing the underlying source code defect.
- **Remedy:** Invariant Test Lock (Constitution Section 10). Never touch existing tests without explicit two-key authorization.
