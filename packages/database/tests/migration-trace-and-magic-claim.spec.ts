import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma, disconnectDatabase } from '../src/client.js';

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

let uuidCounter = 0;
function deterministicUuid(): string {
  uuidCounter++;
  return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
}

const canConnect = async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

type ColumnRow = { table_name: string; column_name: string };
type ColumnDefinitionRow = {
  column_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
};

describe('Audit Traceability, Hash Ledger & Dashboard Auth Claim Contract', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('contains every trace and financial hash column required by the Prisma schema', async () => {
    // Arrange
    const isConnected = await canConnect();
    if (!isConnected) {
      return;
    }

    const expectedColumns = [
      'audit_logs.traceId',
      'system_error_logs.traceId',
      'system_error_logs.service',
      'financial_ledgers.record_hash',
      'financial_ledgers.previous_hash',
      'financial_ledgers.hash_timestamp',
    ];

    // Act
    const columns = await prisma.$queryRawUnsafe<ColumnRow[]>(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('audit_logs','system_error_logs','financial_ledgers')",
    );
    const actual = new Set(
      columns.map(({ table_name, column_name }) => [table_name, column_name].join('.')),
    );

    // Assert
    for (const col of expectedColumns) {
      expect(actual.has(col)).toBe(true);
    }
    expect(actual.has('financial_ledgers.non_existent_column_sentinel')).toBe(false);

    // Verify purged models per Work Plan 117 are archived in deprecated-models registry
    const deprecatedRegistry = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/schemas/deprecated-models.json'), 'utf-8'));
    const purgedModels = ['CustodyExpenseItem', 'CustodySettlement', 'HospitalityExpense', 'SupplierPayment', 'WorkerExpenseClaim'];
    const registeredModelNames = new Set((deprecatedRegistry.models || []).map((m: any) => m.model));
    for (const model of purgedModels) {
      expect(registeredModelNames.has(model)).toBe(true);
    }
  });

  it('matches Prisma nullability and defaults for financial ledger hash columns', async () => {
    // Arrange
    const isConnected = await canConnect();
    if (!isConnected) return;

    // Act
    const columns = await prisma.$queryRawUnsafe<ColumnDefinitionRow[]>(
      "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_ledgers' AND column_name IN ('record_hash', 'previous_hash', 'hash_timestamp')",
    );
    const actual = new Map(columns.map((column) => [column.column_name, column]));

    // Assert
    expect(actual.get('record_hash')?.is_nullable).toBe('NO');
    expect(actual.get('record_hash')?.column_default).toBe("''::text");
    expect(actual.get('previous_hash')?.is_nullable).toBe('YES');
    expect(actual.get('hash_timestamp')?.is_nullable).toBe('NO');
    expect(actual.get('hash_timestamp')?.column_default).toBe('CURRENT_TIMESTAMP');
    expect(actual.has('non_existent_column')).toBe(false);
  });

  it('persists a traceable incident and enforces one durable claim per auth-link JTI', async () => {
    // Arrange
    const isConnected = await canConnect();
    if (!isConnected) return;

    const jti = ['auth-claim', deterministicUuid()].join('-');
    const jtiHash = createHash('sha256').update(jti).digest('hex');
    const traceId = deterministicUuid();
    const errorReference = `ERR-DASHBOARD-AUTH-${deterministicUuid()}`;

    // Act
    const errorLog = await prisma.systemErrorLog.create({
      data: {
        traceId,
        service: 'admin-dashboard',
        errorReference,
        errorHash: createHash('sha256').update(errorReference).digest('hex'),
        errorClass: 'TestError',
        errorMessage: 'sanitized test incident',
      },
    });

    const groupId = deterministicUuid();
    const link = await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        jtiHash,
        actorTelegramId: 1n,
        targetOrigin: 'http://localhost:3002',
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 60_000),
      },
    });

    const duplicateClaimPromise = prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        jtiHash,
        actorTelegramId: 1n,
        targetOrigin: 'http://localhost:3002',
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 60_000),
      },
    });

    // Assert
    expect(errorLog.traceId).toBe(traceId);
    expect(errorLog.service).toBe('admin-dashboard');
    expect(errorLog.errorMessage).toBe('sanitized test incident');
    expect(link.groupId).toBe(groupId);
    expect(link.jtiHash).toBe(jtiHash);
    expect(link.originKind).toBe('LOCAL');
    expect(link.claimedAt).toBeNull();
    await expect(duplicateClaimPromise).rejects.toMatchObject({ code: 'P2002' });

    // Cleanup
    await prisma.dashboardAuthLink.deleteMany({ where: { jtiHash } });
    await prisma.systemErrorLog.deleteMany({ where: { traceId } });
  });
});
