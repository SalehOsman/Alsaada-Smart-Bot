-- CreateTable dashboard_auth_links
CREATE TABLE "dashboard_auth_links" (
    "id" TEXT NOT NULL,
    "jtiHash" VARCHAR(64) NOT NULL,
    "actorTelegramId" BIGINT NOT NULL,
    "targetOrigin" TEXT NOT NULL DEFAULT 'LOCAL',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "claimTraceId" VARCHAR(36),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dashboard_auth_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dashboard_auth_links_jtiHash_key" ON "dashboard_auth_links"("jtiHash");
CREATE INDEX "dashboard_auth_links_expiresAt_idx" ON "dashboard_auth_links"("expiresAt");
CREATE INDEX "dashboard_auth_links_actorTelegramId_idx" ON "dashboard_auth_links"("actorTelegramId");

-- CreateTable dashboard_sessions
CREATE TABLE "dashboard_sessions" (
    "id" TEXT NOT NULL,
    "sessionHash" VARCHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "actorTelegramId" BIGINT NOT NULL,
    "originKind" TEXT NOT NULL DEFAULT 'LOCAL',
    "deviceSummary" VARCHAR(255),
    "userAgentHash" VARCHAR(64),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "noticeSentAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" VARCHAR(100),
    "permissionsVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dashboard_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dashboard_sessions_sessionHash_key" ON "dashboard_sessions"("sessionHash");
CREATE INDEX "dashboard_sessions_userId_revokedAt_idx" ON "dashboard_sessions"("userId", "revokedAt");
CREATE INDEX "dashboard_sessions_actorTelegramId_idx" ON "dashboard_sessions"("actorTelegramId");
CREATE INDEX "dashboard_sessions_expiresAt_idx" ON "dashboard_sessions"("expiresAt");

-- CreateTable worker_delegations
CREATE TABLE "worker_delegations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "permissionKey" VARCHAR(100) NOT NULL,
    "siteId" TEXT NOT NULL,
    "resourceId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "requestedByTelegramId" BIGINT NOT NULL,
    "approvedByTelegramId" BIGINT NOT NULL,
    "revokedByTelegramId" BIGINT,
    "reason" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "worker_delegations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "worker_delegations_userId_status_idx" ON "worker_delegations"("userId", "status");
CREATE INDEX "worker_delegations_workerId_status_idx" ON "worker_delegations"("workerId", "status");
CREATE INDEX "worker_delegations_siteId_status_idx" ON "worker_delegations"("siteId", "status");
CREATE INDEX "worker_delegations_permissionKey_idx" ON "worker_delegations"("permissionKey");

-- Foreign Keys
ALTER TABLE "dashboard_sessions" ADD CONSTRAINT "dashboard_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_delegations" ADD CONSTRAINT "worker_delegations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_delegations" ADD CONSTRAINT "worker_delegations_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_delegations" ADD CONSTRAINT "worker_delegations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data Migration & Forensic Preservation Rules:
-- 1. Migrate legacy ADMIN to FIELD_ADMIN
UPDATE "users" SET "role" = 'FIELD_ADMIN' WHERE "role" = 'ADMIN';

-- 2. Preserve forensic audit record for all deprecated roles BEFORE deactivating/remapping
INSERT INTO "audit_logs" ("id", "traceId", "actorTelegramId", "action", "entityType", "entityId", "beforePayload", "afterPayload", "timestamp")
SELECT 
  gen_random_uuid()::text,
  'migration-plan-21-legacy-roles',
  "telegramId",
  'ROLE_DEPRECATION_MIGRATION',
  'User',
  "id",
  json_build_object('legacyRole', "role", 'isActive', "isActive"),
  json_build_object('newRole', 'GUEST', 'isActive', false, 'status', 'AWAITING_SUPER_ADMIN_REASSIGNMENT'),
  CURRENT_TIMESTAMP
FROM "users"
WHERE "role" IN ('EXECUTIVE', 'EXECUTIVE_DIRECTOR', 'ACCOUNTANT', 'PROJECT_MANAGER', 'SITE_ENGINEER')
   OR "role" NOT IN ('SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR', 'WORKER', 'SUPPLIER', 'GUEST');

-- 3. Deactivate obsolete and unknown roles and map to GUEST for review
UPDATE "users" 
SET "role" = 'GUEST', "isActive" = false 
WHERE "role" IN ('EXECUTIVE', 'EXECUTIVE_DIRECTOR', 'ACCOUNTANT', 'PROJECT_MANAGER', 'SITE_ENGINEER')
   OR "role" NOT IN ('SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR', 'WORKER', 'SUPPLIER', 'GUEST');
