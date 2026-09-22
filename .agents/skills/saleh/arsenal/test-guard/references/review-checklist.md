# Test Guard Review Checklist (/boost Mode)

Use this checklist during deep forensic test review under `/saleh` and `/boost`.

## 1. Anti-Mocking & Authenticity
- [ ] Are mocks strictly restricted to external system boundaries (Telegram Bot API HTTP calls, clock, external services)?
- [ ] Are internal repository classes, domain models, or calculation helpers tested for real without mocking?
- [ ] Are there zero `expect(true).toBe(true)` or empty assertion test blocks?
- [ ] Do all assertions check actual business state mutations or database records?

## 2. Test Architecture & Coverage
- [ ] Is `test.each` used for parameterized variants instead of repetitive copy-pasted test blocks?
- [ ] Are state and value objects created using real constructors / factories?
- [ ] Are time-dependent tests using `PINNED_BASE_TIME` or fake timers?
- [ ] Are production regression tests preserved with incident references?

## 3. Bot Flow Invariants
- [ ] Do conversational flow integration tests verify in-place message editing?
- [ ] Is RBAC role access validated across all authorized and unauthorized roles?
- [ ] Do tests verify error states, cancellation callbacks, and invalid input rejection?
