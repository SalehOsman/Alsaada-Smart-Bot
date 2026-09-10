# Implementation Plan: Field Admin Scoping, Worker Portal Modularization & Cryptographic Workforce Linking (Plan 07)

## Overview
Full implementation of Work Plan 07 across `modules/workforce`, `apps/bot-server`, and `modules/settings`:
1. **Cryptographic WhatsApp Linking Engine & Guest Join (`01.7-guest-join-and-linking`)**:
   - 24-hour token TTL (86,400s).
   - Strict cryptographic ID binding to applicant's numeric Telegram User ID (`ctx.from.id`).
   - Link dispatched exclusively to the registered official WhatsApp number (`Worker.phone`).
   - Single-use token invalidated immediately upon consumption or renewal.
2. **Worker Self-Edit Flow (`01.6-worker-self-edit`)**:
   - Self-service personal and contact updates.
   - Strict Zero Financial Mutation (blocks editing wage, salary, allowances, job, site).
3. **Worker Offboarding Flow (`01.8-worker-offboarding`)**:
   - Administrative clearance & termination.
   - Instant demotion of linked user to role `GUEST`, unlinking `workerId`, `assignedSiteId = null`.
   - L1/Redis cache purge and synchronous downgrade of Telegram command menu to 4 guest commands.
4. **Polymorphic Commands Router & Guest Hardening (`apps/bot-server`)**:
   - Dynamic routing of `/profile`, `/leave`, `/advance`, `/help`, `/apply`, `/status` by `effectiveRole`.
   - Strict Guest Command Scope: exactly 4 commands (`/start`, `/cancel`, `/apply`, `/status`).
   - Guest UI strictly hides the 5 operational domains.
5. **Worker Portal Decomposition (`apps/bot-server`)**:
   - 5 specialized sub-hubs: Profile, Finance, Attendance, Custody, Support.
6. **Sovereign Settings Isolation & Field Admin Scoping (`modules/settings` & `apps/bot-server`)**:
   - Super Admin Settings Hub strictly reserved for real Super Admin when `effectiveRole === 'SUPER_ADMIN'`, masked in Ghost Mode.
   - Field Admin scoping in Ghost Mode: smart fallback to active site with workers (`workers: { some: { isDeleted: false } }`).
   - Rename Field Admin reply button to `👤 ملفي الشخصي`.
   - Navigation button immunity in `isStaleCallback` and updating `tsconfig.dev.json` for `@alsaada/settings`.
   - Elimination of unescaped underscores (`#ERR-LT22`).
7. **Verification & Governance**:
   - Complete 5-tier test suites (`unit`, `integration`, `ux`, `rbac`, `data`) for each vertical slice.
   - Update `docs/19-legacy-to-enterprise-master-feature-migration-registry.md`.
   - `pnpm typecheck`, `pnpm test`, and `pnpm governance:verify`.
