import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerSelfEditHandler } from '../flow.handler.js';
import { WorkerSelfEditService } from '../flow.service.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';

describe('01.6 Worker Self-Edit — RBAC Tests', () => {
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

  it('rejects unlinked users or users without worker records', async () => {
    // Arrange
    const mockService = {
      getWorker: vi.fn().mockResolvedValue(null),
      getWorkerByTelegramId: vi.fn().mockResolvedValue(null),
    } as unknown as WorkerSelfEditService;

    const handler = new WorkerSelfEditHandler(mockService);

    const ctx = {
      from: { id: 112233 },
      effectiveRole: 'GUEST',
      workerId: undefined,
      callbackQuery: { data: 'wizard:worker_self_edit:start' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleStartSelfEdit(ctx);

    // Assert
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('لا يوجد سجل عامل مرتبط'),
        show_alert: true,
      })
    );
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('allows linked registered workers to initiate self-edit session', async () => {
    // Arrange
    const mockWorker = {
      id: 'w-200',
      code: 'OP-02',
      name: 'علي حسن',
      phoneEncrypted: 'enc',
    };

    const mockService = {
      getWorker: vi.fn().mockResolvedValue(mockWorker),
      getWorkerByTelegramId: vi.fn().mockResolvedValue(mockWorker),
    } as unknown as WorkerSelfEditService;

    const handler = new WorkerSelfEditHandler(mockService);

    const ctx = {
      from: { id: 556677 },
      effectiveRole: 'WORKER',
      workerId: 'w-200',
      callbackQuery: {
        data: 'wizard:worker_self_edit:start',
        message: { message_id: 888 },
      },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleStartSelfEdit(ctx);

    // Assert
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('طلب تعديل وتحديث بيانات العامل'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
    expect(ctx.reply).not.toHaveBeenCalledWith(
      expect.stringContaining('لا يوجد سجل عامل مرتبط')
    );
  });
});
