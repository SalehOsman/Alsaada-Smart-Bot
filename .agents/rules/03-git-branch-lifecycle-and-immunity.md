# Domain Rulebook 03: Git Branch Lifecycle & Strict Main Immunity

> **Authority:** Derived from [`GEMINI.md`](../../GEMINI.md) Part 4 & [`.githooks/pre-commit.cmd`](../../.githooks/pre-commit.cmd).  
> **Status:** Mandatory Architectural Gate (G15).

---

## 1. Strict Main Immunity

1. **Absolute Push & Commit Ban:** Direct commits or pushes to the `main` branch are strictly prohibited and actively intercepted by `.githooks/pre-commit` (`Exit 1`).
2. **One Branch, One Objective (OBOO Invariant):** All development, refactoring, bug fixing, and feature additions must take place on dedicated, isolated topic branches created directly from clean `main`.
3. **Zero Branch Contamination:** Agents are strictly forbidden from fixing bugs within an active feature branch, or implementing new features inside a defect repair branch. Every discrete objective requires its own isolated branch.

---

## 2. Standard Branch Naming & Scaffolding Taxonomy

All branches must adhere strictly to the following naming patterns and should be created via automated tooling:
- **Defect Incidents:** `fix/inc-<date>-<slug>` (e.g., `fix/inc-20260923-worker-clearance`)
  - **Scaffold Command:** `pnpm branch:incident <slug> [titleArabic]`
  - Automatically verifies working tree cleanliness (`git status --porcelain`), branches from `main`, and generates the incident dossier in `docs/code-incidents/`.
- **New Business Features:** `feat/<feature-slug>`
  - **Scaffold Command:** `pnpm branch:feature <slug>`
- **Work Plan Blueprints:** `plan/<wp-number>-<slug>` (e.g., `plan/93-defect-dossier-governance`)
  - **Scaffold Command:** `pnpm branch:plan <slug>`
- **Tooling & Chore Maintenance:** `chore/<task-slug>`

---

## 3. Pre-Merge Verification Pipeline

Before any branch can be considered eligible for integration into `main`, it must successfully pass:
1. **Full Typecheck:** `pnpm typecheck` (zero TypeScript errors).
2. **Defect Dossier Verification (Mandatory for fixes):** `pnpm incident:verify` and `pnpm test:incidents` (zero placeholders, valid frontmatter, all referenced physical paths verified on disk).
3. **Full CI Simulation:** `pnpm ci:simulate` (all 23 Quality Gates + Vitest test suites).
4. **Open Code Review:** `ocr review --concurrency 2` (clean pass without unresolved critical findings).
5. **Walkthrough Evidence:** A complete, documented verification record in `walkthrough.md` including manual testing evidence and Mermaid state diagrams.
6. **Mandatory Completion Attestation (Defects):** For bug fixes, the agent must output the verbatim attestation card before requesting merge:
   > **«✅ تم توثيق وحل الخلل بالكامل في مجلد المشاكل [INC-YYYYMMDD-SLUG] داخل الفرع المنعزل واجتياز الفحص الجنائي»**

---

## 4. Sovereign Merge Protocol

1. **No-Fast-Forward Merge:** Merges into `main` must use `--no-ff` to preserve complete branch history:
   ```bash
   git checkout main
   git merge --no-ff <branch-name> -m "merge: integrate <branch-name> into main"
   ```
2. **Verbatim Authorization Token:** Execution of the merge command requires the exact, untranslated Arabic approval formula from the sovereign user:
   > **«ادمج الفرع»**
   Any attempt to merge without this exact formula is a critical governance violation.
