import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmergencyCacheHandler } from '../flow.handler.js';
import type { EmergencyCacheService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.9 Integration Tests — صمامات الطوارئ والذاكرة اللحظية', () => {
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

  const createMockService = (): EmergencyCacheService =>
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
      prewarmCache: vi.fn().mockResolvedValue({ workersLoaded: 10, sitesLoaded: 2, departmentsLoaded: 3, jobsLoaded: 5, durationMs: 12 }),
    } as unknown as EmergencyCacheService);

  it('coordinates handler execution with emergency cache service for verified Super Admin', async () => {
    // Arrange
    const service = createMockService();
    const handler = new EmergencyCacheHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderEmergencyCacheHub(ctx);

    // Assert
    expect(replyMock).toHaveBeenCalledTimes(1);
    expect(service.getMaintenanceStatus).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthorized worker role attempting to access emergency controls', async () => {
    // Arrange
    const service = createMockService();
    const handler = new EmergencyCacheHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxUnauthorized = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      reply: replyMock,
      from: { id: 12345 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderEmergencyCacheHub(ctxUnauthorized);

    // Assert
    expect(replyMock).not.toHaveBeenCalled();
    expect(service.getMaintenanceStatus).not.toHaveBeenCalled();
  });
});
