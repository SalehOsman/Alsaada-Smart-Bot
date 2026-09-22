# Clean Code Guard Review Checklist (/boost Mode)

Use this checklist during deep forensic code review under `/saleh` and `/boost`.

## 1. Naming & Function Design
- [ ] Are all variables, functions, and classes named with specific domain terminology?
- [ ] Are generic names (`data`, `item`, `temp`, `obj`, `res`) absent?
- [ ] Are functions ≤ 20 lines of code with a single level of abstraction?
- [ ] Do functions have ≤ 4 arguments? (Typed options object used for 5+).
- [ ] Is Command-Query Separation strictly followed?

## 2. SOLID & Architecture Invariants
- [ ] Is the 10-file vertical slice standard respected in bot flows?
- [ ] Are controller, service, presentation, and keyboard logic properly separated?
- [ ] Are dependencies injected via interfaces rather than coupled to concrete Prisma clients?
- [ ] Are there zero cross-module direct imports bypassing the module bus?

## 3. Error Handling & Reliability
- [ ] Are there zero empty catch blocks or swallowed errors?
- [ ] Is error logging performed using `@alsaada/shared/logger` instead of `console.error`?
- [ ] Are external inputs deserialized and validated with Zod at system boundaries?
- [ ] Are financial operations protected by Prisma `$transaction` and idempotency keys?

## 4. Telegram Ergonomics & Gate G8
- [ ] Is all user-facing copy in `flow.messages.ts` using the Unified Presentation Library?
- [ ] Are raw string replies (`ctx.reply("...")`) absent?
- [ ] Are sensitive financial numbers wrapped in spoiler formatting (`formatSpoiler`)?
- [ ] Is `protect_content: true` configured on sensitive compensation cards?
- [ ] Are button labels ≤ 16-32 characters and callback data ≤ 36 bytes?

## 5. Clean Tree & Anti-Bloat
- [ ] Is commented-out code completely removed?
- [ ] Are all imports utilized with zero dead exports?
- [ ] Is cyclomatic complexity ≤ 10 and indentation depth ≤ 4?
