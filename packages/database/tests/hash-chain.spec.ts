import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  computeRecordHash,
  computeTransactionHash,
  verifyLedgerChain,
  GENESIS_HASH,
  type ChainedRecord,
} from '../src/index.js';

describe('Cryptographic Hash-Chain Ledger Engine', () => {
  describe('Canonical Record Hash Computation', () => {
    it('computes exact SHA-256 recordHash matching canonical specification', () => {
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

      const hash = computeRecordHash(payload);
      const expectedCanonicalString = `${GENESIS_HASH}:#ADV-2026-0001:ADVANCE_CASH:5000.00:EGP:MAIN_TREASURY:WORKER_001:w-1:123456789:2026-09-11T10:00:00.000Z`;
      const expectedHash = crypto.createHash('sha256').update(expectedCanonicalString).digest('hex');

      expect(hash).toBe(expectedHash);
      expect(hash).toHaveLength(64);
    });

    it('normalizes numerical amounts to exactly two decimal places', () => {
      const date = new Date('2026-09-11T12:00:00Z');
      const hash1 = computeRecordHash({
        previousHash: 'prev-hash-1',
        model: 'SupplierPayment',
        amount: 250,
        actorId: 'user-01',
        timestamp: date,
      });

      const hash2 = computeRecordHash({
        previousHash: 'prev-hash-1',
        model: 'SupplierPayment',
        amount: '250.00',
        actorId: 'user-01',
        timestamp: date,
      });

      expect(hash1).toBe(hash2);
    });

    it('falls back to GENESIS_HASH when previousHash is empty', () => {
      const date = new Date('2026-09-11T12:00:00Z');
      const hashWithEmpty = computeRecordHash({
        previousHash: '',
        model: 'CustodyExpenseItem',
        amount: 100,
        actorId: 'custodian-01',
        timestamp: date,
      });

      const hashWithGenesis = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'CustodyExpenseItem',
        amount: 100,
        actorId: 'custodian-01',
        timestamp: date,
      });

      expect(hashWithEmpty).toBe(hashWithGenesis);
    });

    it('produces distinct hashes for different models with otherwise identical values', () => {
      const base = {
        previousHash: 'prev-hash',
        amount: 1500,
        actorId: 'actor-99',
        timestamp: '2026-09-11T14:00:00.000Z',
      };

      const ledgerHash = computeRecordHash({ ...base, model: 'FinancialLedger' });
      const supplierHash = computeRecordHash({ ...base, model: 'SupplierPayment' });

      expect(ledgerHash).not.toBe(supplierHash);
    });
  });

  describe('Legacy computeTransactionHash Compatibility', () => {
    it('computes pipe-separated SHA-256 hash matching legacy security tests', () => {
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

      const hash = computeTransactionHash(payload);
      expect(hash).toHaveLength(64);

      const record: ChainedRecord = { ...payload, recordHash: hash };
      const result = verifyLedgerChain([record], GENESIS_HASH);
      expect(result.isValid).toBe(true);
      expect(result.totalVerified).toBe(1);
    });
  });
});
