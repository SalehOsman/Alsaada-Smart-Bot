import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CorporateProfileHandler } from '../flow.handler.js';
import type { CorporateProfileService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.1 RBAC Tests — الملف التعريفي وبيانات الشركة', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
  } as unknown as CorporateProfileService;

  const handler = new CorporateProfileHandler(mockService);

  it('denies and alerts unauthorized worker roles attempting to access corporate profile', async () => {
    // Arrange
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
    await handler.renderCard(ctxWorker);

    // Assert
    expect(answerCallbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('مخصص حصرياً للمدير العام'),
        show_alert: true,
      })
    );
    expect(replyMock).not.toHaveBeenCalled();
  });

  it('permits unrestricted access for authenticated Super Admin', async () => {
    // Arrange
    const replyMock = vi.fn().mockResolvedValue({});
    const ctxSuper = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      replyWithRichMessage: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderCard(ctxSuper);

    // Assert
    expect(replyMock).toHaveBeenCalledTimes(1);
    expect(replyMock).not.toHaveBeenCalledWith(expect.stringContaining('مخصص حصرياً للمدير العام'));
  });

  it('denies edit attempts initiated by unauthorized field administrators', async () => {
    // Arrange
    const answerCallbackMock = vi.fn().mockResolvedValue(true);
    const ctxFieldAdmin = {
      isRealSuperAdmin: false,
      effectiveRole: 'FIELD_ADMIN',
      callbackQuery: { data: 'edit:legalName', message: { message_id: 101 } },
      answerCallbackQuery: answerCallbackMock,
      from: { id: 112233 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.handleStartEdit(ctxFieldAdmin, 'legalName');

    // Assert
    expect(mockService.clearPendingEdit).not.toHaveBeenCalledWith(112233n);
  });
});
