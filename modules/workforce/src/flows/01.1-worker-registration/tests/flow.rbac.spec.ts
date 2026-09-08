import { describe, it, expect, vi } from 'vitest';
import { WorkerRegistrationHandler } from '../flow.handler.js';
import { WorkerRegistrationService } from '../flow.service.js';
import { WorkerRegistrationRepository } from '../flow.repository.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.1 RBAC Tests — Access Control & Role Masking', () => {
  it('should block unauthorized roles such as GUEST and WORKER from accessing the wizard', async () => {
    const repo = new WorkerRegistrationRepository({} as PrismaClient);
    const service = new WorkerRegistrationService(repo);
    const handler = new WorkerRegistrationHandler(service, repo);

    const blockedRoles: ('GUEST' | 'WORKER' | 'SUPPLIER')[] = ['GUEST', 'WORKER', 'SUPPLIER'];

    for (const role of blockedRoles) {
      let blockedMessageSent = false;
      const mockCtx = {
        from: { id: 112233 },
        effectiveRole: role,
        callbackQuery: { id: 'cb-rbac' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockImplementation((text: string) => {
          if (text.includes('لا تملك الصلاحية')) {
            blockedMessageSent = true;
          }
          return Promise.resolve(true);
        }),
      } as unknown as WorkforceModuleContext;

      await handler.handleStart(mockCtx);
      expect(blockedMessageSent).toBe(true);
    }
  });

  it('should allow authorized roles such as SUPER_ADMIN and FIELD_ADMIN to start registration', async () => {
    const repo = new WorkerRegistrationRepository({} as PrismaClient);
    const service = new WorkerRegistrationService(repo);
    const handler = new WorkerRegistrationHandler(service, repo);

    const allowedRoles: ('SUPER_ADMIN' | 'FIELD_ADMIN' | 'GENERAL_ADMIN')[] = [
      'SUPER_ADMIN',
      'FIELD_ADMIN',
      'GENERAL_ADMIN',
    ];

    for (const role of allowedRoles) {
      let promptSent = false;
      const mockCtx = {
        from: { id: 445566 },
        effectiveRole: role,
        callbackQuery: { id: 'cb-rbac-allow' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockImplementation((text: string) => {
          if (text.includes('تسجيل وتعيين عامل')) {
            promptSent = true;
          }
          return Promise.resolve(true);
        }),
      } as unknown as WorkforceModuleContext;

      await handler.handleStart(mockCtx);
      expect(promptSent).toBe(true);
    }
  });
});
