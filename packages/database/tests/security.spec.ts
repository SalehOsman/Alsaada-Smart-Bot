import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  encryptField,
  decryptField,
  normalizeKeyToHex,
  createBlindIndex,
  computeTransactionHash,
  verifyLedgerChain,
  type ChainedRecord,
} from '../src/index.js';

describe('@alsaada/database security', () => {
  const testKey = crypto.randomBytes(32).toString('hex');
  const testSalt = 'alsaada_secret_salt_2026';

  describe('Application-Level Field Encryption (AES-256-GCM)', () => {
    it('encrypts and decrypts sensitive values accurately', () => {
      const nationalId = '29505151201531';
      const encrypted = encryptField(nationalId, testKey);

      expect(encrypted).not.toBe(nationalId);
      expect(encrypted.split(':')).toHaveLength(3);

      const decrypted = decryptField(encrypted, testKey);
      expect(decrypted).toBe(nationalId);
    });

    it('generates different ciphertexts for the same plaintext due to random IV', () => {
      const plaintext = '01012345678';
      const cipher1 = encryptField(plaintext, testKey);
      const cipher2 = encryptField(plaintext, testKey);

      expect(cipher1).not.toBe(cipher2);
      expect(decryptField(cipher1, testKey)).toBe(plaintext);
      expect(decryptField(cipher2, testKey)).toBe(plaintext);
    });

    it('fails decryption when ciphertext or authTag is tampered with', () => {
      const encrypted = encryptField('secret_financial_data', testKey);
      const parts = encrypted.split(':');
      // Tamper with ciphertext
      parts[2] = 'ff' + parts[2]!.substring(2);
      const tampered = parts.join(':');

      expect(() => decryptField(tampered, testKey)).toThrow();
    });

    it('normalizes 64-hex keys and passphrase keys properly', () => {
      const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      expect(normalizeKeyToHex(hexKey)).toBe(hexKey);

      const passphrase = 'my-secret-passphrase';
      const expectedSha256 = crypto.createHash('sha256').update(passphrase).digest('hex');
      expect(normalizeKeyToHex(passphrase)).toBe(expectedSha256);
      expect(normalizeKeyToHex(passphrase)).toHaveLength(64);

      expect(() => normalizeKeyToHex('')).toThrow('Cannot normalize empty encryption key.');
    });
  });

  describe('Blind Indexing (HMAC-SHA256)', () => {
    it('generates deterministic hashes for fast encrypted search', () => {
      const hash1 = createBlindIndex('29505151201531', testSalt);
      const hash2 = createBlindIndex('29505151201531', testSalt);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // 32 bytes hex
    });

    it('normalizes whitespace and case for consistent querying', () => {
      const hash1 = createBlindIndex('admin@alsaada.com', testSalt);
      const hash2 = createBlindIndex('  ADMIN@ALSAADA.COM  ', testSalt);

      expect(hash1).toBe(hash2);
    });
  });

  describe('Cryptographic Financial Hash Chaining', () => {
    const genesisHash = 'GENESIS_ALSAADA_LEDGER_2026';

    function createSampleChain(): ChainedRecord[] {
      const record1Payload = {
        id: 'TXN-001',
        previousHash: genesisHash,
        timestamp: '2026-09-07T10:00:00.000Z',
        amount: 5000,
        currency: 'EGP',
        transactionType: 'ADVANCE',
        sourceAccount: 'CUSTODY_SITE_A',
        destinationAccount: 'WORKER_101',
        actorTelegramId: '123456789',
      };
      const record1Hash = computeTransactionHash(record1Payload);
      const record1: ChainedRecord = { ...record1Payload, recordHash: record1Hash };

      const record2Payload = {
        id: 'TXN-002',
        previousHash: record1Hash,
        timestamp: '2026-09-07T11:00:00.000Z',
        amount: 2500,
        currency: 'EGP',
        transactionType: 'EXPENSE_CANTEEN',
        sourceAccount: 'CUSTODY_SITE_A',
        destinationAccount: 'SUPPLIER_CANTEEN',
        actorTelegramId: '123456789',
      };
      const record2Hash = computeTransactionHash(record2Payload);
      const record2: ChainedRecord = { ...record2Payload, recordHash: record2Hash };

      return [record1, record2];
    }

    it('validates an untampered ledger chain', () => {
      const chain = createSampleChain();
      const result = verifyLedgerChain(chain, genesisHash);

      expect(result.isValid).toBe(true);
      expect(result.totalVerified).toBe(2);
    });

    it('detects tampering when an amount is illegally modified directly in the database', () => {
      const chain = createSampleChain();
      // An attacker edits the amount from 5000 to 1000 in the DB directly
      chain[0]!.amount = 1000;

      const result = verifyLedgerChain(chain, genesisHash);
      expect(result.isValid).toBe(false);
      expect(result.brokenRecordId).toBe('TXN-001');
      expect(result.error).toContain('Tampered record detected');
    });

    it('detects broken links when a record is deleted or reordered', () => {
      const chain = createSampleChain();
      // Record 1 was deleted, leaving Record 2 pointing to non-existent previousHash
      const brokenChain = [chain[1]!];

      const result = verifyLedgerChain(brokenChain, genesisHash);
      expect(result.isValid).toBe(false);
      expect(result.brokenRecordId).toBe('TXN-002');
      expect(result.error).toContain('Broken chain link');
    });
  });
});
