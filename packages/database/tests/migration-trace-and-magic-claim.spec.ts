import { createHash, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/client/index.js';

const integrationEnabled = process.env.PLAN20_DATABASE_INTEGRATION === '1';
const prisma = new PrismaClient();

type ColumnRow = { table_name: string; column_name: string };
type ColumnDefinitionRow = {
  column_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
};

describe.runIf(integrationEnabled)('PLAN-20 database migration contract', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('contains every trace and financial hash column required by the Prisma schema', async () => {
    const columns = await prisma.$queryRawUnsafe<ColumnRow[]>(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('audit_logs','system_error_logs','financial_ledgers','custody_expense_items','custody_settlements','hospitality_expenses','supplier_payments','worker_expense_claims')",
    );

    const actual = new Set(
      columns.map(({ table_name, column_name }) => [table_name, column_name].join('.')),
    );
    const expected = [
      'audit_logs.traceId',
      'system_error_logs.traceId',
      'system_error_logs.service',
      'financial_ledgers.record_hash',
      'financial_ledgers.previous_hash',
      'financial_ledgers.hash_timestamp',
      'custody_expense_items.record_hash',
      'custody_expense_items.previous_hash',
      'custody_expense_items.hash_timestamp',
      'custody_settlements.record_hash',
      'custody_settlements.previous_hash',
      'custody_settlements.hash_timestamp',
      'hospitality_expenses.record_hash',
      'hospitality_expenses.previous_hash',
      'hospitality_expenses.hash_timestamp',
      'supplier_payments.record_hash',
      'supplier_payments.previous_hash',
      'supplier_payments.hash_timestamp',
      'worker_expense_claims.record_hash',
      'worker_expense_claims.previous_hash',
      'worker_expense_claims.hash_timestamp',
    ];

    expect(expected.filter((column) => !actual.has(column))).toEqual([]);
  });

  it('matches Prisma nullability and defaults for financial ledger hash columns', async () => {
    const columns = await prisma.$queryRawUnsafe<ColumnDefinitionRow[]>(
      "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_ledgers' AND column_name IN ('record_hash', 'previous_hash', 'hash_timestamp')",
    );
    const actual = new Map(columns.map((column) => [column.column_name, column]));

    expect(actual.get('record_hash')).toMatchObject({ is_nullable: 'NO' });
    expect(actual.get('record_hash')?.column_default).toBe("''::text");
    expect(actual.get('previous_hash')).toMatchObject({ is_nullable: 'YES' });
    expect(actual.get('hash_timestamp')).toMatchObject({ is_nullable: 'NO' });
    expect(actual.get('hash_timestamp')?.column_default).toBe('CURRENT_TIMESTAMP');
  });

  it('persists a traceable incident and enforces one durable claim per auth-link JTI', async () => {
    const jti = ['plan21', randomUUID()].join('-');
    const jtiHash = createHash('sha256').update(jti).digest('hex');
    const traceId = randomUUID();
    const errorReference = `ERR-PLAN21-${randomUUID()}`;

    await prisma.systemErrorLog.create({
      data: {
        traceId,
        service: 'admin-dashboard',
        errorReference,
        errorHash: createHash('sha256').update(errorReference).digest('hex'),
        errorMessage: 'sanitized test incident',
      },
    });

    await prisma.dashboardAuthLink.create({
      data: {
        jtiHash,
        actorTelegramId: 1n,
        targetOrigin: 'LOCAL',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(
      prisma.dashboardAuthLink.create({
        data: {
          jtiHash,
          actorTelegramId: 1n,
          targetOrigin: 'LOCAL',
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
