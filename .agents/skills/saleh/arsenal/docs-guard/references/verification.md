# Documentation Verification Procedure

Follow this mechanical procedure when auditing documentation:

## 1. Symbol and Path Verification
1. Extract all referenced file paths: `git ls-files <path>` to confirm existence.
2. Extract all referenced CLI commands: Verify they exist in root `package.json` under `"scripts"`.
3. Extract all Prisma models/fields: Verify against `packages/database/prisma/schema.prisma`.
4. Extract all bot callbacks: Verify against `flow.keyboard.ts` and ensure length ≤ 36 bytes.

## 2. Docs-vs-Code Drift Audit
1. Inspect git diff for modified flow files.
2. If `modules/*/src/flows/<flow-slug>/` was touched:
   - Check `modules/*/src/flows/<flow-slug>/walkthrough.md` for matching updates.
   - Verify that the Mermaid `stateDiagram-v2` reflects all active steps and transitions.
   - Verify that `docs/19-legacy-to-enterprise-master-feature-migration-registry.md` has the correct status, path, and commit hash.
