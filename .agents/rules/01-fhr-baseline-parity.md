# Domain Rulebook 01: F:\HR Baseline Parity & Zero Divergence Standard

> **Authority:** Derived from [`GEMINI.md`](../../GEMINI.md) Part 2 & [`docs/00-baseline-and-ssot-charter.md`](../../docs/archive/governance-v1-ar/00-baseline-and-ssot-charter.ar.md).  
> **Status:** Mandatory Enterprise Standard (G3, G11).

---

## 1. Primary Functional Baseline (`F:\HR`)

1. **The Sovereign Functional SSOT:** The legacy system repository located at `F:\HR` represents the ultimate functional and operational Single Source of Truth for all 126 bot flows and system capabilities.
2. **Behavioral Exactness:** Every calculation, financial rule, state transition, step order, validation rule, error prompt, and accounting formula must mirror the legacy behavior with 100% exactness.
3. **Clean Re-engineering Principle:**
   - **DO NOT** copy spaghetti architecture, unvalidated globals, direct synchronous Google Sheets mutations, or unstructured procedural scripts from `F:\HR`.
   - **DO** extract the precise business requirements, invariants, and edge cases, re-implementing them cleanly within the enterprise 10-file vertical slice standard.

---

## 2. Zero Flow Divergence Policy

1. **No Unilateral Alterations:** Agents must never add, remove, rearrange, or shortcut wizard steps or business validations without explicit, written instruction from the user.
2. **Field Parity:** All prompts, field labels, confirmation summaries, and status outputs must preserve the exact domain semantics established in the baseline.
3. **Accounting Invariants (G11):**
   - Financial ledger entries, double-entry balancing, triple clearing, custody handling, and advance deduction formulas must remain mathematically identical to the baseline.

---

## 3. Master Migration Registry Sync (`docs/19`)

1. **Mandatory Tracking:** Every flow migrated or modernized must be logged in [`docs/19-legacy-to-enterprise-master-feature-migration-registry.md`](../../docs/19-legacy-to-enterprise-master-feature-migration-registry.md).
2. **Completion Criteria:** A flow is marked `🟢 مكتمل وموثق 100%` only after:
   - All 10 vertical slice files are implemented and verified.
   - Comprehensive Vitest unit, integration, and security tests pass.
   - The flow is cryptographically locked in `governance.lock.json`.
   - The commit hash and relative path are documented in the registry.
3. **Novel Features:** Any novel enterprise capability not present in `F:\HR` must be documented under the "Novel Enterprise Features" section of the registry.
