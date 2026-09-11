import { describe, it, expect, vi } from 'vitest';
import { AdminAssignmentHandler } from '../flow.handler.js';
import type { AdminAssignmentService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

describe('Flow 00.5 RBAC Tests — تعيين وتوزيع مدراء المواقع', () => {
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
  } as unknown as AdminAssignmentService;

  const handler = new AdminAssignmentHandler(mockService);

  it('should deny or alert non-super admin users with callbackQuery via modal alert', async () => {
    const replyMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);
    const ctxWorker = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      reply: replyMock,
      callbackQuery: { data: 'test' },
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.renderAdminAssignmentsHub(ctxWorker);
    expect(answerCallbackMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('🔒'), show_alert: true })
    );
    expect(replyMock).not.toHaveBeenCalled();
  });

  it('should block non-super admin users without callbackQuery with a polite reply', async () => {
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxWorker = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      reply: replyMock,
    } as unknown as SettingsModuleContext;

    await handler.renderAdminAssignmentsHub(ctxWorker);
    expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('🔒'));
  });

  it('should block unauthorized users from setting site assignment', async () => {
    const ctxWorker = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
    } as unknown as SettingsModuleContext;

    await handler.handleSetUserSiteAssignment(ctxWorker, 12345n, 'GLOBAL');
    expect(mockService.setAssignment).toBeUndefined(); // ensure service was not called
  });

  it('should allow access for verified Super Admin', async () => {
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxSuper = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    await handler.renderAdminAssignmentsHub(ctxSuper);
    expect(replyMock).toHaveBeenCalled();
  });
});
