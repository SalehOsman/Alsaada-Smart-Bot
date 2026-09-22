# Core Change Request (CCR): [CCR-ID]

> **Status:** `[PENDING_REVIEW | APPROVED | REJECTED | EXECUTED]`  
> **Target Core Component:** `[apps/bot-server | apps/admin-dashboard | packages/database | packages/core-components | tools/governance]`  
> **Requester:** `[Squad / Engineer / AI Agent]`  
> **Date:** `[YYYY-MM-DD]`  

---

## 1. Executive Justification & Problem Statement

### Why is a Core Modification strictly necessary?
> Explain why this requirement CANNOT be accomplished within an autonomous module under `modules/` using pluggable adapters, dynamic routes, or DMMF AST schema extensions.

---

## 2. Blast Radius & Impact Assessment

| Subsystem | Impact Level | Description of Changes |
|---|---|---|
| **Core Bot Engine (`apps/bot-server`)** | `[None / Low / High / Critical]` | |
| **Admin Cockpit (`apps/admin-dashboard`)** | `[None / Low / High / Critical]` | |
| **Prisma Core Schema (`packages/database`)** | `[None / Low / High / Critical]` | |
| **Shared Primitives (`packages/core-components`)** | `[None / Low / High / Critical]` | |
| **Governance Engine (`tools/governance`)** | `[None / Low / High / Critical]` | |

### Breaking Change Analysis
- Will this change affect existing locked modules? `[Yes / No]`
- Are database migrations backward-compatible and reversible (G20)? `[Yes / No]`
- Does this change require updating the 64-char SHA-256 Core Hash? `[Yes / No]`

---

## 3. Alternative Solutions Considered

1. **Alternative A (Modular Extension):** Why was this ruled out?
2. **Alternative B (Adapter / Middleware):** Why was this ruled out?

---

## 4. Cryptographic Nonce & Approval Protocol

Under **Work Plan 90** and `GEMINI.md`, core modifications require a dynamic single-use OTP challenge-response nonce issued by the Unified Lock Engine:

1. **Unlock Request Command:**
   ```bash
   pnpm unlock:request [target-entity] --reason="[Exhaustive Justification]"
   ```
2. **Generated OTP Nonce:** `UNLOCK-XXXXXX` (Strict 300s TTL)
3. **Saleh Chat Authorization Formula:**
   > **«موافق على الفتح <UNLOCK-XXXXXX>»** or **«نعم موافق على التعديل <UNLOCK-XXXXXX>»**
4. **Forensic Provenance Verification:**
   ```bash
   pnpm unlock:confirm [target-entity]
   ```

---

## 5. Verification & Rollback Plan

- **Targeted Test Suite:** `[Command to execute related tests]`
- **Monorepo Build Verification:** `pnpm build`
- **Core Immutability Re-fingerprinting:** Update core hash post-approval
- **Rollback Strategy:** Git revert command if regression detected
