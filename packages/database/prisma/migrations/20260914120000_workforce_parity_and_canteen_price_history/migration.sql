-- Migration: 20260914120000_workforce_parity_and_canteen_price_history
-- Compliance: Plan 26 Milestone 1 — Workforce Onboarding Parity, Compensation Architecture & Canteen Price History

-- 1. AlterTable workers: add additionalSalary and change contractType default to 'PERMANENT'
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "additionalSalary" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "workers" ALTER COLUMN "contractType" SET DEFAULT 'PERMANENT';

-- 2. AlterTable worker_custom_allowances: add title column and index
ALTER TABLE "worker_custom_allowances" ADD COLUMN IF NOT EXISTS "title" TEXT;
UPDATE "worker_custom_allowances" SET "title" = 'بدل مخصص' WHERE "title" IS NULL;
ALTER TABLE "worker_custom_allowances" ALTER COLUMN "title" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "worker_custom_allowances_workerId_idx" ON "worker_custom_allowances"("workerId");

-- 3. CreateTable canteen_item_price_histories
CREATE TABLE IF NOT EXISTS "canteen_item_price_histories" (
    "id" TEXT NOT NULL,
    "canteenItemId" TEXT NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "sellingPrice" DECIMAL(10,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" BIGINT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "canteen_item_price_histories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canteen_item_price_histories_canteenItemId_fkey" FOREIGN KEY ("canteenItemId") REFERENCES "canteen_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. CreateIndex on canteen_item_price_histories
CREATE INDEX IF NOT EXISTS "canteen_item_price_histories_canteenItemId_effectiveDate_idx" ON "canteen_item_price_histories"("canteenItemId", "effectiveDate");
