import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerOffboardingHandler } from '../flow.handler.js';
import { WorkerOffboardingService } from '../flow.service.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('01.8 Worker Offboarding — RBAC Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('blocks non-administrative roles (such as WORKER or GUEST) from initiating offboarding', async () => {
    // Arrange
    const mockService = {
      getPendingClearanceReports: vi.fn(),
      getPendingDisciplinaryDecisions: vi.fn(),
    } as unknown as WorkerOffboardingService;
    const handler = new WorkerOffboardingHandler(mockService);

    const ctx = {
      from: { id: 123456 },
      effectiveRole: 'WORKER',
      callbackQuery: { data: 'wizard:worker_offboard:start' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleStartOffboarding(ctx);

    // Assert
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('غير مصرح لك'),
        show_alert: true,
      })
    );
    expect(mockService.getPendingClearanceReports).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('allows administrative roles (such as SUPER_ADMIN) to initiate offboarding hub', async () => {
    // Arrange
    const mockService = {
      getPendingClearanceReports: vi.fn().mockResolvedValue([]),
      getPendingDisciplinaryDecisions: vi.fn().mockResolvedValue([]),
    } as unknown as WorkerOffboardingService;
    const handler = new WorkerOffboardingHandler(mockService);

    const ctx = {
      from: { id: 999999 },
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: { data: 'wizard:worker_offboard:start', message: { message_id: 42 } },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleStartOffboarding(ctx);

    // Assert
    expect(mockService.getPendingClearanceReports).toHaveBeenCalledTimes(1);
    expect(mockService.getPendingDisciplinaryDecisions).toHaveBeenCalledTimes(1);
    expect(ctx.editMessageText).toHaveBeenCalled();
  });
});
