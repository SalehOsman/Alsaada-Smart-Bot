import { describe, it, expect, vi } from 'vitest';
import { AdminProfileHandler } from '../flow.handler.js';
import type { AdminProfileService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

describe('Flow 00.4 RBAC Tests — الملف الشخصي للمدير العام', () => {
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
  } as unknown as AdminProfileService;

  const handler = new AdminProfileHandler(mockService);

  it('should deny or alert unrecorded users', async () => {
    const replyMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);
    const ctxWorker = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      from: { id: 123456 },
      reply: replyMock,
      callbackQuery: { data: 'test' },
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.renderAdminProfile(ctxWorker);
    expect(answerCallbackMock).toHaveBeenCalled();
    expect(replyMock).toHaveBeenCalledWith('⚠️ لم يتم العثور على سجل حسابك في قاعدة البيانات.');
  });
  it('should allow access for verified Super Admin with valid profile', async () => {
    vi.mocked(mockService.getProfile).mockResolvedValueOnce({
      id: 'admin-1',
      telegramId: 7594239391n,
      role: 'SUPER_ADMIN',
      fullName: 'Super Admin User',
      phone: '01012345678',
      assignedSiteName: null,
      isActive: true,
    });

    const replyMock = vi.fn().mockResolvedValue({});
    const ctxSuper = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    await handler.renderAdminProfile(ctxSuper);
    expect(replyMock).toHaveBeenCalledWith(
      expect.stringContaining('الملف الشخصي'),
      expect.objectContaining({})
    );
  });
});
