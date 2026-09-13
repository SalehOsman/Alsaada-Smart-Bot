-- PLAN-20: reconcile the deployed schema without discarding existing data.

-- Trace correlation for audit and incident records.
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "traceId" VARCHAR(36);

ALTER TABLE "system_error_logs"
  ADD COLUMN IF NOT EXISTS "traceId" VARCHAR(36),
  ADD COLUMN IF NOT EXISTS "service" TEXT NOT NULL DEFAULT 'bot-server';

-- Preserve legacy camelCase ledger hashes when reconciling them with Prisma mappings.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'financial_ledgers'
      AND column_name = 'recordHash'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'financial_ledgers'
      AND column_name = 'record_hash'
  ) THEN
    ALTER TABLE "financial_ledgers" RENAME COLUMN "recordHash" TO "record_hash";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'financial_ledgers'
      AND column_name = 'previousHash'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'financial_ledgers'
      AND column_name = 'previous_hash'
  ) THEN
    ALTER TABLE "financial_ledgers" RENAME COLUMN "previousHash" TO "previous_hash";
  END IF;
END $$;

ALTER TABLE "financial_ledgers"
  ADD COLUMN IF NOT EXISTS "record_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "previous_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "custody_expense_items"
  ADD COLUMN IF NOT EXISTS "record_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "previous_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "custody_settlements"
  ADD COLUMN IF NOT EXISTS "record_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "previous_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "hospitality_expenses"
  ADD COLUMN IF NOT EXISTS "record_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "previous_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "supplier_payments"
  ADD COLUMN IF NOT EXISTS "record_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "previous_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "worker_expense_claims"
  ADD COLUMN IF NOT EXISTS "record_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "previous_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Durable, cross-instance single-use claim for dashboard magic links.
CREATE TABLE IF NOT EXISTS "auth_magic_token_consumptions" (
  "id" TEXT NOT NULL,
  "jti" VARCHAR(128) NOT NULL,
  "actorTelegramId" BIGINT NOT NULL,
  "traceId" VARCHAR(36),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_magic_token_consumptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_magic_token_consumptions_jti_key"
  ON "auth_magic_token_consumptions"("jti");
CREATE INDEX IF NOT EXISTS "auth_magic_token_consumptions_expiresAt_idx"
  ON "auth_magic_token_consumptions"("expiresAt");
CREATE INDEX IF NOT EXISTS "auth_magic_token_consumptions_traceId_idx"
  ON "auth_magic_token_consumptions"("traceId");

CREATE INDEX IF NOT EXISTS "audit_logs_traceId_idx"
  ON "audit_logs"("traceId");
CREATE INDEX IF NOT EXISTS "system_error_logs_traceId_idx"
  ON "system_error_logs"("traceId");
CREATE INDEX IF NOT EXISTS "system_error_logs_service_createdAt_idx"
  ON "system_error_logs"("service", "createdAt");

CREATE INDEX IF NOT EXISTS "financial_ledgers_record_hash_idx"
  ON "financial_ledgers"("record_hash");
CREATE INDEX IF NOT EXISTS "financial_ledgers_previous_hash_idx"
  ON "financial_ledgers"("previous_hash");
CREATE INDEX IF NOT EXISTS "financial_ledgers_hash_timestamp_idx"
  ON "financial_ledgers"("hash_timestamp");

CREATE INDEX IF NOT EXISTS "custody_expense_items_record_hash_idx"
  ON "custody_expense_items"("record_hash");
CREATE INDEX IF NOT EXISTS "custody_expense_items_previous_hash_idx"
  ON "custody_expense_items"("previous_hash");
CREATE INDEX IF NOT EXISTS "custody_expense_items_hash_timestamp_idx"
  ON "custody_expense_items"("hash_timestamp");

CREATE INDEX IF NOT EXISTS "custody_settlements_record_hash_idx"
  ON "custody_settlements"("record_hash");
CREATE INDEX IF NOT EXISTS "custody_settlements_previous_hash_idx"
  ON "custody_settlements"("previous_hash");
CREATE INDEX IF NOT EXISTS "custody_settlements_hash_timestamp_idx"
  ON "custody_settlements"("hash_timestamp");

CREATE INDEX IF NOT EXISTS "hospitality_expenses_record_hash_idx"
  ON "hospitality_expenses"("record_hash");
CREATE INDEX IF NOT EXISTS "hospitality_expenses_previous_hash_idx"
  ON "hospitality_expenses"("previous_hash");
CREATE INDEX IF NOT EXISTS "hospitality_expenses_hash_timestamp_idx"
  ON "hospitality_expenses"("hash_timestamp");

CREATE INDEX IF NOT EXISTS "supplier_payments_record_hash_idx"
  ON "supplier_payments"("record_hash");
CREATE INDEX IF NOT EXISTS "supplier_payments_previous_hash_idx"
  ON "supplier_payments"("previous_hash");
CREATE INDEX IF NOT EXISTS "supplier_payments_hash_timestamp_idx"
  ON "supplier_payments"("hash_timestamp");

CREATE INDEX IF NOT EXISTS "worker_expense_claims_record_hash_idx"
  ON "worker_expense_claims"("record_hash");
CREATE INDEX IF NOT EXISTS "worker_expense_claims_previous_hash_idx"
  ON "worker_expense_claims"("previous_hash");
CREATE INDEX IF NOT EXISTS "worker_expense_claims_hash_timestamp_idx"
  ON "worker_expense_claims"("hash_timestamp");
