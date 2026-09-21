import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerRegistrationHandler } from '../flow.handler.js';
import { WorkerRegistrationService } from '../flow.service.js';
import { WorkerRegistrationRepository } from '../flow.repository.js';
import { WorkerRegistrationMessages } from '../flow.messages.js';
import { WorkerWizardStep } from '../flow.types.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.1 RBAC Tests — Access Control & Role Masking', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('blocks unauthorized roles such as GUEST, WORKER, and SUPPLIER from accessing the wizard', async () => {
    // Arrange
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

      // Act
      await handler.handleStart(mockCtx);

      // Assert
      expect(blockedMessageSent).toBe(true);
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalled();
    }
  });

  it('allows authorized roles such as SUPER_ADMIN, FIELD_ADMIN, and GENERAL_ADMIN to start registration', async () => {
    // Arrange
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

      // Act
      await handler.handleStart(mockCtx);

      // Assert
      expect(promptSent).toBe(true);
    }
  });

  it('auto-locks site and jumps directly to start date choice for FIELD_ADMIN with assigned site', async () => {
    // Arrange
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

    // Act
    await handler.handleJobChoice(mockCtx, 'job-1');

    // Assert
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

  it('prompts for site choice for SUPER_ADMIN or GENERAL_ADMIN without auto-locking', async () => {
    // Arrange
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

    // Act
    await handler.handleJobChoice(mockCtx, 'job-1');

    // Assert
    expect(mockService.pushStep).toHaveBeenCalledWith(
      BigInt(110022),
      'SITE_CHOICE',
      expect.objectContaining({
        jobTitleId: 'job-1',
      })
    );
    expect(sentText).toContain('موقع العمل الميداني');
  });

  it('strictly hides all 3 salary lines from confirmation card for FIELD_ADMIN and unauthorized roles', () => {
    // Arrange
    const dummyState = {
      currentStep: WorkerWizardStep.CONFIRMATION,
      name: 'علي حسن',
      nickname: 'أبو علي',
      idType: 'NATIONAL_ID' as const,
      idNumber: '29001012701234',
      phone: '01012345678',
      jobTitleName: 'سائق لودر',
      siteName: 'موقع السباعية',
      basicSalary: 6000,
      additionalSalary: 3000,
    };

    const maskedRoles = ['FIELD_ADMIN', 'WORKER_SUPERVISOR', 'WORKER', 'SUPPLIER', 'GUEST', undefined];

    for (const role of maskedRoles) {
      // Act
      const card = WorkerRegistrationMessages.confirmationCard(dummyState, role);

      // Assert
      expect(card).not.toContain('الراتب الأساسي الشهري');
      expect(card).not.toContain('الراتب الإضافي الشهري');
      expect(card).not.toContain('إجمالي الراتب الشهري');
    }
  });

  it('displays all 3 salary lines in confirmation card for SUPER_ADMIN and GENERAL_ADMIN', () => {
    // Arrange
    const dummyState = {
      currentStep: WorkerWizardStep.CONFIRMATION,
      name: 'علي حسن',
      nickname: 'أبو علي',
      idType: 'NATIONAL_ID' as const,
      idNumber: '29001012701234',
      phone: '01012345678',
      jobTitleName: 'سائق لودر',
      siteName: 'موقع السباعية',
      basicSalary: 6000,
      additionalSalary: 3000,
    };

    const authorizedRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN'];

    for (const role of authorizedRoles) {
      // Act
      const card = WorkerRegistrationMessages.confirmationCard(dummyState, role);

      // Assert
      expect(card).toContain('الراتب الأساسي الشهري');
      expect(card).toContain('الراتب الإضافي الشهري');
      expect(card).toContain('إجمالي الراتب الشهري');
    }
  });
});
