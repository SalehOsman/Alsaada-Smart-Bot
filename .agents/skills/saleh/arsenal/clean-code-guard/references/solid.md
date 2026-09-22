# SOLID Principles in Al-Saada Smart Bot

## 1. Single Responsibility Principle (SRP)
- *Definition:* A class, module, or function should have one, and only one, reason to change (i.e. answerable to one stakeholder group).
- *Al-Saada Application:*
  - `flow.controller.ts`: Handles Telegram routing and session state transitions.
  - `flow.service.ts`: Executes business domain logic and database transactions.
  - `flow.messages.ts`: Generates user-facing localized Telegram text.
  - `flow.keyboard.ts`: Builds ergonomic inline keyboards.
  - Never let database query logic leak into message builders or keyboard layouts.

## 2. Open-Closed Principle (OCP)
- *Definition:* Software entities should be open for extension, but closed for modification.
- *Al-Saada Application:*
  - Use strategy patterns or step registries for multi-step conversational flows rather than growing giant `switch (ctx.session.step)` blocks.
  - When adding new flow steps or financial transaction types, register new handlers without modifying existing tested handlers.

## 3. Liskov Substitution Principle (LSP)
- *Definition:* Subtypes must be substitutable for their base types without altering program correctness.
- *Al-Saada Application:*
  - Repository interfaces (e.g. `WorkerRepository`) implemented by Prisma or mock implementations must fulfill all contract invariants (e.g., throwing `NotFoundError` consistently, preserving nullability).
  - Overrides must not strengthen preconditions or weaken postconditions.

## 4. Interface Segregation Principle (ISP)
- *Definition:* Clients should not be forced to depend upon interfaces that they do not use.
- *Al-Saada Application:*
  - Break down large repository interfaces into focused interfaces (e.g. `WorkerReader`, `WorkerWriter`, `WorkerAuditor`) when callers only require a slice of functionality.
  - In flow validators, accept only the necessary subset of session fields instead of the entire global session object.

## 5. Dependency Inversion Principle (DIP)
- *Definition:* High-level modules should not depend on low-level modules; both should depend on abstractions.
- *Al-Saada Application:*
  - Flow handlers and services depend on repository interfaces defined in `@alsaada/core-components` or shared domain packages, not directly on concrete Prisma client instances.
  - Inject dependencies via constructor or factory functions to guarantee testability and modular isolation.
