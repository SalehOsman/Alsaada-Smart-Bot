-- Migration: 20260916000000_telemetry_bot_performance_columns
-- Compliance: Plan 35/36 Telemetry Bot Performance APM Columns

-- AlterTable
ALTER TABLE "bot_performance_logs" ADD COLUMN IF NOT EXISTS "cacheSource" VARCHAR(20) DEFAULT 'DB_QUERY';
ALTER TABLE "bot_performance_logs" ADD COLUMN IF NOT EXISTS "flowId" VARCHAR(50);
ALTER TABLE "bot_performance_logs" ADD COLUMN IF NOT EXISTS "internalExecutionTimeMs" INTEGER;
ALTER TABLE "bot_performance_logs" ADD COLUMN IF NOT EXISTS "module" VARCHAR(50);
ALTER TABLE "bot_performance_logs" ADD COLUMN IF NOT EXISTS "telegramNetworkTimeMs" INTEGER;
ALTER TABLE "bot_performance_logs" ADD COLUMN IF NOT EXISTS "traceId" VARCHAR(36);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bot_performance_logs_module_timestamp_idx" ON "bot_performance_logs"("module", "timestamp");
