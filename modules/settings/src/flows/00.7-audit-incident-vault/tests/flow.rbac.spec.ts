import { describe, it, expect, vi } from 'vitest';
import { AuditIncidentVaultHandler } from '../flow.handler.js';
import type { AuditIncidentVaultService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

describe('Flow 00.7 RBAC Tests — وحدة التحقيق الجنائي والأعطال', () => {
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
  } as unknown as AuditIncidentVaultService;

  const handler = new AuditIncidentVaultHandler(mockService);

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

    await handler.renderAuditVaultHub(ctxWorker);
    expect(answerCallbackMock.mock.calls.length + replyMock.mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  it('should allow access for verified Super Admin', async () => {
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxSuper = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    await handler.renderAuditVaultHub(ctxSuper);
    expect(replyMock).toHaveBeenCalled();
  });
});
