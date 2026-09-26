-- =============================================================================
-- Migration: 20260926120000_modular_database_emancipation_and_ghost_table_purge
-- Governed by Work Plan 117 (Sovereign Modular Database Emancipation)
-- 1. Drops cross-module physical foreign keys and tightly coupled constraints
-- 2. Adds missing columns (sites.telegramTopicId, users.freezeBotAccessOnLeave)
-- 3. Safely drops all 30 unused/ghost tables (archived in docs/schemas/future-modules-draft-schemas/)
-- =============================================================================

-- DropForeignKey
ALTER TABLE IF EXISTS "camp_food_items" DROP CONSTRAINT IF EXISTS "camp_food_items_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "canteen_item_price_histories" DROP CONSTRAINT IF EXISTS "canteen_item_price_histories_canteenItemId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "canteen_items" DROP CONSTRAINT IF EXISTS "canteen_items_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "custody_expense_items" DROP CONSTRAINT IF EXISTS "custody_expense_items_custodyId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "custody_settlements" DROP CONSTRAINT IF EXISTS "custody_settlements_custodyId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "duty_rosters" DROP CONSTRAINT IF EXISTS "duty_rosters_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "duty_rosters" DROP CONSTRAINT IF EXISTS "duty_rosters_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "duty_rosters" DROP CONSTRAINT IF EXISTS "duty_rosters_workerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "equipment_maintenances" DROP CONSTRAINT IF EXISTS "equipment_maintenances_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "equipment_maintenances" DROP CONSTRAINT IF EXISTS "equipment_maintenances_supplierId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "equipments" DROP CONSTRAINT IF EXISTS "equipments_assignedWorkerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "equipments" DROP CONSTRAINT IF EXISTS "equipments_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "financial_custodies" DROP CONSTRAINT IF EXISTS "financial_custodies_custodianWorkerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "financial_custodies" DROP CONSTRAINT IF EXISTS "financial_custodies_disbursedFromTreasuryId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "financial_custodies" DROP CONSTRAINT IF EXISTS "financial_custodies_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "financial_ledgers" DROP CONSTRAINT IF EXISTS "financial_ledgers_canteenItemId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "financial_ledgers" DROP CONSTRAINT IF EXISTS "financial_ledgers_sourceCustodyId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "financial_ledgers" DROP CONSTRAINT IF EXISTS "financial_ledgers_supplierId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "food_inbound_shipments" DROP CONSTRAINT IF EXISTS "food_inbound_shipments_receivedByWorkerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "food_inbound_shipments" DROP CONSTRAINT IF EXISTS "food_inbound_shipments_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "food_inbound_shipments" DROP CONSTRAINT IF EXISTS "food_inbound_shipments_supplierId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "food_waste_logs" DROP CONSTRAINT IF EXISTS "food_waste_logs_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "fuel_dispense_logs" DROP CONSTRAINT IF EXISTS "fuel_dispense_logs_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "fuel_dispense_logs" DROP CONSTRAINT IF EXISTS "fuel_dispense_logs_operatorWorkerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "fuel_dispense_logs" DROP CONSTRAINT IF EXISTS "fuel_dispense_logs_tankId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "fuel_tanks" DROP CONSTRAINT IF EXISTS "fuel_tanks_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "fuel_tanks" DROP CONSTRAINT IF EXISTS "fuel_tanks_supervisorWorkerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "hospitality_expenses" DROP CONSTRAINT IF EXISTS "hospitality_expenses_disbursedByWorkerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "hospitality_expenses" DROP CONSTRAINT IF EXISTS "hospitality_expenses_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "hospitality_expenses" DROP CONSTRAINT IF EXISTS "hospitality_expenses_sourceCustodyId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "kitchen_meal_dispenses" DROP CONSTRAINT IF EXISTS "kitchen_meal_dispenses_chefWorkerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "kitchen_meal_dispenses" DROP CONSTRAINT IF EXISTS "kitchen_meal_dispenses_recipeId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "kitchen_meal_dispenses" DROP CONSTRAINT IF EXISTS "kitchen_meal_dispenses_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "leave_allowances" DROP CONSTRAINT IF EXISTS "leave_allowances_disbursedFromCustodyId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "market_price_benchmarks" DROP CONSTRAINT IF EXISTS "market_price_benchmarks_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "meal_surveys" DROP CONSTRAINT IF EXISTS "meal_surveys_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "meal_surveys" DROP CONSTRAINT IF EXISTS "meal_surveys_workerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "payroll_records" DROP CONSTRAINT IF EXISTS "payroll_records_payrollRunId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "payroll_runs" DROP CONSTRAINT IF EXISTS "payroll_runs_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "phosphate_extracts" DROP CONSTRAINT IF EXISTS "phosphate_extracts_projectId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "phosphate_production_slips" DROP CONSTRAINT IF EXISTS "phosphate_production_slips_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "recipes" DROP CONSTRAINT IF EXISTS "recipes_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "site_accommodation_assignments" DROP CONSTRAINT IF EXISTS "site_accommodation_assignments_accommodationId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "site_accommodation_assignments" DROP CONSTRAINT IF EXISTS "site_accommodation_assignments_workerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "site_accommodations" DROP CONSTRAINT IF EXISTS "site_accommodations_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "site_tasks" DROP CONSTRAINT IF EXISTS "site_tasks_assignedToWorkerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "site_tasks" DROP CONSTRAINT IF EXISTS "site_tasks_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "spare_parts_requests" DROP CONSTRAINT IF EXISTS "spare_parts_requests_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "spare_parts_requests" DROP CONSTRAINT IF EXISTS "spare_parts_requests_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "supplier_invoice_items" DROP CONSTRAINT IF EXISTS "supplier_invoice_items_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "supplier_invoices" DROP CONSTRAINT IF EXISTS "supplier_invoices_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "supplier_invoices" DROP CONSTRAINT IF EXISTS "supplier_invoices_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "supplier_invoices" DROP CONSTRAINT IF EXISTS "supplier_invoices_supplierId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "supplier_payments" DROP CONSTRAINT IF EXISTS "supplier_payments_disbursedFromCustodyId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "supplier_payments" DROP CONSTRAINT IF EXISTS "supplier_payments_disbursedFromTreasuryId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "supplier_payments" DROP CONSTRAINT IF EXISTS "supplier_payments_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "supplier_payments" DROP CONSTRAINT IF EXISTS "supplier_payments_supplierId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "users" DROP CONSTRAINT IF EXISTS "users_supplierId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "worker_expense_claims" DROP CONSTRAINT IF EXISTS "worker_expense_claims_payrollRecordId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "worker_expense_claims" DROP CONSTRAINT IF EXISTS "worker_expense_claims_settlementCustodyId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "worker_expense_claims" DROP CONSTRAINT IF EXISTS "worker_expense_claims_siteId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "worker_expense_claims" DROP CONSTRAINT IF EXISTS "worker_expense_claims_workerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "workers" DROP CONSTRAINT IF EXISTS "workers_canteenItemId_fkey";

