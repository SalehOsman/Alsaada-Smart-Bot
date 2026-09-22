import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

describe('@alsaada/database security', () => {
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const testSalt = 'alsaada_secret_salt_2026';

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

  describe('Application-Level Field Encryption (AES-256-GCM)', () => {
    it('encrypts and decrypts sensitive values accurately', () => {
      // Arrange
      const nationalId = '29505151201531';

      // Act
      const encrypted = encryptField(nationalId, testKey);
      const decrypted = decryptField(encrypted, testKey);

      // Assert
      expect(encrypted).not.toBe(nationalId);
      expect(encrypted.split(':')).toHaveLength(3);
      expect(decrypted).toBe(nationalId);
    });

    it('generates different ciphertexts for the same plaintext due to random IV', () => {
      // Arrange
      const plaintext = '01012345678';

      // Act
      const cipher1 = encryptField(plaintext, testKey);
      const cipher2 = encryptField(plaintext, testKey);
      const decrypted1 = decryptField(cipher1, testKey);
      const decrypted2 = decryptField(cipher2, testKey);

      // Assert
      expect(cipher1).not.toBe(cipher2);
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('fails decryption when ciphertext or authTag is tampered with', () => {
      // Arrange
      const encrypted = encryptField('secret_financial_data', testKey);
      const parts = encrypted.split(':');

      const tamperedCipherParts = [...parts];
      tamperedCipherParts[2] =
        (tamperedCipherParts[2]![0] === '0' ? '1' : '0') + tamperedCipherParts[2]!.slice(1);

      const tamperedTagParts = [...parts];
      tamperedTagParts[1] =
        (tamperedTagParts[1]![0] === '0' ? '1' : '0') + tamperedTagParts[1]!.slice(1);

      const tamperedIvParts = [...parts];
      tamperedIvParts[0] =
        (tamperedIvParts[0]![0] === '0' ? '1' : '0') + tamperedIvParts[0]!.slice(1);

      // Act
      const decryptCipher = () => decryptField(tamperedCipherParts.join(':'), testKey);
      const decryptTag = () => decryptField(tamperedTagParts.join(':'), testKey);
      const decryptIv = () => decryptField(tamperedIvParts.join(':'), testKey);

      // Assert
      expect(decryptCipher).toThrow();
      expect(decryptTag).toThrow();
      expect(decryptIv).toThrow();
    });

    it('fails decryption when payload format is invalid or parts are missing', () => {
      // Arrange
      const invalidSingle = 'invalid_single_part';
      const invalidTwoParts = 'part1:part2';
      const invalidFourParts = 'part1:part2:part3:part4';

      // Act
      const decryptSingle = () => decryptField(invalidSingle, testKey);
      const decryptTwo = () => decryptField(invalidTwoParts, testKey);
      const decryptFour = () => decryptField(invalidFourParts, testKey);

      // Assert
      expect(decryptSingle).toThrow(
        'Invalid encrypted payload format: expected iv:authTag:ciphertext'
      );
      expect(decryptTwo).toThrow(
        'Invalid encrypted payload format: expected iv:authTag:ciphertext'
      );
      expect(decryptFour).toThrow(
        'Invalid encrypted payload format: expected iv:authTag:ciphertext'
      );
    });

    it('returns empty string when encrypting or decrypting empty or falsy values', () => {
      // Arrange
      const emptyInput = '';

      // Act
      const encryptedEmpty = encryptField(emptyInput, testKey);
      const decryptedEmpty = decryptField(emptyInput, testKey);

      // Assert
      expect(encryptedEmpty).toBe('');
      expect(decryptedEmpty).toBe('');
      expect(encryptedEmpty).not.toBe('some_data');
    });

    it('fails encryption when key length is not 32 bytes', () => {
      // Arrange
      const shortKey = '0123456789abcdef0123456789abcdef';

      // Act
      const encryptAction = () => encryptField('secret_financial_data', shortKey);

      // Assert
      expect(encryptAction).toThrow(
        'Invalid encryption key length: expected 32 bytes (64 hex characters), got 16 bytes'
      );
    });

    it('normalizes 64-hex keys and passphrase keys properly', () => {
      // Arrange
      const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const passphrase = 'my-secret-passphrase';
      const expectedSha256 = crypto.createHash('sha256').update(passphrase).digest('hex');

      // Act
      const normalizedHex = normalizeKeyToHex(hexKey);
      const normalizedPassphrase = normalizeKeyToHex(passphrase);
      const emptyAction = () => normalizeKeyToHex('');

      // Assert
      expect(normalizedHex).toBe(hexKey);
      expect(normalizedPassphrase).toBe(expectedSha256);
      expect(normalizedPassphrase).toHaveLength(64);
      expect(emptyAction).toThrow('Cannot normalize empty encryption key.');
    });
  });

  describe('Blind Indexing (HMAC-SHA256)', () => {
    it('generates deterministic hashes for fast encrypted search', () => {
      // Arrange
      const sensitiveValue = '29505151201531';

      // Act
      const hash1 = createBlindIndex(sensitiveValue, testSalt);
      const hash2 = createBlindIndex(sensitiveValue, testSalt);

      // Assert
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).not.toBe(sensitiveValue);
    });

    it('normalizes whitespace and case for consistent querying', () => {
      // Arrange
      const emailLower = 'admin@alsaada.com';
      const emailSpaced = '  ADMIN@ALSAADA.COM  ';

      // Act
      const hash1 = createBlindIndex(emailLower, testSalt);
      const hash2 = createBlindIndex(emailSpaced, testSalt);

      // Assert
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe('');
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
      // Arrange
      const chain = createSampleChain();

      // Act
      const result = verifyLedgerChain(chain, genesisHash);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.totalVerified).toBe(2);
      expect(result.brokenRecordId).toBeUndefined();
    });

    it('detects tampering when an amount is illegally modified directly in the database', () => {
      // Arrange
      const chain = createSampleChain();
      chain[0]!.amount = 1000;

      // Act
      const result = verifyLedgerChain(chain, genesisHash);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.brokenRecordId).toBe('TXN-001');
      expect(result.error).toContain('Tampered record detected');
    });

    it('detects broken links when a record is deleted or reordered', () => {
      // Arrange
      const chain = createSampleChain();
      const brokenChain = [chain[1]!];

      // Act
      const result = verifyLedgerChain(brokenChain, genesisHash);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.brokenRecordId).toBe('TXN-002');
      expect(result.error).toContain('Broken chain link');
    });
  });
});
