import { describe, it, expect, vi } from 'vitest';
import { WorkerSelfEditHandler } from '../flow.handler.js';
import { WorkerSelfEditService } from '../flow.service.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';

describe('01.6 Worker Self-Edit — RBAC Tests', () => {
  it('should reject unlinked users or users without worker records', async () => {
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

    await handler.handleStartSelfEdit(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('لا يوجد سجل عامل مرتبط'),
        show_alert: true,
      })
    );
  });
});
