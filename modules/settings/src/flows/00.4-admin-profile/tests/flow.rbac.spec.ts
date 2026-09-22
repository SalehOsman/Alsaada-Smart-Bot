import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminProfileHandler } from '../flow.handler.js';
import type { AdminProfileService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.4 RBAC Tests — الملف الشخصي للمدير العام', () => {
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

  const createMockService = (): AdminProfileService =>
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
    } as unknown as AdminProfileService);

  it('rejects access and warns unrecorded users missing database account profile', async () => {
    // Arrange
    const service = createMockService();
    const handler = new AdminProfileHandler(service);
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

    // Act
    await handler.renderAdminProfile(ctxWorker);

    // Assert
    expect(answerCallbackMock).toHaveBeenCalled();
    expect(replyMock).toHaveBeenCalledWith('⚠️ لم يتم العثور على سجل حسابك في قاعدة البيانات.');
  });

  it('grants full profile view to verified Super Admin with valid registered profile', async () => {
    // Arrange
    const service = createMockService();
    vi.mocked(service.getProfile).mockResolvedValue({
      id: 'admin-1',
      telegramId: 7594239391n,
      role: 'SUPER_ADMIN',
      fullName: 'Super Admin User',
      phone: '01012345678',
      assignedSiteName: null,
      isActive: true,
    });

    const handler = new AdminProfileHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxSuper = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderAdminProfile(ctxSuper);

    // Assert
    expect(replyMock).toHaveBeenCalledWith(
      expect.stringContaining('الملف الشخصي'),
      expect.objectContaining({
        parse_mode: 'Markdown',
      })
    );
  });
});
