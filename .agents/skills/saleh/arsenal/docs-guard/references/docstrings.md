# TSDoc and Docstring Standards

## 1. When a Docstring Is Justified
TypeScript's type system handles types, parameter counts, and nullability. A TSDoc comment is justified only when it conveys contracts the type system cannot express:
- Invariants (e.g., "Amount must be a positive integer in piasters").
- Side effects (e.g., "Dispatches an outbox event and invalidates Redis cache").
- Concurrency contracts (e.g., "Must be called within an active Prisma transaction").
- Constitutional Quality Gate requirements (e.g., "Enforces Gate G8 salary masking").

## 2. Paraphrasing Prohibition
Never write docstrings that simply parrot the function signature:
```typescript
// ❌ Bad: Redundant docstring
/**
 * Calculates net salary for a worker.
 * @param workerId The worker ID.
 * @param month The month.
 */
function calculateNetSalary(workerId: string, month: number) {}

// ✅ Good: Invariant & contract documentation
/**
 * Computes monthly net compensation after Egyptian social insurance (Law 148/2019)
 * and active advance deductions. Guarantees double-entry ledger balance.
 *
 * @throws {InsufficientCustodyError} If project custody is depleted.
 */
function calculateNetSalary(workerId: string, month: number) {}
```
