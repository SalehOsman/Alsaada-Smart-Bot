# Domain Rulebook 08: Code Defect Lifecycle & 5-Pillar RCA Standard

> **Authority:** Derived from [`GEMINI.md`](../../GEMINI.md) Part 7 & [`docs/code-incidents/`](../../docs/code-incidents/).  
> **Status:** Mandatory Quality & Stability Protocol.

---

## 1. Hard Stop on Test Failures in Source Code (`src/`)

1. **Immediate Execution Freeze:** If an automated test reveals an underlying defect or regression in production source code (`src/`), agents are strictly forbidden from making immediate, ad-hoc edits to fix the code.
2. **Defect vs Specification Rule:**
   - A failing test is a signal of code regression or unintended side-effects.
   - Modifying code without root cause analysis creates compounding regressions.

---

## 2. The 5-Pillar Root Cause Analysis (RCA) Protocol

Before proposing any fix to source code, the agent must generate a formal **5-Pillar RCA Report**:

1. **Pillar 1 — Failure Forensic Details:**
   - Exact test failure message, file path, line number, stack trace, and unexpected value.
2. **Pillar 2 — Root Cause Analysis in Source:**
   - Deep architectural explanation of why the source code behaved unexpectedly (e.g., race condition, missing boundary check, unhandled edge case).
3. **Pillar 3 — F:\HR Parity Baseline:**
   - Cross-examination against legacy system behavior in `F:\HR` to verify expected business logic.
4. **Pillar 4 — Blast Radius & Solution Options:**
   - Evaluation of all affected modules and presentation of at least two viable architectural remedies with trade-offs.
5. **Pillar 5 — Remediation Work Plan Scope:**
   - Precise list of files to be modified, regression test strategy, and estimated impact.

---

## 3. Mandatory Sovereign Fix Authorization Formula

To apply a source code modification following an RCA report, the agent must receive the verbatim, untranslated Arabic approval formula from the sovereign user:
> **«موافق على تعديل الكود المصدري»**

---

## 4. Permanent Regression Test Guarantee

1. **Mandatory Regression Suite:** Every code fix must be accompanied by a dedicated, permanent regression test suite placed under `<module>/tests/regression/` or `<package>/tests/`.
2. **Cryptographic Locking:** The new regression test must be locked under `test:<path>` in `governance.lock.json`.
3. **Post-Incident Documentation:** A post-incident summary must be logged in `docs/code-incidents/<date>-incident-<slug>.md` using `pnpm make:incident`.

---

## 5. Universal Incident Scope & Zero-Omission Standard

1. **Broad Incident Scope:** The 5-Pillar RCA requirement applies universally to ALL system breakdowns, not merely runtime crashes in business logic:
   - **CI & Build Pipeline Breakdowns:** Frozen-lockfile desynchronization, missing lifecycle scripts, and workflow failures.
   - **Monorepo Version Parity Desyncs:** Release mismatch between root and workspace packages, and un-synchronized release cascades.
   - **Data Validation & Algorithmic Regressions:** Mathematical failures in check-digit algorithms (e.g. Modulo-11), legacy test fixtures divergence, or state machine corruptions.
   - **Constitutional Governance Drift:** Gate failures in documentation cross-references, unauthorized lockfile modifications, and uncommitted tree clutter.
2. **Zero-Omission Standard:** No defect or systemic regression may be resolved without an authenticated postmortem in `docs/code-incidents/` conforming strictly to `TEMPLATE.md`.
3. **Preventive Structural Guarantee:** Each report must culminate in permanent preventative mechanisms: automated static verifiers, regression tests, and cryptographic sealing.

