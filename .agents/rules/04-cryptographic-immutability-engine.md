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

---

## 4. Pre-Commit Tamper Enforcement (`governance:tamper-check`)

The pre-commit hook runs `pnpm governance:tamper-check` on every commit:
1. It compares all protected governance files against `governance.lock.json`.
2. It verifies that no locked entity has experienced unauthorized tampering or file injection.
3. If any modification is detected without an active unlock or updated lockfile, the commit is aborted immediately.
