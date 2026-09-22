# Module Migration Card: [Module Name]

> **Template Version:** 2.0.0 (Work Plan 89 Standard)  
> **Module Slug:** `[module-slug]`  
> **Assigned Squad:** `[Squad:UX / Squad:Finance / Squad:Arch / Squad:QA]`  
> **Status:** `[DRAFT | IN_DEVELOPMENT | UNDER_AUDIT | ACCEPTED]`  

---

## 1. Module Overview & Scope

| Field | Detail |
|---|---|
| **Module Name** | `[Display Name]` |
| **Package Identifier** | `@alsaada/[module-slug]` |
| **Directory** | `modules/[module-slug]/` |
| **Version** | `1.0.0` |
| **Target F:\HR Subsystem** | `[Legacy Directory / Feature Name]` |
| **Lead Engineer** | `[Engineer / Agent Name]` |
| **Audit Lead** | `/saleh` |

### Included Flows
- [ ] `XX.1-[flow-slug-1]`
- [ ] `XX.2-[flow-slug-2]`

---

## 2. Capability Matrix

- **Bot Conversational Flows:** `[Yes / No]` (List flow slugs)
- **Admin Dashboard Pages:** `[Yes / No]` (List route paths)
- **Database Models (DMMF AST Fragment):** `[Yes / No]` (List model names)
- **Outbox Events / Background Workers:** `[Yes / No]` (List event topics)
- **External API Integrations:** `[Yes / No]` (List services)

---

## 3. Architecture & Contracts Checklist

- [ ] `module.json` created and validates against `moduleManifestSchema`
- [ ] `package.json` configured with correct monorepo workspace dependencies
- [ ] `src/index.ts` cleanly exports public domain contracts
- [ ] `src/module.routes.ts` exports `moduleRoutes: BotRouteHandler[]`
- [ ] `src/admin/routes.tsx` exports dynamic dashboard routes (if applicable)
- [ ] `src/admin/navigation.ts` exports navigation sidebar items (if applicable)
- [ ] `prisma/schema.module.prisma` defines isolated schema additions (if applicable)
- [ ] All flows implement the strict 10-file vertical slice standard
- [ ] Zero circular or reverse dependencies into core apps (`apps/bot-server`, `apps/admin-dashboard`)

---

## 4. 4-Tier Verification Sign-Off

### Tier 1: TypeSafe Rigor
- [ ] `pnpm typecheck` PASS with 0 errors
- [ ] All DTOs, sessions, and inputs validated via Zod schemas
- [ ] Zero `@ts-ignore` or `any` types

### Tier 2: F:\HR Legacy Parity
- [ ] 100% feature and calculation parity verified against `F:\HR`
- [ ] Double-entry ledger balanced (for financial modules)
- [ ] Soft-delete and audit trail invariants preserved

### Tier 3: Security & Cryptographic Immutability
- [ ] RBAC permissions declared and verified on all entry points
- [ ] Salary and sensitive PII masked per role permissions
- [ ] `pnpm core:immutability:verify` PASS (0 modified core files)
- [ ] `pnpm governance:tamper-check` PASS against `governance.lock.json`

### Tier 4: Mobile Ergonomics & APM Latency
- [ ] All inline buttons adhere to 36/16/7/3 budgets
- [ ] Interaction response times under 300ms latency budget
- [ ] Zero `console.log` or `console.error` (Telemetry logger used exclusively)
- [ ] Mermaid `stateDiagram-v2` documented for every conversational flow

---

## 5. Forensic Audit & Production Release Sign-Off

| Milestone | Command / Evidence | Status | Timestamp |
|---|---|---|---|
| **Parity Verification** | `pnpm test:modules:parity` | `[PASS / FAIL]` | |
| **Acceptance Harness** | `pnpm test:modules:acceptance` | `[PASS / FAIL]` | |
| **Core Immutability** | `pnpm core:immutability:verify` | `[PASS / FAIL]` | |
| **Quality Gates (G1–G23)**| `pnpm ci:simulate` | `[PASS / FAIL]` | |
| **Forensic Audit** | `pnpm audit:saleh:boost` | `[PASS / FAIL]` | |
| **Release Artifact** | `pnpm module:build [slug]` | `[READY]` | |

**Final Squad Approval:** `[Approved / Rejected]`  
**Sovereign Proxy Verdict (`/saleh`):** `[PASS / CONDITIONAL PASS / REJECT]`  
**Approval Nonce / Formula:** `«ادمج الفرع»`
