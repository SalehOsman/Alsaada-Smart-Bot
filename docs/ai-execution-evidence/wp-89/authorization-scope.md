# Work Plan 89 — Sovereign Authorization & Scoping Charter (Phase P0)

## 1. Executive Mandate & Strict Boundaries
In strict adherence to the explicit orders of the Sovereign Stakeholder (Saleh) on 2026-09-21:

> **«لا اريد نقل ال تدفق. اريد انشاء منهجية النقل على ان يكون المشروع مستعد تماما كنواه الى استقبال التدفقات باحترافيه كاملة. انما النقل سنبدء فيه تباعا»**

### Scope Classification:
- **STRICTLY IN SCOPE**:
  1. **Phase P1**: Contracts & TypeSafe Primitives (`module-v2.contract.ts`, `flow-v2.contract.ts`, `typesafe-primitives.contract.ts`).
  2. **Phase P2**: Automated Catalog Generation & CLI (`tools/modules/catalog.ts`, `generate-catalog.ts`, `cli.ts`).
  3. **Phase P3**: Bot Autodiscovery & TypeSafe Router (`catalog-adapter.ts`, `typesafe-flow-router.ts`).
  4. **Phase P4**: Admin Dashboard Dynamic Bridge (`module-catalog.ts`, generic pages/routes).
  5. **Phase P5**: DMMF AST Database Composition (`compose-database.ts`, `validate-migrations.ts`).
  6. **Phase P6**: Scaffolding Suite Upgrade (`scaffold-module-v2.ts`, `scaffold-flow-v2.ts`).
  7. **Phase P7**: Migration Testing Suite (`migration-runner.ts`).
  8. **Phase P8**: Backward Compatibility Bridges (`v1-adapter.ts`).
  9. **Phase P9**: Core Immutability Sentinel & LLM Guardrails (`verify-core-immutability.ts`, `typesafe-guardrails.ts`).
  10. **Phase P10**: Migration Constitution (`docs/module-migration-constitution.md`, standard cards).
  11. **Phase P11**: Proof of Concept Fixture (`modules/sample-domain` with flows `89.1` and `89.2`).

- **STRICTLY OUT OF SCOPE (PROHIBITED)**:
  - Migrating or authoring any of the 126 business flows from `F:\HR`.
  - Altering business logic in existing sealed flows (`modules/settings/*`, `modules/workforce/*`).
  - Touching existing locked files without formal human OTP unlock confirmation.

---

## 2. Permitted Files & Target Inventory
| Category | Permitted Directories / Files | Purpose |
| :--- | :--- | :--- |
| **New Contracts** | `packages/core-components/src/contracts/` | Universal V2 Module, Flow, and TypeSafe primitives |
| **Catalog Tools** | `tools/modules/` | AST scanner, catalog builder, determinism validators |
| **Generated Output**| `.generated/catalog/` | Artifacts produced exclusively by generators (gitignored/checked) |
| **Module Bus** | `packages/core-components/src/module-bus/` | Dynamic autoloader, TypeSafe router |
| **Test Fixture** | `modules/sample-domain/` | Isolated proof-of-concept module and flows |
| **Governance Evidence**| `docs/ai-execution-evidence/wp-89/` | Physical proofs, matrices, and audit receipts |
| **Migration SSOT** | `docs/module-migration-constitution.md` | Formal operational standard for subsequent flow migration |

---

## 3. Immutability & Anti-Regression Invariant
All core modifications will be completed and verified under automated test suites. Once Phase P9 is reached, the core baseline will be sealed in `governance.lock.json`, guaranteeing that all subsequent flow migrations can be plugged in seamlessly with **Zero Core Modifications**.
