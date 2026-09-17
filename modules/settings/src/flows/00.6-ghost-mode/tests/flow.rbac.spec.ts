import { describe, it, expect, vi } from 'vitest';
import { GhostModeHandler } from '../flow.handler.js';
import type { GhostModeService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

describe('Flow 00.6 RBAC Tests — محاكاة وتقمص الأدوار', () => {
  const mockService = {
    clearPendingEdit: vi.fn().mockResolvedValue(undefined),
    clearWizardState: vi.fn().mockResolvedValue(undefined),
    clearEditState: vi.fn().mockResolvedValue(undefined),
    getProfile: vi.fn().mockResolvedValue(null),
    listSites: vi.fn().mockResolvedValue([]),
    listDepartments: vi.fn().mockResolvedValue([]),
    listAdminUsers: vi.fn().mockResolvedValue([]),
    getApmSummary: vi.fn().mockResolvedValue({ totalOps24h: 0, avgLatencyMs: 0, greenPct: 100, yellowPct: 0, redPct: 0 }),
    getMaintenanceStatus: vi.fn().mockResolvedValue({ isMaintenanceActive: false }),
  } as unknown as GhostModeService;

  const handler = new GhostModeHandler(mockService);

  it('should deny or alert non-super admin users', async () => {
    const replyMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);
    const ctxWorker = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      reply: replyMock,
      callbackQuery: { data: 'test' },
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.renderGhostModeMenu(ctxWorker);
    expect(answerCallbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('خاصية المحاكاة مخصصة حصرياً للمدير العام'),
        show_alert: true,
      })
    );
    expect(replyMock).not.toHaveBeenCalled();
  });

  it('should allow access for verified Super Admin', async () => {
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxSuper = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    await handler.renderGhostModeMenu(ctxSuper);
    expect(replyMock).toHaveBeenCalled();
  });
});
