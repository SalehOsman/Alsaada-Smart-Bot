# DRY, KISS, and YAGNI Guidelines

## 1. Don't Repeat Yourself (DRY)
- **Knowledge Duplication vs Text Duplication:** DRY applies to knowledge and business rules, not incidental syntax similarity.
  - Two functions that format text similarly but represent different domain requirements (e.g. advance receipt vs salary slip) should NOT be prematurely merged if their lifecycles diverge.
  - A calculation formula (e.g. social insurance deduction rate) must exist in exactly ONE canonical place (`@alsaada/regional-engine`).

## 2. Sandi Metz's Rule: The Wrong Abstraction
> "Duplication is far cheaper than the wrong abstraction."
- If an abstraction requires multiple conditional branches (`if (options.isAdvance) ... else if (options.isCustody) ...`), it is the wrong abstraction.
- Re-inline the code into the distinct callers and let the true abstraction emerge naturally when patterns stabilize.

## 3. Keep It Simple, Stupid (KISS)
- **McCabe Cyclomatic Complexity Ceiling:** Target ≤ 10 per function.
- **Nesting Ceiling:** Maximum 4 levels of indentation. Replace deep `if/else` ladders with early returns:
  ```typescript
  // ❌ Deep nesting
  if (user) {
    if (user.isActive) {
      if (hasPermission) {
        // do work
      }
    }
  }

  // ✅ Early returns
  if (!user) return rejectUnauthorized();
  if (!user.isActive) return rejectInactiveAccount();
  if (!hasPermission) return rejectForbidden();
  // do work
  ```

## 4. You Aren't Gonna Need It (YAGNI)
- Do not create abstract base classes or generic wrappers for a single implementation.
- Do not add optional configuration toggles or environment variables for features that are not currently specified in the active Work Plan.
- Strip dead code, commented-out experiments, and placeholder methods immediately.
