import { describe, it, expect, vi } from 'vitest';
import {
  generateWorkerInviteToken,
  verifyWorkerInviteToken,
  workerService,
  workerEditService,
} from '@alsaada/workforce';
import { config } from '../src/config/env.js';
import { getScopedSiteId, buildSiteScopeWhere } from '../src/services/scope.service.js';
import { MyContext } from '../src/types/context.js';

describe('Security Hardening Suite (R07, R08, R09 Verification)', () => {
  describe('R07: Cryptographic Worker Invite Tokens (HMAC-SHA256)', () => {
    const secretKey = 'test-secret-key-123456';
    const workerCode = 'OP-DRV-0001';

    it('should generate deterministic 16-character HMAC token for worker code', () => {
      const token1 = generateWorkerInviteToken(workerCode, secretKey);
      const token2 = generateWorkerInviteToken(workerCode, secretKey);

      expect(token1).toHaveLength(16);
      expect(token1).toBe(token2);
    });

    it('should verify valid HMAC token successfully', () => {
      const token = generateWorkerInviteToken(workerCode, secretKey);
      expect(verifyWorkerInviteToken(workerCode, token, secretKey)).toBe(true);
    });

    it('should reject tampered or guessed tokens', () => {
      expect(verifyWorkerInviteToken(workerCode, 'bad-token-12345', secretKey)).toBe(false);
      expect(verifyWorkerInviteToken(workerCode, '', secretKey)).toBe(false);
    });

    it('should reject token generated for a different worker code', () => {
      const tokenForWorker1 = generateWorkerInviteToken('OP-DRV-0001', secretKey);
      expect(verifyWorkerInviteToken('OP-DRV-0002', tokenForWorker1, secretKey)).toBe(false);
    });
  });

  describe('R08: Site Scope & Active Identity Enforcement', () => {
    it('should restrict field supervisor to assigned site', () => {
      const ctx = {
        effectiveRole: 'FIELD_ADMIN',
        dbUser: { assignedSiteId: 'site-alamein-01' },
      } as unknown as MyContext;

      expect(getScopedSiteId(ctx)).toBe('site-alamein-01');
      expect(buildSiteScopeWhere(ctx)).toEqual({ siteId: 'site-alamein-01' });
    });

    it('should grant global scope to Super Admin and General Admin', () => {
      const adminCtx = {
        effectiveRole: 'SUPER_ADMIN',
        dbUser: { assignedSiteId: 'site-alamein-01' },
      } as unknown as MyContext;
      expect(getScopedSiteId(adminCtx)).toBeNull();
      expect(buildSiteScopeWhere(adminCtx)).toEqual({});

      const genAdminCtx = {
        effectiveRole: 'GENERAL_ADMIN',
        dbUser: { assignedSiteId: 'site-alamein-01' },
      } as unknown as MyContext;
      expect(getScopedSiteId(genAdminCtx)).toBeNull();
      expect(buildSiteScopeWhere(genAdminCtx)).toEqual({});
    });
  });

  describe('R09: Fail-Closed Sensitive Data Encryption', () => {
    it('should throw an explicit security error when databaseEncryptionKey is missing in createWorker', async () => {
      const originalKey = config.databaseEncryptionKey;
      (config as any).databaseEncryptionKey = '';

      await expect(
        workerService.createWorker({
          name: 'محمد أحمد علي',
          idType: 'NATIONAL_ID',
          idNumber: '29001010101234',
          phone: '01012345678',
          jobTitleName: 'سائق',
        })
      ).rejects.toThrow(/DATABASE_ENCRYPTION_KEY is required/i);

      (config as any).databaseEncryptionKey = originalKey;
    });

    it('should throw an explicit security error when databaseEncryptionKey is missing in updateWorkerField', async () => {
      const originalKey = config.databaseEncryptionKey;
      (config as any).databaseEncryptionKey = '';

      await expect(
        workerEditService.applyDirectSuperAdminEdit('worker-uuid-test', 'phone', '01099999999')
      ).rejects.toThrow(/DATABASE_ENCRYPTION_KEY is required/i);

      (config as any).databaseEncryptionKey = originalKey;
    });
  });
});
