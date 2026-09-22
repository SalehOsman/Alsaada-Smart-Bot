-- Migration: 20260913210000_dashboard_auth_hardening_ssot
-- Compliance: PLAN-22 Stop-The-Line Remediation Package R1 Section IV.B

-- 1. AlterTable dashboard_auth_links
ALTER TABLE "dashboard_auth_links" ADD COLUMN IF NOT EXISTS "originKind" VARCHAR(20) NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "dashboard_auth_links" ADD COLUMN IF NOT EXISTS "groupId" VARCHAR(64);

-- Safe backfill for existing records: generate secure unique UUID for each legacy record without a groupId
UPDATE "dashboard_auth_links" 
SET "groupId" = gen_random_uuid()::text 
WHERE "groupId" IS NULL OR "groupId" = '';

-- Backfill originKind and targetOrigin for legacy records
UPDATE "dashboard_auth_links" SET "originKind" = 'TUNNEL' WHERE "targetOrigin" = 'TUNNEL';
UPDATE "dashboard_auth_links" SET "originKind" = 'LOCAL' WHERE "targetOrigin" = 'LOCAL';
UPDATE "dashboard_auth_links" SET "targetOrigin" = 'http://localhost:3002' WHERE "targetOrigin" = 'LOCAL';
UPDATE "dashboard_auth_links" SET "targetOrigin" = 'https://panel.alsaada.org' WHERE "targetOrigin" = 'TUNNEL';

-- Enforce NOT NULL and drop temporary defaults
ALTER TABLE "dashboard_auth_links" ALTER COLUMN "groupId" SET NOT NULL;
ALTER TABLE "dashboard_auth_links" ALTER COLUMN "groupId" DROP DEFAULT;
ALTER TABLE "dashboard_auth_links" ALTER COLUMN "targetOrigin" TYPE VARCHAR(255);
ALTER TABLE "dashboard_auth_links" ALTER COLUMN "targetOrigin" DROP DEFAULT;

-- Create constraint & indexes on dashboard_auth_links
CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_auth_links_groupId_originKind_key" ON "dashboard_auth_links"("groupId", "originKind");
CREATE INDEX IF NOT EXISTS "dashboard_auth_links_groupId_claimedAt_idx" ON "dashboard_auth_links"("groupId", "claimedAt");

-- 2. AlterTable dashboard_sessions
ALTER TABLE "dashboard_sessions" ADD COLUMN IF NOT EXISTS "extensionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "dashboard_sessions" ADD COLUMN IF NOT EXISTS "extendedAt" TIMESTAMP(3);
ALTER TABLE "dashboard_sessions" ADD COLUMN IF NOT EXISTS "maxExpiresAt" TIMESTAMP(3);

-- Safe backfill for maxExpiresAt (16 hours from createdAt)
UPDATE "dashboard_sessions" 
SET "maxExpiresAt" = "createdAt" + INTERVAL '16 hours' 
WHERE "maxExpiresAt" IS NULL;

-- Enforce NOT NULL on maxExpiresAt
ALTER TABLE "dashboard_sessions" ALTER COLUMN "maxExpiresAt" SET NOT NULL;
