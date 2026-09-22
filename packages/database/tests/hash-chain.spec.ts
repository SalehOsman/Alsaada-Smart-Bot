import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  computeRecordHash,
  computeTransactionHash,
  verifyLedgerChain,
  GENESIS_HASH,
  type ChainedRecord,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

describe('Cryptographic Hash-Chain Ledger Engine', () => {
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

  describe('Canonical Record Hash Computation', () => {
    it('01: computes exact SHA-256 recordHash matching canonical specification', () => {
      // Arrange
      const payload = {
        previousHash: GENESIS_HASH,
        voucherNumber: '#ADV-2026-0001',
        transactionType: 'ADVANCE_CASH',
        amount: 5000,
        currency: 'EGP',
        sourceAccount: 'MAIN_TREASURY',
        destinationAccount: 'WORKER_001',
        beneficiaryId: 'w-1',
        actorTelegramId: '123456789',
        timestamp: '2026-09-11T10:00:00.000Z',
      };
      const expectedCanonicalString = `${GENESIS_HASH}:#ADV-2026-0001:ADVANCE_CASH:5000.00:EGP:MAIN_TREASURY:WORKER_001:w-1:123456789:2026-09-11T10:00:00.000Z`;
      const expectedHash = crypto.createHash('sha256').update(expectedCanonicalString).digest('hex');

      // Act
      const hash = computeRecordHash(payload);

      // Assert
      expect(hash).toBe(expectedHash);
      expect(hash).toHaveLength(64);
      expect(hash).not.toBe('');
    });

    it('02: normalizes numerical amounts to exactly two decimal places', () => {
      // Arrange
      const testDate = PINNED_BASE_TIME;
      const inputWithInt = {
        previousHash: 'prev-hash-1',
        model: 'SupplierPayment',
        amount: 250,
        actorId: 'user-01',
        timestamp: testDate,
      };
      const inputWithString = {
        previousHash: 'prev-hash-1',
        model: 'SupplierPayment',
        amount: '250.00',
        actorId: 'user-01',
        timestamp: testDate,
      };

      // Act
      const hash1 = computeRecordHash(inputWithInt);
      const hash2 = computeRecordHash(inputWithString);

      // Assert
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('03: falls back to GENESIS_HASH when previousHash is empty', () => {
      // Arrange
      const testDate = PINNED_BASE_TIME;
      const inputEmpty = {
        previousHash: '',
        model: 'CustodyExpenseItem',
        amount: 100,
        actorId: 'custodian-01',
        timestamp: testDate,
      };
      const inputGenesis = {
        previousHash: GENESIS_HASH,
        model: 'CustodyExpenseItem',
        amount: 100,
        actorId: 'custodian-01',
        timestamp: testDate,
      };

      // Act
      const hashWithEmpty = computeRecordHash(inputEmpty);
      const hashWithGenesis = computeRecordHash(inputGenesis);

      // Assert
      expect(hashWithEmpty).toBe(hashWithGenesis);
      expect(hashWithEmpty).toHaveLength(64);
    });

    it('04: produces distinct hashes for different models with otherwise identical values', () => {
      // Arrange
      const basePayload = {
        previousHash: 'prev-hash',
        amount: 1500,
        actorId: 'actor-99',
        timestamp: '2026-09-11T14:00:00.000Z',
      };

      // Act
      const ledgerHash = computeRecordHash({ ...basePayload, model: 'FinancialLedger' });
      const supplierHash = computeRecordHash({ ...basePayload, model: 'SupplierPayment' });

      // Assert
      expect(ledgerHash).not.toBe(supplierHash);
      expect(ledgerHash).toHaveLength(64);
      expect(supplierHash).toHaveLength(64);
    });
  });

  describe('Legacy computeTransactionHash Compatibility', () => {
    it('05: computes pipe-separated SHA-256 hash matching legacy security tests', () => {
      // Arrange
      const payload = {
        id: 'TXN-999',
        previousHash: GENESIS_HASH,
        timestamp: '2026-09-11T10:00:00.000Z',
        amount: 3200,
        currency: 'EGP',
        transactionType: 'SALARY_PAYOUT',
        sourceAccount: 'MAIN_TREASURY',
        destinationAccount: 'WORKER_001',
        actorTelegramId: '987654321',
      };

      // Act
      const hash = computeTransactionHash(payload);
      const record: ChainedRecord = { ...payload, recordHash: hash };
      const result = verifyLedgerChain([record], GENESIS_HASH);

      // Assert
      expect(hash).toHaveLength(64);
      expect(result.isValid).toBe(true);
      expect(result.totalVerified).toBe(1);
    });

    it('06: detects broken hash chain when payload recordHash is falsified', () => {
      // Arrange
      const payload = {
        id: 'TXN-001',
        previousHash: GENESIS_HASH,
        timestamp: '2026-09-11T10:00:00.000Z',
        amount: 1000,
        currency: 'EGP',
        transactionType: 'ADVANCE',
        sourceAccount: 'MAIN_TREASURY',
        destinationAccount: 'WORKER_001',
        actorTelegramId: '111',
        recordHash: 'TAMPERED_FRAUDULENT_HASH_VALUE_00000000000000000000000000000000000',
      };

      // Act
      const result = verifyLedgerChain([payload], GENESIS_HASH);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.brokenRecordId).toBe('TXN-001');
    });
  });
});
