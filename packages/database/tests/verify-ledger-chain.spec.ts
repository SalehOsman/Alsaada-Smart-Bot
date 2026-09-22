import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  verifyLedgerChainDb,
  assertLedgerChainIntegrity,
  CorruptedLedgerChainError,
  computeRecordHash,
  GENESIS_HASH,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

describe('verifyLedgerChain (Database Audit)', () => {
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

  function buildDeterministicChain(count: number, tamperIndex?: number, tamperType?: 'amount' | 'link') {
    const records: Array<Record<string, any>> = [];
    let currentPrev = GENESIS_HASH;

    for (let i = 0; i < count; i++) {
      const id = `TXN-${i + 1}`;
      const timestamp = new Date(`2026-09-11T10:${i < 10 ? '0' + i : i}:00.000Z`);
      let amount = 1000 * (i + 1);
      let prev = currentPrev;

      if (tamperIndex === i && tamperType === 'link') {
        prev = 'corrupted-previous-hash';
      }

      let hash = computeRecordHash({
        previousHash: prev,
        voucherNumber: `#ADV-2026-${i + 1}`,
        model: 'FinancialLedger',
        amount,
        actorId: '123456789',
        timestamp,
      });

      if (tamperIndex === i && tamperType === 'amount') {
        // Direct SQL attacker modifies the amount in the database
        amount = 99999;
      }

      const rec = {
        id,
        voucherNumber: `#ADV-2026-${i + 1}`,
        recordHash: hash,
        previousHash: prev,
        hashTimestamp: timestamp,
        createdAt: timestamp,
        amount,
        actorTelegramId: '123456789',
      };

      records.push(rec);
      currentPrev = hash;
    }

    return records;
  }

  function createMockAuditPrisma(records: Array<Record<string, any>>) {
    return {
      financialLedger: {
        findMany: vi.fn(async (args: any) => {
          let filtered = [...records];
          if (args?.cursor?.id) {
            const cursorIdx = filtered.findIndex((r) => r.id === args.cursor.id);
            if (cursorIdx !== -1) {
              filtered = filtered.slice(cursorIdx + 1);
            }
          }
          if (args?.take) {
            filtered = filtered.slice(0, args.take);
          }
          return filtered;
        }),
      },
    };
  }

  it('successfully verifies a valid cryptographic chain', async () => {
    // Arrange
    const records = buildDeterministicChain(5);
    const mockPrisma = createMockAuditPrisma(records);

    // Act
    const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });

    // Assert
    expect(report.isValid).toBe(true);
    expect(report.totalVerified).toBe(5);
    expect(report.brokenRecordId).toBeUndefined();
    expect(report.error).toBeUndefined();
  });

  it('detects direct database tampering of the amount field', async () => {
    // Arrange
    const records = buildDeterministicChain(4, 2, 'amount');
    const mockPrisma = createMockAuditPrisma(records);

    // Act
    const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });

    // Assert
    expect(report.isValid).toBe(false);
    expect(report.brokenRecordId).toBe('TXN-3');
    expect(report.tamperedField).toBe('recordHash');
    expect(report.error).toContain('Tampered record detected');
  });

  it('detects broken chain link when previousHash is tampered with or row is deleted', async () => {
    // Arrange
    const records = buildDeterministicChain(4, 1, 'link');
    const mockPrisma = createMockAuditPrisma(records);

    // Act
    const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });

    // Assert
    expect(report.isValid).toBe(false);
    expect(report.brokenRecordId).toBe('TXN-2');
    expect(report.tamperedField).toBe('previousHash');
    expect(report.error).toContain('Broken chain link');
  });

  it('assertLedgerChainIntegrity throws CorruptedLedgerChainError on broken chain', async () => {
    // Arrange
    const records = buildDeterministicChain(3, 1, 'amount');
    const mockPrisma = createMockAuditPrisma(records);

    // Act
    const verifyAction = () => assertLedgerChainIntegrity(mockPrisma, { model: 'FinancialLedger' });

    // Assert
    await expect(verifyAction()).rejects.toThrow(CorruptedLedgerChainError);
  });

  it('paginates across batches with cursor pagination', async () => {
    // Arrange
    const records = buildDeterministicChain(10);
    const mockPrisma = createMockAuditPrisma(records);

    // Act
    const report = await verifyLedgerChainDb(mockPrisma, {
      model: 'FinancialLedger',
      batchSize: 3,
    });

    // Assert
    expect(report.isValid).toBe(true);
    expect(report.totalVerified).toBe(10);
    expect(report.brokenRecordId).toBeUndefined();
    // 10 items with batch size 3 requires 4 queries (3 + 3 + 3 + 1)
    expect(mockPrisma.financialLedger.findMany).toHaveBeenCalledTimes(4);
  });

  it('supports custom genesisHash for sub-ledger chains', async () => {
    // Arrange
    const customGenesis = 'CUSTOM_GENESIS_CHAIN_2026';
    const timestamp = new Date('2026-09-12T10:00:00.000Z');
    const hash = computeRecordHash({
      previousHash: customGenesis,
      voucherNumber: '#SUB-001',
      model: 'FinancialLedger',
      amount: 500,
      actorId: '123456789',
      timestamp,
    });

    const records = [
      {
        id: 'TXN-CUSTOM-1',
        voucherNumber: '#SUB-001',
        recordHash: hash,
        previousHash: customGenesis,
        hashTimestamp: timestamp,
        createdAt: timestamp,
        amount: 500,
        actorTelegramId: '123456789',
      },
    ];

    const mockPrisma = createMockAuditPrisma(records);

    // Act
    const report = await verifyLedgerChainDb(mockPrisma, {
      model: 'FinancialLedger',
      genesisHash: customGenesis,
    });

    // Assert
    expect(report.isValid).toBe(true);
    expect(report.totalVerified).toBe(1);
    expect(report.genesisHash).toBe(customGenesis);
    expect(report.brokenRecordId).toBeUndefined();
  });
});
