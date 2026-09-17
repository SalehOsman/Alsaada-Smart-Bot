# Implementation Plan: Enterprise Permanent Speed Engine, Socket Pooling, AST Governance & Circuit-Breaker Watchdog (Plan 42)

## Overview
Full implementation of Work Plan 42 across `apps/bot-server`, `tools/governance`, and `tools/scaffold`:
1. **Pillar 1: Tiered L1 RAM / L2 Redis Sovereign Cache (`apps/bot-server`)**:
   - In `apps/bot-server/src/services/fast-cache.service.ts`: Add L1 in-memory micro-cache (TTL: 60s, SWR pattern) for user role & session context (`rememberUserContext`, `rememberSession`, `invalidateUserContext`).
   - Add memoization of static keyboards (`memoizeKeyboard`) to eliminate GC churn.
   - Update `auth.middleware.ts` to leverage 60s micro-TTL with instant SWR revalidation.

2. **Pillar 2: In-Place Mutation Sovereignty & Safe Background Deletions (`apps/bot-server`)**:
   - In `apps/bot-server/src/services/screen-flow.service.ts`: Export `safeDeleteBackground(ctx, messageId)` as non-blocking (`void ctx.api.deleteMessage(...).catch(() => {})`).
   - Replace blocking deletion calls across `screen-flow.service.ts` with non-blocking calls.
   - In `apps/bot-server/src/handlers/start.handler.ts`: Remove duplicate sequential cleanups, make `syncUserCommandsScope` non-blocking/background, and pass `ensurePersistentKeyboard(ctx, undefined, false)` to avoid needless keyboard regeneration.

3. **Pillar 3: Dedicated Warm Socket Pool & Polling Isolation (`apps/bot-server`)**:
   - In `apps/bot-server/src/bot.ts`: Configure dedicated `https.Agent` with `keepAlive: true`, `maxSockets: 50`, `maxFreeSockets: 15`, `timeout: 60000`, `scheduling: 'fifo'`.
   - Separate polling socket from outgoing calls (`outgoingAgent` vs `pollingAgent`).
   - 20s heartbeat socket warmer.

4. **Pillar 4: Pre-Routing Instant ACK Gate (`apps/bot-server`)**:
   - In `apps/bot-server/src/bot.ts`: Acknowledge callback queries immediately (< 10ms) while properly preserving modal alerts.

5. **Pillar 5: Circuit-Breaker Latency Watchdog (`apps/bot-server`)**:
   - In `apps/bot-server/src/services/telemetry.service.ts`: Track operations latency. If 3 consecutive operations exceed 500ms, check cooldown (60s). If expired, auto-heal connection pool (`warmUpConnectionPool`); if recurrent, trip circuit breaker to protect against self-DDoS.

6. **Pillar 6: Zero-Regression AST Latency Gate (`tools/governance`)**:
   - Create `tools/governance/verify-latency-anti-patterns.ts` (< 300ms execution): AST scanner that rejects `await ctx.api.deleteMessage` or unshielded sequential awaits in bot and module flow handlers, supporting the security bypass directive `// @governance-security-blocking-delete: [reason]`.
   - Add `pnpm latency:verify` in `package.json` and integrate it into `.githooks/pre-commit` and `pnpm governance:verify`.

7. **Pillar 7: Speed Engine Cryptographic Lock Tooling (`tools/scaffold`)**:
   - Create `tools/scaffold/lock-speed.ts` (`pnpm speed:lock`) and `tools/scaffold/unlock-speed.ts` (`pnpm speed:unlock`).
   - Support `lockedSpeedEngine` in `tools/governance/verify-governance-lock.ts`, `verify-governance-tamper.ts`, and `governance.lock.json`. Enforce strict approval phrase matching per `AGENTS.md`.

8. **Tests & Verification**:
   - Unit & integration tests in `apps/bot-server/tests/permanent-speed-engine.spec.ts` and `tools/governance/tests/verify-latency-anti-patterns.spec.ts`.
   - Full suite passes: `pnpm --filter @alsaada/bot-server test`, `pnpm --filter @alsaada/admin-dashboard test`, `pnpm perf-budget:verify`, `pnpm latency:verify`, `pnpm typecheck`, `pnpm governance:verify`.
