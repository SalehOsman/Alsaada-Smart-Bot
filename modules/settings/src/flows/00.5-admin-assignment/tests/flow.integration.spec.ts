import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminAssignmentHandler } from '../flow.handler.js';
import type { AdminAssignmentService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.5 Integration Tests — تعيين وتوزيع مدراء المواقع', () => {
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

  const createMockService = (): AdminAssignmentService =>
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
      setAssignment: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as AdminAssignmentService);

  it('coordinates hub rendering with service for verified Super Admin', async () => {
    // Arrange
    const service = createMockService();
    const handler = new AdminAssignmentHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderAdminAssignmentsHub(ctx);

    // Assert
    expect(replyMock).toHaveBeenCalledTimes(1);
    expect(service.listAdminUsers).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthorized role attempting to access admin assignments hub', async () => {
    // Arrange
    const service = createMockService();
    const handler = new AdminAssignmentHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxUnauthorized = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      reply: replyMock,
      from: { id: 12345 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderAdminAssignmentsHub(ctxUnauthorized);

    // Assert
    expect(service.listAdminUsers).not.toHaveBeenCalled();
    expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('🔒'));
  });
});
