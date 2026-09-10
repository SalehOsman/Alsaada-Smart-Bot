import { describe, it, expect, vi } from 'vitest';
import { SitesHubHandler } from '../flow.handler.js';
import type { SitesHubService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

describe('Flow 00.2 Integration Tests — مصفوفة المشاريع والمواقع الميدانية', () => {
  it('should coordinate handler execution with service', async () => {
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
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    await handler.renderSitesHub(ctx);
    expect(replyMock).toHaveBeenCalledTimes(1);
  });
});
