import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditIncidentVaultHandler } from '../flow.handler.js';
import type { AuditIncidentVaultService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.7 Integration Tests — وحدة التحقيق الجنائي والأعطال', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const createMockService = (): AuditIncidentVaultService =>
    ({
      clearPendingEdit: vi.fn().mockResolvedValue(undefined),
      clearWizardState: vi.fn().mockResolvedValue(undefined),
      clearEditState: vi.fn().mockResolvedValue(undefined),
      getProfile: vi.fn().mockResolvedValue(null),
      listSites: vi.fn().mockResolvedValue([]),
      listDepartments: vi.fn().mockResolvedValue([]),
      listAdminUsers: vi.fn().mockResolvedValue([]),
      getApmSummary: vi.fn().mockResolvedValue({ totalOps24h: 0, avgLatencyMs: 0, greenPct: 100, yellowPct: 0, redPct: 0 }),
      getMaintenanceStatus: vi.fn().mockResolvedValue({ isMaintenanceActive: false }),
      getUserJourney: vi.fn().mockResolvedValue({ steps: [] }),
    } as unknown as AuditIncidentVaultService);

  it('coordinates handler execution with audit service for verified Super Admin', async () => {
    // Arrange
    const service = createMockService();
    const handler = new AuditIncidentVaultHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderAuditVaultHub(ctx);

    // Assert
    expect(replyMock).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthorized role attempting to access audit incident vault', async () => {
    // Arrange
    const service = createMockService();
    const handler = new AuditIncidentVaultHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxUnauthorized = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      reply: replyMock,
      from: { id: 12345 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderAuditVaultHub(ctxUnauthorized);

    // Assert
    expect(replyMock).not.toHaveBeenCalled();
    expect(service.getUserJourney).not.toHaveBeenCalled();
  });
});
