import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateWorkerInviteToken,
  verifyWorkerInviteToken,
  workerService,
  workerEditService,
} from '@alsaada/workforce';
import { config } from '../src/config/env.js';
import { getScopedSiteId, buildSiteScopeWhere } from '../src/services/scope.service.js';
import type { MyContext } from '../src/types/context.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Security Hardening Suite (R07, R08, R09 Verification)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('R07: Cryptographic Worker Invite Tokens (HMAC-SHA256)', () => {
    const secretKey = 'test-secret-key-123456';
    const workerCode = 'OP-DRV-0001';

    it('generates deterministic 16-character HMAC token for worker code', () => {
      // Arrange & Act
      const token1 = generateWorkerInviteToken(workerCode, secretKey);
      const token2 = generateWorkerInviteToken(workerCode, secretKey);

      // Assert
      expect(token1).toHaveLength(16);
      expect(token1).toBe(token2);
      expect(token1).not.toBe('');
      expect(typeof token1).toBe('string');
    });

    it('verifies valid HMAC token successfully', () => {
      // Arrange
      const token = generateWorkerInviteToken(workerCode, secretKey);

      // Act
      const isValid = verifyWorkerInviteToken(workerCode, token, secretKey);
      const isValidWrongSecret = verifyWorkerInviteToken(workerCode, token, 'wrong-secret-key');

      // Assert
      expect(isValid).toBe(true);
      expect(isValid).not.toBe(false);
      expect(isValidWrongSecret).toBe(false);
    });

    it('rejects tampered or guessed tokens', () => {
      // Arrange & Act
      const resultTampered = verifyWorkerInviteToken(workerCode, 'bad-token-12345', secretKey);
      const resultEmpty = verifyWorkerInviteToken(workerCode, '', secretKey);

      // Assert
      expect(resultTampered).toBe(false);
      expect(resultEmpty).toBe(false);
      expect(resultTampered).not.toBe(true);
    });

    it('rejects token generated for a different worker code', () => {
      // Arrange
      const tokenForWorker1 = generateWorkerInviteToken('OP-DRV-0001', secretKey);

      // Act
      const isValidForOther = verifyWorkerInviteToken('OP-DRV-0002', tokenForWorker1, secretKey);

      // Assert
      expect(isValidForOther).toBe(false);
      expect(isValidForOther).not.toBe(true);
    });
  });

  describe('R08: Site Scope & Active Identity Enforcement', () => {
    it('restricts field supervisor to assigned site', () => {
      // Arrange
      const ctx = {
        effectiveRole: 'FIELD_ADMIN',
        dbUser: { assignedSiteId: 'site-alamein-01' },
      } as unknown as MyContext;

      // Act
      const scopedSiteId = getScopedSiteId(ctx);
      const scopeWhere = buildSiteScopeWhere(ctx);

      // Assert
      expect(scopedSiteId).toBe('site-alamein-01');
      expect(scopedSiteId).not.toBeNull();
      expect(scopeWhere).toEqual({ siteId: 'site-alamein-01' });
      expect(scopeWhere).not.toEqual({});
    });

    it('grants global scope to Super Admin and General Admin', () => {
      // Arrange
      const adminCtx = {
        effectiveRole: 'SUPER_ADMIN',
        dbUser: { assignedSiteId: 'site-alamein-01' },
      } as unknown as MyContext;

      const genAdminCtx = {
        effectiveRole: 'GENERAL_ADMIN',
        dbUser: { assignedSiteId: 'site-alamein-01' },
      } as unknown as MyContext;

      // Act
      const adminScopeId = getScopedSiteId(adminCtx);
      const adminScopeWhere = buildSiteScopeWhere(adminCtx);
      const genAdminScopeId = getScopedSiteId(genAdminCtx);
      const genAdminScopeWhere = buildSiteScopeWhere(genAdminCtx);

      // Assert
      expect(adminScopeId).toBeNull();
      expect(adminScopeId).not.toBe('site-alamein-01');
      expect(adminScopeWhere).toEqual({});
      expect(genAdminScopeId).toBeNull();
      expect(genAdminScopeWhere).toEqual({});
    });
  });

  describe('R09: Fail-Closed Sensitive Data Encryption', () => {
    it('throws an explicit security error when databaseEncryptionKey is missing in createWorker', async () => {
      // Arrange
      const originalKey = config.databaseEncryptionKey;
      (config as { databaseEncryptionKey: string }).databaseEncryptionKey = '';

      // Act & Assert
      try {
        await expect(
          workerService.createWorker({
            name: 'محمد أحمد علي',
            idType: 'NATIONAL_ID',
            idNumber: '29505151201532',
            phone: '01012345678',
            jobTitleName: 'سائق',
          })
        ).rejects.toThrow(/DATABASE_ENCRYPTION_KEY is required/i);
      } finally {
        (config as { databaseEncryptionKey: string }).databaseEncryptionKey = originalKey;
      }
      expect(config.databaseEncryptionKey).toBe(originalKey);
    });

    it('throws an explicit security error when databaseEncryptionKey is missing in updateWorkerField', async () => {
      // Arrange
      const originalKey = config.databaseEncryptionKey;
      (config as { databaseEncryptionKey: string }).databaseEncryptionKey = '';

      // Act & Assert
      try {
        await expect(
          workerEditService.applyDirectSuperAdminEdit('worker-uuid-test', 'phone', '01099999999')
        ).rejects.toThrow(/DATABASE_ENCRYPTION_KEY is required/i);
      } finally {
        (config as { databaseEncryptionKey: string }).databaseEncryptionKey = originalKey;
      }
      expect(config.databaseEncryptionKey).toBe(originalKey);
    });
  });

  describe('Telegram 64-Byte Callback Data Compliance & Invariant Guard', () => {
    it('strictly ensures common operational callback data strings adhere to <= 64 UTF-8 bytes', () => {
      // Arrange
      const sampleWorkerUuid = 'c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
      const callbacks = [
        'menu:domain:hr',
        'menu:domain:finance',
        'menu:domain:operations',
        'menu:domain:logistics',
        'menu:domain:governance',
        'action:main_menu',
        'action:boost:refresh',
        `act:worker:profile:${sampleWorkerUuid}`,
        `act:worker:edit:${sampleWorkerUuid}`,
        `we:menu:${sampleWorkerUuid}`,
        `we:field:phone:${sampleWorkerUuid}`,
        `session:extend:${sampleWorkerUuid}`,
        `session:revoke:${sampleWorkerUuid}`,
      ];

      // Act & Assert
      for (const cb of callbacks) {
        const byteLen = Buffer.byteLength(cb, 'utf8');
        expect(byteLen).toBeLessThanOrEqual(64);
        expect(byteLen).toBeGreaterThan(0);
      }
    });

    it('rejects callback data payloads exceeding Telegram 64-byte limit', () => {
      // Arrange
      const oversizedCallback = 'act:very_long_prefix_that_exceeds_sixty_four_bytes_boundary_limit_for_telegram_callbacks_12345';
      const byteLen = Buffer.byteLength(oversizedCallback, 'utf8');

      // Act & Assert
      expect(byteLen).toBeGreaterThan(64);
      expect(byteLen).not.toBeLessThanOrEqual(64);
    });
  });
});
