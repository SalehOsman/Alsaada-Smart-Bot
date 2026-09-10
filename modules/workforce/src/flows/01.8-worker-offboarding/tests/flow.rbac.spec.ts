import { describe, it, expect, vi } from 'vitest';
import { WorkerOffboardingHandler } from '../flow.handler.js';
import { WorkerOffboardingService } from '../flow.service.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';

describe('01.8 Worker Offboarding — RBAC Tests', () => {
  it('should block non-administrative roles (such as WORKER or GUEST) from initiating offboarding', async () => {
    const mockService = {} as unknown as WorkerOffboardingService;
    const handler = new WorkerOffboardingHandler(mockService);

    const ctx = {
      from: { id: 123456 },
      effectiveRole: 'WORKER',
      callbackQuery: { data: 'wizard:worker_offboard:start' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as WorkforceModuleContext;

    await handler.handleStartOffboarding(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('غير مصرح لك'),
        show_alert: true,
      })
    );
  });
});
