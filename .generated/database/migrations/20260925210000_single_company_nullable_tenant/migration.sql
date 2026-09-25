-- Migration to support Single-Company consolidation (Work Plan 110 & 112)
-- Make tenantId nullable across legacy tables to prevent insert failures without data loss

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'tenantId') THEN
    ALTER TABLE "projects" ALTER COLUMN "tenantId" DROP NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_profiles' AND column_name = 'tenantId') THEN
    ALTER TABLE "company_profiles" ALTER COLUMN "tenantId" DROP NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_documents' AND column_name = 'tenantId') THEN
    ALTER TABLE "company_documents" ALTER COLUMN "tenantId" DROP NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_treasuries' AND column_name = 'tenantId') THEN
    ALTER TABLE "company_treasuries" ALTER COLUMN "tenantId" DROP NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'worker_expense_claims' AND column_name = 'tenantId') THEN
    ALTER TABLE "worker_expense_claims" ALTER COLUMN "tenantId" DROP NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'tenantId') THEN
    ALTER TABLE "suppliers" ALTER COLUMN "tenantId" DROP NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipments' AND column_name = 'tenantId') THEN
    ALTER TABLE "equipments" ALTER COLUMN "tenantId" DROP NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_runs' AND column_name = 'tenantId') THEN
    ALTER TABLE "payroll_runs" ALTER COLUMN "tenantId" DROP NOT NULL;
  END IF;
END $$;
