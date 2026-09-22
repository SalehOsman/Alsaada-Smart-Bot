import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobMatrixHandler } from '../flow.handler.js';
import type { JobMatrixService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.3 Integration Tests — الهيكل الوظيفي ومصفوفة المهن والورديات', () => {
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

  it('coordinates handler rendering with department service for Super Admin', async () => {
    // Arrange
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
    } as unknown as JobMatrixService;

    const handler = new JobMatrixHandler(mockService);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderDepartmentsHub(ctx);

    // Assert
    expect(replyMock).toHaveBeenCalledTimes(1);
    expect(mockService.listDepartments).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthenticated or unauthorized role attempting to access departments hub', async () => {
    // Arrange
    const mockService = {
      listDepartments: vi.fn().mockResolvedValue([]),
    } as unknown as JobMatrixService;

    const handler = new JobMatrixHandler(mockService);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxUnauthorized = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      reply: replyMock,
      from: { id: 111222333 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderDepartmentsHub(ctxUnauthorized);

    // Assert
    expect(mockService.listDepartments).not.toHaveBeenCalled();
    expect(replyMock).toHaveBeenCalledWith('🔒 مخصص حصرياً للمدير العام.');
  });

  it('tracks upload pending state accurately for pending versus non-pending users', () => {
    // Arrange
    const mockService = {} as unknown as JobMatrixService;
    const handler = new JobMatrixHandler(mockService);
    const registeredUserId = 'user-99';
    const nonRegisteredUserId = 'user-00';

    // Act
    (handler as unknown as { pendingUploads: Set<string> }).pendingUploads.add(registeredUserId);
    const isRegisteredWaiting = handler.isWaitingForUpload(registeredUserId);
    const isNonRegisteredWaiting = handler.isWaitingForUpload(nonRegisteredUserId);

    // Assert
    expect(isRegisteredWaiting).toBe(true);
    expect(isNonRegisteredWaiting).toBe(false);
  });
});
