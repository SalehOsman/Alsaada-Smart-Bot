-- Migration: 20260917010000_add_ppe_site_and_worker_commitment_scores
-- Compliance: Plan 50/52 Schema Drift Remediation & Performance Indexing

-- AlterTable advance_requests
ALTER TABLE "advance_requests" ADD COLUMN IF NOT EXISTS "siteId" TEXT;

-- AlterTable ppe_assets
ALTER TABLE "ppe_assets" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
ALTER TABLE "ppe_assets" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateTable worker_commitment_scores
CREATE TABLE IF NOT EXISTS "worker_commitment_scores" (
    "id" TEXT NOT NULL,
    "scoreNumber" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "siteId" TEXT,
    "evaluationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 100,
    "tier" TEXT NOT NULL DEFAULT 'COMMITTED',
    "contractTypeEvaluated" TEXT NOT NULL DEFAULT 'PERMANENT',
    "leaveShiftScore" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "disciplinaryScore" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "ppeScore" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "financialScore" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "breakdown" JSONB,
    "recoveryGuidance" TEXT,
    "sha256Checksum" TEXT,
    "snapshotKey" TEXT,
    "calculatedBy" TEXT DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_commitment_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "worker_commitment_scores_scoreNumber_key" ON "worker_commitment_scores"("scoreNumber");
CREATE INDEX IF NOT EXISTS "worker_commitment_scores_workerId_evaluationDate_idx" ON "worker_commitment_scores"("workerId", "evaluationDate");
CREATE INDEX IF NOT EXISTS "worker_commitment_scores_siteId_tier_idx" ON "worker_commitment_scores"("siteId", "tier");
CREATE INDEX IF NOT EXISTS "worker_commitment_scores_tier_idx" ON "worker_commitment_scores"("tier");
CREATE INDEX IF NOT EXISTS "worker_commitment_scores_evaluationDate_idx" ON "worker_commitment_scores"("evaluationDate");
CREATE UNIQUE INDEX IF NOT EXISTS "worker_commitment_scores_workerId_snapshotKey_key" ON "worker_commitment_scores"("workerId", "snapshotKey");

-- Additional Model Performance Indexes
CREATE INDEX IF NOT EXISTS "advance_requests_workerId_status_idx" ON "advance_requests"("workerId", "status");
CREATE INDEX IF NOT EXISTS "advance_requests_siteId_createdAt_idx" ON "advance_requests"("siteId", "createdAt");
CREATE INDEX IF NOT EXISTS "canteen_items_siteId_isActive_idx" ON "canteen_items"("siteId", "isActive");
CREATE INDEX IF NOT EXISTS "financial_custodies_siteId_status_idx" ON "financial_custodies"("siteId", "status");
CREATE INDEX IF NOT EXISTS "financial_custodies_custodianWorkerId_status_idx" ON "financial_custodies"("custodianWorkerId", "status");
CREATE INDEX IF NOT EXISTS "financial_ledgers_workerId_transactionType_idx" ON "financial_ledgers"("workerId", "transactionType");
CREATE INDEX IF NOT EXISTS "financial_ledgers_createdAt_idx" ON "financial_ledgers"("createdAt");
CREATE INDEX IF NOT EXISTS "financial_ledgers_accountingMonth_idx" ON "financial_ledgers"("accountingMonth");
CREATE INDEX IF NOT EXISTS "leaves_workerId_status_idx" ON "leaves"("workerId", "status");
CREATE INDEX IF NOT EXISTS "leaves_siteId_departureDate_idx" ON "leaves"("siteId", "departureDate");
CREATE INDEX IF NOT EXISTS "ppe_assets_workerId_status_idx" ON "ppe_assets"("workerId", "status");
CREATE INDEX IF NOT EXISTS "ppe_assets_siteId_assetType_idx" ON "ppe_assets"("siteId", "assetType");
CREATE INDEX IF NOT EXISTS "workers_tenantId_status_idx" ON "workers"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "workers_siteId_status_idx" ON "workers"("siteId", "status");
CREATE INDEX IF NOT EXISTS "workers_jobTitleId_idx" ON "workers"("jobTitleId");
CREATE INDEX IF NOT EXISTS "workers_departmentId_idx" ON "workers"("departmentId");

-- AddForeignKey constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ppe_assets_siteId_fkey'
    ) THEN
        ALTER TABLE "ppe_assets" ADD CONSTRAINT "ppe_assets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'worker_commitment_scores_workerId_fkey'
    ) THEN
        ALTER TABLE "worker_commitment_scores" ADD CONSTRAINT "worker_commitment_scores_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'worker_commitment_scores_siteId_fkey'
    ) THEN
        ALTER TABLE "worker_commitment_scores" ADD CONSTRAINT "worker_commitment_scores_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'advance_requests_siteId_fkey'
    ) THEN
        ALTER TABLE "advance_requests" ADD CONSTRAINT "advance_requests_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
