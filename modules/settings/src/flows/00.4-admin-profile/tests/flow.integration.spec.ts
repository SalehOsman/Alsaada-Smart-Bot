import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminProfileHandler } from '../flow.handler.js';
import type { AdminProfileService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.4 Integration Tests — الملف الشخصي للمدير العام', () => {
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
      updateFullName: vi.fn().mockResolvedValue({ success: true }),
      updatePhone: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as AdminProfileService);

  it('coordinates handler execution with service when profile exists', async () => {
    // Arrange
    const service = createMockService();
    vi.mocked(service.getProfile).mockResolvedValue({
      id: 'admin-1',
      telegramId: 7594239391n,
      role: 'SUPER_ADMIN',
      fullName: 'صالح عثمان',
      phone: '01012345678',
      assignedSiteName: null,
      isActive: true,
    });
    const handler = new AdminProfileHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderAdminProfile(ctx);

    // Assert
    expect(replyMock).toHaveBeenCalledTimes(1);
    expect(service.getProfile).toHaveBeenCalledWith(7594239391n);
  });

  it('notifies user appropriately and refuses profile rendering when admin profile record is missing', async () => {
    // Arrange
    const service = createMockService();
    vi.mocked(service.getProfile).mockResolvedValue(null);
    const handler = new AdminProfileHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 999888777 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderAdminProfile(ctx);

    // Assert
    expect(service.getProfile).toHaveBeenCalledWith(999888777n);
    expect(service.updateFullName).not.toHaveBeenCalled();
    expect(replyMock).toHaveBeenCalledWith('⚠️ لم يتم العثور على سجل حسابك في قاعدة البيانات.');
  });
});
