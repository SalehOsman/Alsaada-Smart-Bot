import { describe, it, expect, vi } from 'vitest';
import { GuestJoinHandler } from '../flow.handler.js';
import { GuestJoinService } from '../flow.service.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';

describe('01.7 Guest Join & WhatsApp Linking — RBAC Tests', () => {
  it('should prevent already registered non-guest users from submitting guest join requests', async () => {
    const mockService = {} as unknown as GuestJoinService;
    const handler = new GuestJoinHandler(mockService);

    const ctx = {
      from: { id: 123456 },
      effectiveRole: 'WORKER',
      callbackQuery: { data: 'wizard:guest_join:start' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as WorkforceModuleContext;

    await handler.handleStartGuestJoin(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('حسابك مسجل ومفعل بالفعل'),
        show_alert: true,
      })
    );
  });

  it('should block non-admin users from generating administrative linking links', async () => {
    const mockService = {} as unknown as GuestJoinService;
    const handler = new GuestJoinHandler(mockService);

    const ctx = {
      from: { id: 987654 },
      effectiveRole: 'GUEST',
      callbackQuery: { data: 'action:guest_join:gen:OP-01:987654' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as WorkforceModuleContext;

    await handler.handleGenerateAdminLink(ctx, 'OP-01', 987654n);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('غير مصرح لك'),
        show_alert: true,
      })
    );
  });
});
