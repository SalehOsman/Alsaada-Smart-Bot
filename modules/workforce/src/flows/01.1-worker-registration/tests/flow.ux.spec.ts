import { describe, it, expect, vi } from 'vitest';
import { WorkerRegistrationHandler } from '../flow.handler.js';
import { WorkerRegistrationService } from '../flow.service.js';
import { WorkerRegistrationRepository } from '../flow.repository.js';
import { WorkerWizardStep } from '../flow.types.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.1 UX Tests — Single Message Lifecycle & Navigation', () => {
  it('should update messages in place via editMessageText on wizard step transitions', async () => {
    const repo = new WorkerRegistrationRepository({} as PrismaClient);
    const service = new WorkerRegistrationService(repo);
    const handler = new WorkerRegistrationHandler(service, repo);

    let editMessageCalled = false;
    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        id: 'cb-1',
        message: { message_id: 999 },
      },
      effectiveRole: 'FIELD_ADMIN',
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation(() => {
        editMessageCalled = true;
        return Promise.resolve(true);
      }),
      reply: vi.fn(),
    } as unknown as WorkforceModuleContext;

    await handler.handleDocType(mockCtx, 'NATIONAL_ID');

    expect(editMessageCalled).toBe(true);
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
  });

  it('should preserve previous step data when navigating backwards via handleBack', async () => {
    const repo = new WorkerRegistrationRepository({} as PrismaClient);
    const service = new WorkerRegistrationService(repo);
    const handler = new WorkerRegistrationHandler(service, repo);

    const telegramId = BigInt(778899);
    await service.pushStep(telegramId, WorkerWizardStep.DOC_TYPE);
    await service.pushStep(telegramId, WorkerWizardStep.FULL_NAME, { name: 'عمر خالد' });

    let backEdited = false;
    const mockCtx = {
      from: { id: 778899 },
      callbackQuery: {
        id: 'cb-back',
        message: { message_id: 1001 },
      },
      effectiveRole: 'SUPER_ADMIN',
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation(() => {
        backEdited = true;
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    await handler.handleBack(mockCtx);

    const draft = await service.getDraft(telegramId);
    expect(draft?.currentStep).toBe(WorkerWizardStep.DOC_TYPE);
    expect(draft?.name).toBe('عمر خالد');
    expect(backEdited).toBe(true);
  });
});