-- AlterTable sites: add telegramTopicId safely if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sites' AND column_name = 'telegramTopicId'
  ) THEN
    ALTER TABLE "sites" ADD COLUMN "telegramTopicId" INTEGER;
  END IF;
END $$;

-- AlterTable users: add freezeBotAccessOnLeave safely if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'freezeBotAccessOnLeave'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "freezeBotAccessOnLeave" BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- AlterTable system_error_logs: add errorClass safely if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_error_logs' AND column_name = 'errorClass'
  ) THEN
    ALTER TABLE "system_error_logs" ADD COLUMN "errorClass" TEXT NOT NULL DEFAULT 'SYSTEM_ERROR';
  END IF;
END $$;

-- AlterTable worker_custom_allowances: add name column or rename title to name safely if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worker_custom_allowances' AND column_name = 'name'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'worker_custom_allowances' AND column_name = 'title'
    ) THEN
      ALTER TABLE "worker_custom_allowances" RENAME COLUMN "title" TO "name";
    ELSE
      ALTER TABLE "worker_custom_allowances" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'بدل مخصص';
    END IF;
  END IF;
END $$;

-- AlterTable system_error_logs: add resolved column safely if not exists (sync with isResolved)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_error_logs' AND column_name = 'resolved'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'system_error_logs' AND column_name = 'isResolved'
    ) THEN
      ALTER TABLE "system_error_logs" ADD COLUMN "resolved" BOOLEAN NOT NULL DEFAULT false;
      UPDATE "system_error_logs" SET "resolved" = "isResolved";
    ELSE
      ALTER TABLE "system_error_logs" ADD COLUMN "resolved" BOOLEAN NOT NULL DEFAULT false;
    END IF;
  END IF;
END $$;

-- AlterTable worker_custom_allowances: add effectiveAt column safely if not exists (sync with startDate)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worker_custom_allowances' AND column_name = 'effectiveAt'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'worker_custom_allowances' AND column_name = 'startDate'
    ) THEN
      ALTER TABLE "worker_custom_allowances" ADD COLUMN "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
      UPDATE "worker_custom_allowances" SET "effectiveAt" = "startDate";
    ELSE
      ALTER TABLE "worker_custom_allowances" ADD COLUMN "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
  END IF;
END $$;

-- AlterTable worker_custom_allowances: add expiresAt column safely if not exists (sync with endDate)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worker_custom_allowances' AND column_name = 'expiresAt'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'worker_custom_allowances' AND column_name = 'endDate'
    ) THEN
      ALTER TABLE "worker_custom_allowances" ADD COLUMN "expiresAt" TIMESTAMP(3);
      UPDATE "worker_custom_allowances" SET "expiresAt" = "endDate";
    ELSE
      ALTER TABLE "worker_custom_allowances" ADD COLUMN "expiresAt" TIMESTAMP(3);
    END IF;
  END IF;
END $$;

