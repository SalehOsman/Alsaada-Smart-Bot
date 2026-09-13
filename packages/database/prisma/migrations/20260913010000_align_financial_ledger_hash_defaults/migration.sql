-- PLAN-20 follow-up: column renames preserve legacy constraints.
-- Align them with the nullable/default contract declared in schema.prisma.
ALTER TABLE "financial_ledgers"
  ALTER COLUMN "record_hash" SET DEFAULT '',
  ALTER COLUMN "previous_hash" DROP NOT NULL;
