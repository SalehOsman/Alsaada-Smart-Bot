import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminAssignmentHandler } from '../flow.handler.js';
import type { AdminAssignmentService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.5 RBAC Tests — تعيين وتوزيع مدراء المواقع', () => {
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

  it('denies worker role callback interaction with modal alert', async () => {
    // Arrange
    const service = createMockService();
    const handler = new AdminAssignmentHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);
    const ctxWorker = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      reply: replyMock,
      callbackQuery: { data: 'test' },
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderAdminAssignmentsHub(ctxWorker);

    // Assert
    expect(answerCallbackMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('🔒'), show_alert: true })
    );
    expect(replyMock).not.toHaveBeenCalled();
  });

  it('blocks direct command invocation from non-super admin users', async () => {
    // Arrange
    const service = createMockService();
    const handler = new AdminAssignmentHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxWorker = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      reply: replyMock,
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderAdminAssignmentsHub(ctxWorker);

    // Assert
    expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('🔒'));
  });

  it('blocks unauthorized users from updating site assignment scope', async () => {
    // Arrange
    const service = createMockService();
    const handler = new AdminAssignmentHandler(service);
    const ctxWorker = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
    } as unknown as SettingsModuleContext;

    // Act
    await handler.handleSetUserSiteAssignment(ctxWorker, 12345n, 'GLOBAL');

    // Assert
    expect(service.setAssignment).not.toHaveBeenCalled();
  });

  it('grants full access for verified Super Admin', async () => {
    // Arrange
    const service = createMockService();
    const handler = new AdminAssignmentHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxSuper = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderAdminAssignmentsHub(ctxSuper);

    // Assert
    expect(replyMock).toHaveBeenCalledTimes(1);
    expect(service.listAdminUsers).toHaveBeenCalledTimes(1);
  });
});
