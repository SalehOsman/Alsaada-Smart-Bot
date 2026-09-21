# Domain Rulebook 03: Git Branch Lifecycle & Strict Main Immunity

> **Authority:** Derived from [`GEMINI.md`](../../GEMINI.md) Part 4 & [`.githooks/pre-commit.cmd`](../../.githooks/pre-commit.cmd).  
> **Status:** Mandatory Architectural Gate (G15).

---

## 1. Strict Main Immunity

1. **Absolute Push & Commit Ban:** Direct commits or pushes to the `main` branch are strictly prohibited and actively intercepted by `.githooks/pre-commit` (`Exit 1`).
2. **Isolation Guarantee:** All development, refactoring, bug fixing, and documentation overhaul must take place on dedicated, isolated topic branches.

---

## 2. Standard Branch Naming Taxonomy

All branches must adhere strictly to the following naming patterns:
- `feat/<feature-slug>`: New business features, new modules, or new bot flows.
- `fix/<issue-slug>`: Defect repairs and bug fixes.
- `plan/<wp-number>-<slug>`: Work plan branches (e.g., `plan/wp-88-english-governance-reorganization`).
- `chore/<task-slug>`: Tooling, dependency updates, and maintenance tasks.

---

## 3. Pre-Merge Verification Pipeline

Before any branch can be considered eligible for integration into `main`, it must successfully pass:
1. **Full Typecheck:** `pnpm typecheck` (zero TypeScript errors).
2. **Full CI Simulation:** `pnpm ci:simulate` (all 23 Quality Gates + Vitest test suites).
3. **Open Code Review:** `ocr review --concurrency 2` (clean pass without unresolved critical findings).
4. **Walkthrough Evidence:** A complete, documented verification record in `walkthrough.md` including manual testing evidence and Mermaid state diagrams.

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
