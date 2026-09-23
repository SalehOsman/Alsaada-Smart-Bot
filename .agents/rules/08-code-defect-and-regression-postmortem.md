# Domain Rulebook 08: Code Defect Lifecycle, Spec-First Dossier & Attestation Governance

> **Authority:** Derived from [`GEMINI.md`](../../GEMINI.md) Part 7, Work Plan 93, & [`docs/code-incidents/`](../../docs/code-incidents/).  
> **Status:** Mandatory Quality & Stability Protocol (Gate G14 / G15 / WP 93).

---

## 1. Spec-Before-Code Invariant & Hard Stop on Test Failures

1. **Immediate Execution Freeze:** If an automated test reveals an underlying defect or regression in production source code (`src/`), agents are strictly forbidden from making immediate, ad-hoc edits to fix the code (Zero "Vibe-Fixing").
2. **No Code Modification Without an Approved Plan:** Any bug fix or source code patch requires an approved work plan or formal incident dossier before touching a single line of production code.
3. **Defect vs Specification Rule:**
   - A failing test is a signal of code regression or unintended side-effects.
   - Modifying code without root cause analysis creates compounding regressions.

---

## 2. Mandatory Git Branch Isolation (OBOO Invariant)

1. **One Branch, One Objective:** All defect fixes must take place on a dedicated, isolated branch created strictly from clean `main`:
   ```bash
   pnpm branch:incident <slug> [titleArabic]
   ```
   Branch naming: `fix/inc-<date>-<slug>` (e.g. `fix/inc-20260923-worker-clearance`).
2. **Zero Branch Contamination:** It is strictly prohibited to fix defects inside feature branches or bundle unrelated features into incident branches.

---

## 3. The 5-Pillar Root Cause Analysis (RCA) Protocol

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

## 4. Mandatory Sovereign Fix Authorization Formulas

To proceed with source code modifications following an RCA report, the agent must receive one of the verbatim, untranslated Arabic approval formulas from the sovereign user:
> **«موافق على خطة الإصلاح»** or **«موافق على تعديل الكود المصدري»**

---

## 5. The 6-Section Forensic Defect Dossier (`docs/code-incidents/`)

Every defect fix must produce an authenticated dossier in `docs/code-incidents/<date>-incident-<slug>.md` strictly implementing all 6 sections:
1. **Section 1 — Incident Metadata & Scope:** YAML frontmatter (with `incident_id`, `date`, `branch`, `component`, `severity`, `category`, `status`, `work_plan`, `affected_test`, `regression_test`) and metadata table.
2. **Section 2 — Symptoms & Error Signatures:** Exact failure logs and `Actual vs Expected` terminal outputs.
3. **Section 3 — Root Cause Analysis (5 Whys) & F:\HR Baseline:** Comprehensive deep-dive and legacy behavior comparison.
4. **Section 4 — Architectural Resolution & Source Fix:** Exact code diffs, modified files, and verbatim authorization formula.
5. **Section 5 — Verification & Permanent Regression Proof:** Real terminal test execution proof and regression suite references.
6. **Section 6 — Preventive Recommendations:** Immediate corrections taken and long-term architectural recommendations.

### Zero-Placeholder & Physical Path Verification Gate:
All reports must pass automated governance verification:
```bash
pnpm incident:verify
pnpm test:incidents
```
The verifier enforces:
- **Zero Placeholders:** Strict rejection of `[...]`, `TODO`, `TBD`, `[اشرح بدقة...]`, `path/to/...`, or template strings.
- **Physical Reality:** Every referenced test file (`affected_test`, `regression_test`) and internal repo file link MUST exist physically on disk.

---

## 6. Mandatory Completion Attestation Card

Upon completing the defect repair and verifying that `pnpm incident:verify` passes, the agent MUST conclude its report with the verbatim attestation card:
> **«✅ تم توثيق وحل الخلل بالكامل في مجلد المشاكل [INC-YYYYMMDD-SLUG] داخل الفرع المنعزل واجتياز الفحص الجنائي»**

---

## 7. Universal Incident Scope & Zero-Omission Standard

1. **Broad Incident Scope:** The 5-Pillar RCA requirement applies universally to ALL system breakdowns:
   - **CI & Build Pipeline Breakdowns:** Frozen-lockfile desynchronization, missing lifecycle scripts, and workflow failures.
   - **Monorepo Version Parity Desyncs:** Release mismatch between root and workspace packages, and un-synchronized release cascades.
   - **Data Validation & Algorithmic Regressions:** Mathematical failures in check-digit algorithms (e.g. Modulo-11), legacy test fixtures divergence, or state machine corruptions.
   - **Constitutional Governance Drift:** Gate failures in documentation cross-references, unauthorized lockfile modifications, and uncommitted tree clutter.
2. **Zero-Omission Standard:** No defect or systemic regression may be resolved without an authenticated postmortem in `docs/code-incidents/` conforming strictly to `TEMPLATE.md`.
3. **Preventive Structural Guarantee:** Each report must culminate in permanent preventative mechanisms: automated static verifiers, regression tests, and cryptographic sealing.