-- AlterTable system_error_logs: add firstSeenAt and resolutionNotes safely if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_error_logs' AND column_name = 'firstSeenAt'
  ) THEN
    ALTER TABLE "system_error_logs" ADD COLUMN "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    UPDATE "system_error_logs" SET "firstSeenAt" = "createdAt" WHERE "firstSeenAt" IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_error_logs' AND column_name = 'resolutionNotes'
  ) THEN
    ALTER TABLE "system_error_logs" ADD COLUMN "resolutionNotes" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_error_logs' AND column_name = 'contextPayload'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'system_error_logs' AND column_name = 'breadcrumbs'
    ) THEN
      ALTER TABLE "system_error_logs" ADD COLUMN "contextPayload" JSONB;
      UPDATE "system_error_logs" SET "contextPayload" = "breadcrumbs"::jsonb WHERE "breadcrumbs" IS NOT NULL;
    ELSE
      ALTER TABLE "system_error_logs" ADD COLUMN "contextPayload" JSONB;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_error_logs' AND column_name = 'resolvedBy'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'system_error_logs' AND column_name = 'resolvedById'
    ) THEN
      ALTER TABLE "system_error_logs" ADD COLUMN "resolvedBy" BIGINT;
      UPDATE "system_error_logs" SET "resolvedBy" = "resolvedById";
    ELSE
      ALTER TABLE "system_error_logs" ADD COLUMN "resolvedBy" BIGINT;
    END IF;
  END IF;
END $$;

-- AlterTable worker_custom_allowances: relax legacy columns startDate, allowanceType, updatedAt
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worker_custom_allowances' AND column_name = 'startDate'
  ) THEN
    ALTER TABLE "worker_custom_allowances" ALTER COLUMN "startDate" DROP NOT NULL;
    ALTER TABLE "worker_custom_allowances" ALTER COLUMN "startDate" SET DEFAULT CURRENT_TIMESTAMP;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worker_custom_allowances' AND column_name = 'allowanceType'
  ) THEN
    ALTER TABLE "worker_custom_allowances" ALTER COLUMN "allowanceType" DROP NOT NULL;
    ALTER TABLE "worker_custom_allowances" ALTER COLUMN "allowanceType" SET DEFAULT 'CUSTOM';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worker_custom_allowances' AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "worker_custom_allowances" ALTER COLUMN "updatedAt" DROP NOT NULL;
    ALTER TABLE "worker_custom_allowances" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- DropTable: Safely drop all 30 ghost models
DROP TABLE IF EXISTS "camp_food_items" CASCADE;
DROP TABLE IF EXISTS "canteen_item_price_histories" CASCADE;
DROP TABLE IF EXISTS "canteen_items" CASCADE;
DROP TABLE IF EXISTS "company_documents" CASCADE;
DROP TABLE IF EXISTS "company_treasuries" CASCADE;
DROP TABLE IF EXISTS "custody_expense_items" CASCADE;
DROP TABLE IF EXISTS "custody_settlements" CASCADE;
DROP TABLE IF EXISTS "dead_letter_events" CASCADE;
DROP TABLE IF EXISTS "duty_rosters" CASCADE;
DROP TABLE IF EXISTS "equipment_maintenances" CASCADE;
DROP TABLE IF EXISTS "equipments" CASCADE;
DROP TABLE IF EXISTS "financial_custodies" CASCADE;
DROP TABLE IF EXISTS "food_inbound_shipments" CASCADE;
DROP TABLE IF EXISTS "food_waste_logs" CASCADE;
DROP TABLE IF EXISTS "fuel_dispense_logs" CASCADE;
DROP TABLE IF EXISTS "fuel_tanks" CASCADE;
DROP TABLE IF EXISTS "hospitality_expenses" CASCADE;
DROP TABLE IF EXISTS "kitchen_meal_dispenses" CASCADE;
DROP TABLE IF EXISTS "market_price_benchmarks" CASCADE;
DROP TABLE IF EXISTS "meal_surveys" CASCADE;
DROP TABLE IF EXISTS "payroll_records" CASCADE;
DROP TABLE IF EXISTS "payroll_runs" CASCADE;
DROP TABLE IF EXISTS "phosphate_extracts" CASCADE;
DROP TABLE IF EXISTS "phosphate_production_slips" CASCADE;
DROP TABLE IF EXISTS "recipes" CASCADE;
DROP TABLE IF EXISTS "site_accommodation_assignments" CASCADE;
DROP TABLE IF EXISTS "site_accommodations" CASCADE;
DROP TABLE IF EXISTS "site_tasks" CASCADE;
DROP TABLE IF EXISTS "spare_parts_requests" CASCADE;
DROP TABLE IF EXISTS "supplier_invoice_items" CASCADE;
DROP TABLE IF EXISTS "supplier_invoices" CASCADE;
DROP TABLE IF EXISTS "supplier_payments" CASCADE;
DROP TABLE IF EXISTS "suppliers" CASCADE;
DROP TABLE IF EXISTS "worker_expense_claims" CASCADE;
