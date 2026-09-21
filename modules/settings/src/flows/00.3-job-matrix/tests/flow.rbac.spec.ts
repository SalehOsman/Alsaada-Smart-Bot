import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobMatrixHandler } from '../flow.handler.js';
import type { JobMatrixService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.3 RBAC Tests — الهيكل الوظيفي ومصفوفة المهن والورديات', () => {
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

  const createMockService = (): JobMatrixService =>
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
    } as unknown as JobMatrixService);

  it('denies worker role attempting callback interaction with alert pop-up', async () => {
    // Arrange
    const service = createMockService();
    const handler = new JobMatrixHandler(service);
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
    await handler.renderDepartmentsHub(ctxWorker);

    // Assert
    expect(answerCallbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('مخصص حصرياً للمدير العام'),
        show_alert: true,
      })
    );
    expect(replyMock).not.toHaveBeenCalled();
  });

  it('denies supervisor role without super admin clearance', async () => {
    // Arrange
    const service = createMockService();
    const handler = new JobMatrixHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxSupervisor = {
      isRealSuperAdmin: false,
      effectiveRole: 'SUPERVISOR',
      reply: replyMock,
      from: { id: 222333444 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderDepartmentsHub(ctxSupervisor);

    // Assert
    expect(replyMock).toHaveBeenCalledWith('🔒 مخصص حصرياً للمدير العام.');
  });

  it('authorizes verified Super Admin access unconditionally', async () => {
    // Arrange
    const service = createMockService();
    const handler = new JobMatrixHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxSuper = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderDepartmentsHub(ctxSuper);

    // Assert
    expect(replyMock).toHaveBeenCalledTimes(1);
    expect(service.listDepartments).toHaveBeenCalledTimes(1);
  });
});
