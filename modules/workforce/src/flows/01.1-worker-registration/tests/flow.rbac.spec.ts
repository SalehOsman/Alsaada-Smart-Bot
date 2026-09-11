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

  it('should auto-lock site and jump directly to start date choice for FIELD_ADMIN with assigned site', async () => {
    const mockRepo = {
      listActiveJobs: vi.fn().mockResolvedValue([{ id: 'job-1', code: 'DRV', name: 'سائق' }]),
      listActiveSites: vi.fn().mockResolvedValue([{ id: 'site-sp-01', code: 'SP01', name: 'موقع السباعية' }]),
    } as unknown as WorkerRegistrationRepository;

    const mockService = {
      pushStep: vi.fn().mockResolvedValue({}),
    } as unknown as WorkerRegistrationService;

    const handler = new WorkerRegistrationHandler(mockService, mockRepo);

    let sentText = '';
    const mockCtx = {
      from: { id: 778899 },
      effectiveRole: 'FIELD_ADMIN',
      assignedSiteId: 'site-sp-01',
      callbackQuery: { id: 'cb-field-admin' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockImplementation((text: string) => {
        sentText = text;
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    await handler.handleJobChoice(mockCtx, 'job-1');

    expect(mockService.pushStep).toHaveBeenCalledWith(
      BigInt(778899),
      'START_DATE_CHOICE',
      expect.objectContaining({
        jobTitleId: 'job-1',
        siteId: 'site-sp-01',
        siteName: 'موقع السباعية',
      })
    );

    expect(sentText).toContain('تاريخ مباشرة العمل');
  });

  it('should prompt for site choice for SUPER_ADMIN or GENERAL_ADMIN without auto-locking', async () => {
    const mockRepo = {
      listActiveJobs: vi.fn().mockResolvedValue([{ id: 'job-1', code: 'DRV', name: 'سائق' }]),
      listActiveSites: vi.fn().mockResolvedValue([
        { id: 'site-sp-01', code: 'SP01', name: 'موقع السباعية' },
        { id: 'site-ab-02', code: 'AB02', name: 'موقع أبو طرطور' },
      ]),
    } as unknown as WorkerRegistrationRepository;

    const mockService = {
      pushStep: vi.fn().mockResolvedValue({}),
    } as unknown as WorkerRegistrationService;

    const handler = new WorkerRegistrationHandler(mockService, mockRepo);

    let sentText = '';
    const mockCtx = {
      from: { id: 110022 },
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: { id: 'cb-super-admin' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockImplementation((text: string) => {
        sentText = text;
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    await handler.handleJobChoice(mockCtx, 'job-1');

    expect(mockService.pushStep).toHaveBeenCalledWith(
      BigInt(110022),
      'SITE_CHOICE',
      expect.objectContaining({
        jobTitleId: 'job-1',
      })
    );

    expect(sentText).toContain('موقع العمل الميداني');
  });
});
