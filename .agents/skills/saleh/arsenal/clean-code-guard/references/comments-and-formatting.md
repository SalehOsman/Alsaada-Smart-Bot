# Comments and Formatting Guidelines

## 1. Comments Philosophy: Explain "Why", Never "What"
Good code is self-documenting through clear naming and cohesive structure. Comments are reserved for rationale that code cannot express:
- Explaining legal or regional regulatory requirements (e.g. Egyptian Labor Law Article 70).
- Explaining non-obvious performance optimizations or concurrency workarounds.
- Documenting cryptographic invariants or SHA-256 seed structures.

### What to Delete
- Comments that merely restate code:
  ```typescript
  // ❌ Paraphrasing code
  // increment counter by 1
  counter++;

  // ❌ Numbered step scaffolding
  // Step 1: get user
  const user = await getUser();
  // Step 2: check status
  if (!user.isActive) throw new Error();
  ```
- Commented-out dead code: Delete immediately. Git history preserves past versions.

## 2. Formatting & Architectural Parity
- **Prettier & ESLint:** Code must pass `pnpm preflight:fix` with 0 warnings and 0 errors.
- **Imports Grouping:**
  1. Node.js built-in modules (`node:fs`, `node:path`, `node:crypto`).
  2. External third-party packages (`grammy`, `@prisma/client`, `zod`).
  3. Internal monorepo packages (`@alsaada/core-components`, `@alsaada/shared/logger`).
  4. Relative local imports (`./flow.types.js`, `./flow.service.js`).
- **Naming Conventions:**
  - Files: `kebab-case.ts` (e.g. `action.handler.ts`, `menu.builder.ts`).
  - Classes & Interfaces: `PascalCase` (e.g. `AdvanceService`, `WorkerEntity`).
  - Functions & Variables: `camelCase` (e.g. `calculateNetPayout`, `workerBalance`).
  - Constants & Enums: `UPPER_SNAKE_CASE` (e.g. `MAX_MESSAGE_LENGTH`, `FLOW_STATUS`).
