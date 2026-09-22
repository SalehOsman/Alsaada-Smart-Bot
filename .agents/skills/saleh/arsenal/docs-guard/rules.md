
# docs-guard (Al-Saada Edition)

You are reviewing generated or changed documentation across `docs/`, `walkthrough.md`, `flow.docs.md`, and `README.md` files before it ships. The central axiom: **Documentation is a collection of physical claims about a codebase, and every claim must be verified against actual code.**

## 1. Project Context & Documentation Surfaces
- **Master Registries:** `docs/19-legacy-to-enterprise-master-feature-migration-registry.md` (SSOT migration registry), `docs/26-locked-flows-and-features-registry.md`, `docs/27-enterprise-ai-governance-and-quality-gates-constitution.md`.
- **Constitutional Micro-Kernel:** `GEMINI.md` and `AGENTS.md`.
- **Flow Documentation:** Every flow must contain a `walkthrough.md` with a Mermaid `stateDiagram-v2` showing state transitions, callback keys, and presentation cards.
- **Rule:** Zero marketing fluff, zero conversational filler, zero unverified claims.

## 2. The Ten Sovereign Documentation Rules

### Rule 1: Every Referenced Symbol Must Physically Exist
Every class, function, CLI script, npm command, database model, enum variant, and file path referenced in documentation must exist on disk. Check by viewing or searching the physical file, never recalling from LLM memory.

### Rule 2: Every Code Sample Must Work
All TypeScript or Bash/PowerShell code snippets in documentation must be valid, runnable, and use real imports from `@alsaada/*`. No fake imports, no placeholder parameters without types.

### Rule 3: Document Actual Code, Never Aspirational Code
Describe what the code physically does today. If code and specification disagree, the code is physical reality; flag the discrepancy to Saleh immediately rather than papering over it with wishful documentation.

### Rule 4: No Unverifiable Superlatives or Filler
Strip marketing adjectives: "blazingly fast", "bulletproof", "seamless", "cutting-edge". State verified physical metrics: "Sub-300ms p95 latency budget", "Zero hard deletes with audit log".

### Rule 5: Explicit Versioning and Work Plan IDs
Every feature or architectural enhancement must reference its Work Plan ID (e.g. `Work Plan 88`, `Work Plan 90`) and corresponding commit or PR hash.

### Rule 6: Code Changes Owe Documentation Updates (Gate G19)
If a code change modifies an API, a flow step, a permission matrix, or a database model, all corresponding documentation surfaces (`walkthrough.md`, `flow.docs.md`, `docs/19`, `docs/26`) must be updated in the exact same commit.

### Rule 7: Zero AI Slop & Conversational Padding
Delete introductory padding ("In this document we will explore...", "It is important to remember that..."). Deliver concise, executive markdown tables, bulleted specifications, and structured diagrams.

### Rule 8: Do Not Paraphrase Upstream Libraries
Do not copy grammY, Prisma, or Vitest documentation. Link directly to official documentation; document only Al-Saada's specific architectural choices and domain constraints.

### Rule 9: Document Edge Cases & Error States
Flow walkthroughs must show error screens, validation failures, cancellation dialogs, and permission denials — not just the happy path.

### Rule 10: Mandatory Mermaid `stateDiagram-v2` in Flow Walkthroughs (Gate G22)
Every flow's `walkthrough.md` must include a complete Mermaid `stateDiagram-v2` depicting all states, user actions, callbacks, and terminal events.

## 3. Self-Check Before Delivery
1. Did I verify all file paths and symbols against the physical repository?
2. Are all npm commands matching scripts defined in `package.json`?
3. Is `docs/19` updated if a flow was modified or completed?
4. Does the flow walkthrough include a Mermaid `stateDiagram-v2`?
5. Is the tone executive, direct, and free of filler?
