# Domain Rulebook 04: Cryptographic Immutability Engine & Lock Governance

> **Authority:** Derived from [`GEMINI.md`](../../GEMINI.md) Part 6, [`tools/governance/unified-lock-engine.ts`](../../tools/governance/unified-lock-engine.ts), and [`governance.lock.json`](../../governance.lock.json).  
> **Status:** Mandatory Security & Integrity Guard (G13).

---

## 1. The Unified Lock Engine (`tools/governance/unified-lock-engine.ts`)

1. **Cryptographic Protection:** All completed entities—including core packages, bot flows, dashboard screens, infrastructure configurations, and regression tests—are sealed cryptographically.
2. **SHA-256 Ledger:** File hashes are recorded in `governance.lock.json` with CRLF/LF line-ending normalization (`sha256NormalizedFile`).
3. **Zero Blast Radius:** Locking or unlocking an individual entity operates strictly on that entity and never affects or invalidates sibling locked components.

---

## 2. Standard Entity Identifiers

All protected entities use canonical prefixes:
- `package:<package-name>`: Core packages under `packages/` (e.g., `package:database`, `package:shared`).
- `flow:<flowKey>`: Individual bot flows (e.g., `flow:00.1`, `flow:01.2`).
- `dashboard:<featureId>`: Admin dashboard pages and components (e.g., `dashboard:overview`, `dashboard:users`).
- `infra:<subsystem>`: System infrastructure (e.g., `infra:docker`, `infra:speed-engine`).
- `module:<moduleName>`: High-level bot domain modules under `modules/`.
- `test:<testPath>`: Dedicated regression and security test suites.

---

## 3. Mandatory Untranslated Sovereign Formulas

Modifications to locked entities are strictly governed by immutable Arabic approval tokens:

### 3.1 Lock Authorization
To cryptographically seal an entity:
> **«نعم اقفل»**
CLI: `pnpm lock <target>`

### 3.2 Unlock Authorization
To temporarily unlock an entity for authorized modifications:
> **«موافق على الفتح»** or **«نعم موافق على التعديل»**
CLI: `pnpm unlock <target> --phrase="موافق على الفتح" --reason="..."`

### 3.3 Universal Governance Bypass
To modify master constitutional documents, root configurations, or database migration reversibility:
> **«موافق على التعديل او الايقاف او الحذف»**

### 3.4 Strict Prohibition of Agent Self-Authorization (حظر الترخيص الذاتي)
- **Absolute Ban:** AI agents are strictly forbidden from generating, authoring, or simulating approval formulas inside evidence documents, test files, scratchpads, or commit messages.
- **Direct Human Origin:** Approval formulas must originate exclusively and verbatim from the human user's direct chat input.
- **Procedural Fraud:** Any evidence file or tool invocation containing a self-generated approval token without a corresponding human chat message is classified as procedural fraud, causing an immediate task rejection (`[REJECT]`).

---

## 4. Pre-Commit Tamper Enforcement (`governance:tamper-check`)

The pre-commit hook runs `pnpm governance:tamper-check` on every commit:
1. It compares all protected governance files against `governance.lock.json`.
2. It verifies that no locked entity has experienced unauthorized tampering or file injection.
3. If any modification is detected without an active unlock or updated lockfile, the commit is aborted immediately.

---

## 5. Mandatory Pre-Edit Lock Inspection (الفحص المسبق قبل التعديل)
1. **Pre-Edit Verification:** Before calling any write or edit tool (`replace_file_content`, `write_to_file`), the agent must verify whether the target file belongs to an active locked entity in `governance.lock.json`.
2. **Immediate Stop & Prompt:** If the target file is locked, the agent must NOT attempt direct file modification. Instead, the agent must immediately stop, present the locked entity ID, and request the exact approval formula:
   `pnpm unlock <target> --phrase="موافق على الفتح" --reason="..."`

---

## 6. Automated Versioning & Changeset Atomic Lock Invariant

1. **Atomic Multi-Package Bump Cascade:** Whenever automated release tools (such as `@changesets/cli` via `pnpm version-packages`) bump workspace packages or generate `CHANGELOG.md` files:
   - **Root & Telemetry Sync:** The version bump MUST atomically update root `package.json` `"version"` and `packages/telemetry/src/version.ts` `PLATFORM_VERSION` via `tools/release/sync-root-version.ts`.
   - **Atomic Lock Re-Sealing:** All touched packages and their newly generated changelogs must be immediately re-sealed in `governance.lock.json` (`pnpm lock --all` and `pnpm governance:lock "موافق على التعديل او الايقاف او الحذف"`).
2. **Zero Tamper Guarantee:** Modifying package versions or adding changelogs outside this atomic synchronizer violates Gate 13 (Tamper Guard) and Gate 17 (Git Hygiene & Version Parity) and is rejected immediately at pre-commit.

