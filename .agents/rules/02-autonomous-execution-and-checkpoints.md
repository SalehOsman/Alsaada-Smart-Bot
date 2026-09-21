# Domain Rulebook 02: Autonomous Execution, Scoped Zones & Checkpoints

> **Authority:** Derived from [`GEMINI.md`](../../GEMINI.md) Part 3.  
> **Status:** Mandatory Operational Standard.

---

## 1. Zone-Based Scoped Autonomy

To maximize autonomous velocity while guaranteeing absolute system safety, all agent operations are divided into distinct autonomy zones:

### 1.1 Autonomous Zone (No Prior Approval Needed)
Agents are fully authorized to execute autonomously within the active task branch:
- Reading files, inspecting directory structures, and analyzing ASTs.
- Writing, refactoring, and fixing code within the designated vertical slice or package.
- Creating test suites, running unit tests, and executing typechecks.
- Formatting code (`prettier`, `pnpm preflight:fix`) and running linters.
- Consulting RAG indices, searching project documentation, and reading topology maps.

### 1.2 Restricted Zone (Explicit Formula Required)
The following operations require explicit, untranslated Arabic user confirmation:
- Merging branches to `main`: requires verbatim formula **«ادمج الفرع»**.
- Locking components cryptographically: requires verbatim formula **«نعم اقفل»**.
- Unlocking locked components: requires verbatim formula **«موافق على الفتح»** or **«نعم موافق على التعديل»**.
- Modifying locked files, schemas, or master governance: requires verbatim formula **«موافق على التعديل او الايقاف او الحذف»**.
- Modifying source code after test failure (RCA): requires verbatim formula **«موافق على تعديل الكود المصدري»**.

### 1.3 Strict Prohibition of Self-Authorization & Pre-Touch Encroachment
- **No Self-Generated Approval:** Agents cannot bypass the restricted zone by injecting approval tokens into generated Markdown files or evidence artifacts.
- **Pre-Touch Encroachment Prohibition:** Modifying a locked file before obtaining the unlock token and executing `pnpm unlock` is strictly prohibited, even if the agent intends to ask for permission later. Any pre-touch modification violates the Zero Blast Radius policy.

---

## 2. Command Execution Whitelist & Destructive Blacklist

### 2.1 Safe Command Whitelist
Agents may freely execute:
- `git status`, `git diff`, `git log`
- `pnpm typecheck`, `pnpm test`, `pnpm test:flow`, `pnpm test:pre-commit`
- `pnpm arch:verify`, `pnpm flow:check`, `pnpm migration:verify`
- `pnpm preflight:fix`, `pnpm format`
- `pnpm tsx tools/*`, `pnpm tsx scripts/*`
- `ocr review --concurrency 2`

### 2.2 Destructive Command Blacklist (Strictly Prohibited)
Agents are **strictly forbidden** from proposing or executing:
- `git reset --hard` (destructive loss of uncommitted work)
- `git clean -f` (destructive deletion of untracked files)
- `rm -rf` / recursive filesystem deletion outside scratch dirs
- Dropping production or local databases outside the isolated test database (`alsaada_test_db`)
- Modifying files outside the current slice boundary (violating Zero Blast Radius)

---

## 3. Autonomous Checkpoint Discipline

1. **Self-Contained Work Units:** Plan changes in cohesive, self-verifying checkpoints.
2. **Pre-Commit Verification:** Always execute local typechecks and targeted tests before staging.
3. **No Guesswork Principle:** If requirements, edge cases, or accounting models are underspecified, stop immediately and ask for clarification rather than making assumptions.
