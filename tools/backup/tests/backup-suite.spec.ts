import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packCodebase, verifyCodebaseBundle, MAX_CODEBASE_BUNDLE_SIZE_BYTES } from '../codebase-packer.js';
import {
  decryptBuffer,
  deriveColdRecoveryKey,
  encryptBuffer,
  resolveEncryptionKey,
  syncToGoogleDriveWithBackoff,
} from '../gdrive-sync.js';
import {
  createFullBackup,
  listBackups,
  restoreBackup,
  createDatabaseDump,
} from '../backup-manager.js';
import { runDisasterRecoveryDrill } from '../verify-disaster-recovery.js';
import {
  computeTransactionHash,
  verifyLedgerChainMemory,
  GENESIS_HASH,
  type ChainedRecord,
} from '../../../packages/database/src/ledger/hash-chain.js';

describe('Work Plan 99 — Full Sovereign Backup & Disaster Recovery Suite', () => {
  const testDir = join(process.cwd(), 'backups', 'test-suite-tmp');

  beforeAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    try {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('1. Zero-Bloat Codebase Packer (Git Bundle)', () => {
    it('generates a clean Git bundle strictly under the 30MB budget', async () => {
      const result = await packCodebase({
        outputDir: join(testDir, 'codebase'),
      });

      expect(result.success).toBe(true);
      expect(result.bundlePath).toBeDefined();
      expect(existsSync(result.bundlePath)).toBe(true);
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(result.sizeBytes).toBeLessThan(MAX_CODEBASE_BUNDLE_SIZE_BYTES);
      expect(result.sha256).toHaveLength(64);
      expect(result.commitSha).toBeDefined();

      const isValid = await verifyCodebaseBundle(result.bundlePath);
      expect(isValid).toBe(true);
    });
  });

  describe('2. AES-256-GCM Encryption & Cold Recovery Passphrase', () => {
    const passphrase = 'my secret sovereign emergency mnemonic phrase 2026';
    const payload = Buffer.from('CRITICAL_FINANCIAL_DOUBLE_ENTRY_DATA_FOR_AUDIT');

    it('derives a consistent 32-byte key from cold recovery passphrase via PBKDF2', () => {
      const key1 = deriveColdRecoveryKey(passphrase);
      const key2 = deriveColdRecoveryKey(passphrase);

      expect(key1).toHaveLength(32);
      expect(key1.equals(key2)).toBe(true);
    });

    it('encrypts and successfully decrypts data with cold recovery key', () => {
      const key = deriveColdRecoveryKey(passphrase);
      const encrypted = encryptBuffer(payload, key);

      // Must have IV (16) + AuthTag (16) + Ciphertext (> 0)
      expect(encrypted.length).toBeGreaterThan(32);

      const decrypted = decryptBuffer(encrypted, key);
      expect(decrypted.equals(payload)).toBe(true);
    });

    it('detects tampering in ciphertext and refuses to decrypt', () => {
      const key = deriveColdRecoveryKey(passphrase);
      const encrypted = encryptBuffer(payload, key);

      const tampered = Buffer.from(encrypted);
      tampered[tampered.length - 2]! ^= 0x55; // Flip bit in ciphertext

      expect(() => decryptBuffer(tampered, key)).toThrow();
    });

    it('detects tampering in authentication tag and refuses to decrypt', () => {
      const key = deriveColdRecoveryKey(passphrase);
      const encrypted = encryptBuffer(payload, key);

      const tampered = Buffer.from(encrypted);
      tampered[18]! ^= 0xaa; // Flip bit in auth tag (offset 16-31)

      expect(() => decryptBuffer(tampered, key)).toThrow();
    });
  });

  describe('3. Resilient Cloud Sync with 3-Tier Backoff Retry', () => {
    it('retries with exponential backoff on transient network glitches and succeeds', async () => {
      const testFile = join(testDir, 'test-cloud-file.bin');
      writeFileSync(testFile, Buffer.from('CLOUD_SYNC_TEST_PAYLOAD'));

      const result = await syncToGoogleDriveWithBackoff(testFile, 'test-cloud-file.bin', {
        simulateFailureCount: 2, // Fails first 2 attempts, succeeds on 3rd
        initialDelayMs: 10, // Fast delay for unit test
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('fails gracefully when network errors exceed max retry ceiling', async () => {
      const testFile = join(testDir, 'test-failing-file.bin');
      writeFileSync(testFile, Buffer.from('FAIL_TEST_PAYLOAD'));

      const result = await syncToGoogleDriveWithBackoff(testFile, 'test-failing-file.bin', {
        simulateFailureCount: 5,
        initialDelayMs: 10,
        maxRetries: 2,
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
      expect(result.error).toContain('Upload failed after 2 attempts');
    });
  });

  describe('4. Atomic Single-Transaction Database Dump & Backup Manager', () => {
    it('creates an atomic database dump with proper metadata', async () => {
      const dumpPath = join(testDir, 'test-db.dump');
      const ok = await createDatabaseDump(dumpPath);
      expect(ok).toBe(true);
      expect(existsSync(dumpPath)).toBe(true);
      expect(statSync(dumpPath).size).toBeGreaterThan(0);
    });

    it('creates a full backup manifest containing all 3 pillars and checksums', async () => {
      const manifest = await createFullBackup({
        baseBackupDir: join(testDir, 'full-backup'),
        encryptionKeyOrPassphrase: 'test-passphrase-2026',
      });

      expect(manifest.backupId).toMatch(/^BCK-\d{8}-\d{6}$/);
      expect(manifest.artifacts.length).toBeGreaterThanOrEqual(3);

      const dbArt = manifest.artifacts.find((a) => a.type === 'database');
      const codeArt = manifest.artifacts.find((a) => a.type === 'codebase');
      const assetsArt = manifest.artifacts.find((a) => a.type === 'assets');

      expect(dbArt?.encrypted).toBe(true);
      expect(codeArt?.encrypted).toBe(false);
      expect(assetsArt?.encrypted).toBe(true);

      // Verify listing returns this backup
      const list = await listBackups(join(testDir, 'full-backup'));
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((b) => b.backupId === manifest.backupId && b.isIntegrityIntact)).toBe(true);
    });

    it('restores backup and validates post-restore verification gate', async () => {
      const manifest = await createFullBackup({
        baseBackupDir: join(testDir, 'restore-backup'),
        encryptionKeyOrPassphrase: 'test-passphrase-2026',
      });

      const restoreRes = await restoreBackup({
        backupId: manifest.backupId,
        baseBackupDir: join(testDir, 'restore-backup'),
        keyOrPassphrase: 'test-passphrase-2026',
      });

      expect(restoreRes.success).toBe(true);
      expect(restoreRes.postRestoreChecks.checksumVerified).toBe(true);
      expect(restoreRes.postRestoreChecks.decryptionVerified).toBe(true);
      expect(restoreRes.postRestoreChecks.financialIntegrityPassed).toBe(true);
    });

    it('aborts restore and detects tampered or corrupted dump payloads', async () => {
      const manifest = await createFullBackup({
        baseBackupDir: join(testDir, 'corrupt-backup'),
        encryptionKeyOrPassphrase: 'test-passphrase-2026',
      });

      // Tamper with the database dump file on disk
      const dbArt = manifest.artifacts.find((a) => a.type === 'database');
      expect(dbArt).toBeDefined();
      const dbPath = join(testDir, 'corrupt-backup', dbArt!.relativePath);
      writeFileSync(dbPath, Buffer.from('TAMPERED_MALICIOUS_DUMP_CONTENT'));

      const restoreRes = await restoreBackup({
        backupId: manifest.backupId,
        baseBackupDir: join(testDir, 'corrupt-backup'),
        keyOrPassphrase: 'test-passphrase-2026',
      });

      expect(restoreRes.success).toBe(false);
      expect(restoreRes.postRestoreChecks.checksumVerified).toBe(false);
      expect(restoreRes.error).toContain('Corrupted backup payload: SHA-256 mismatch');
    });
  });

  describe('5. Post-Restore Financial Ledger Integrity (Double-Entry Invariant G12)', () => {
    it('verifies that valid financial ledger chain passes memory watchdog check', () => {
      const time = '2026-04-19T00:00:00.000Z';
      const r1Payload = {
        id: 'R1',
        previousHash: GENESIS_HASH,
        timestamp: time,
        amount: 1000,
        currency: 'EGP',
        transactionType: 'CAPITAL_INJECTION',
        sourceAccount: 'BANK_ACCOUNT',
        destinationAccount: 'CUSTODY_SAFE',
        actorTelegramId: '7594239391',
      };
      const h1 = computeTransactionHash(r1Payload);
      const r1: ChainedRecord = { ...r1Payload, recordHash: h1 };

      const r2Payload = {
        id: 'R2',
        previousHash: h1,
        timestamp: time,
        amount: 500,
        currency: 'EGP',
        transactionType: 'ADVANCE_CASH',
        sourceAccount: 'CUSTODY_SAFE',
        destinationAccount: 'WORKER_PAYABLE',
        actorTelegramId: '7594239391',
      };
      const h2 = computeTransactionHash(r2Payload);
      const r2: ChainedRecord = { ...r2Payload, recordHash: h2 };

      const intact = verifyLedgerChainMemory([r1, r2]);
      expect(intact.isValid).toBe(true);
    });

    it('detects tampered financial amount in restored chain', () => {
      const time = '2026-04-19T00:00:00.000Z';
      const r1Payload = {
        id: 'R1',
        previousHash: GENESIS_HASH,
        timestamp: time,
        amount: 1000,
        currency: 'EGP',
        transactionType: 'CAPITAL_INJECTION',
        sourceAccount: 'BANK_ACCOUNT',
        destinationAccount: 'CUSTODY_SAFE',
        actorTelegramId: '7594239391',
      };
      const h1 = computeTransactionHash(r1Payload);
      const r1: ChainedRecord = { ...r1Payload, recordHash: h1 };

      const r2Payload = {
        id: 'R2',
        previousHash: h1,
        timestamp: time,
        amount: 500,
        currency: 'EGP',
        transactionType: 'ADVANCE_CASH',
        sourceAccount: 'CUSTODY_SAFE',
        destinationAccount: 'WORKER_PAYABLE',
        actorTelegramId: '7594239391',
      };
      const h2 = computeTransactionHash(r2Payload);
      const r2: ChainedRecord = { ...r2Payload, recordHash: h2 };

      // Tampered record with modified amount
      const tamperedR2: ChainedRecord = { ...r2, amount: 999999 };
      const checked = verifyLedgerChainMemory([r1, tamperedR2]);
      expect(checked.isValid).toBe(false);
      expect(checked.error).toContain('Tampered record detected');
    });
  });

  describe('6. Automated Disaster Recovery Drill End-to-End', () => {
    it('executes full automated disaster recovery drill and returns 100% OK', async () => {
      const drillResult = await runDisasterRecoveryDrill();
      expect(drillResult.ok).toBe(true);
      expect(drillResult.drChecklist.creationPassed).toBe(true);
      expect(drillResult.drChecklist.zeroBloatVerified).toBe(true);
      expect(drillResult.drChecklist.coldPassphraseVerified).toBe(true);
      expect(drillResult.drChecklist.tamperDetectionVerified).toBe(true);
      expect(drillResult.drChecklist.corruptedDumpDetected).toBe(true);
      expect(drillResult.drChecklist.restorePassed).toBe(true);
      expect(drillResult.drChecklist.financialIntegrityPassed).toBe(true);
      expect(drillResult.errors).toHaveLength(0);
    });
  });
});
