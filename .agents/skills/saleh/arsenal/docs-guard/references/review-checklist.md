# Docs Guard Review Checklist (/boost Mode)

Use this checklist during deep forensic documentation review under `/saleh` and `/boost`.

## 1. Ground-Truth Parity
- [ ] Do all referenced file paths physically exist on disk?
- [ ] Do all referenced npm commands match scripts in `package.json`?
- [ ] Are all code snippets valid TypeScript that import from genuine packages?
- [ ] Are all Work Plan numbers and feature IDs accurately cross-referenced?

## 2. Walkthrough & Diagram Completeness
- [ ] Does `walkthrough.md` or `flow.docs.md` exist for every bot flow?
- [ ] Does every walkthrough contain a valid Mermaid `stateDiagram-v2`?
- [ ] Are error screens, validation failures, and edge paths documented?

## 3. Style & Tone
- [ ] Are marketing buzzwords and filler phrases absent?
- [ ] Are docstrings non-redundant and documenting genuine contracts?
- [ ] Is `docs/19-legacy-to-enterprise-master-feature-migration-registry.md` in sync?
