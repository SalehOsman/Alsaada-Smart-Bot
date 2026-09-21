import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CorporateProfileHandler } from '../flow.handler.js';
import type { CorporateProfileService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.1 Integration Tests — الملف التعريفي وبيانات الشركة', () => {
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

  it('coordinates handler execution with service and renders card for Super Admin', async () => {
    // Arrange
    const mockService = {
      clearPendingEdit: vi.fn().mockResolvedValue(undefined),
      clearWizardState: vi.fn().mockResolvedValue(undefined),
      clearEditState: vi.fn().mockResolvedValue(undefined),
      getProfile: vi.fn().mockResolvedValue({
        id: 'cp-1',
        legalName: 'شركة السعادة للمقاولات العامة',
        tradeName: 'السعادة',
        commercialRegistrationNumber: '12345',
        taxRegistrationNumber: '67890',
        headquartersAddress: 'القاهرة',
        primaryPhone: '01000000000',
        officialEmail: 'info@alsaada.com',
        baseCurrency: 'EGP',
      }),
      listSites: vi.fn().mockResolvedValue([]),
      listDepartments: vi.fn().mockResolvedValue([]),
      listAdminUsers: vi.fn().mockResolvedValue([]),
      getApmSummary: vi.fn().mockResolvedValue({ totalOps24h: 0, avgLatencyMs: 0, greenPct: 100, yellowPct: 0, redPct: 0 }),
      getMaintenanceStatus: vi.fn().mockResolvedValue({ isMaintenanceActive: false }),
    } as unknown as CorporateProfileService;

    const handler = new CorporateProfileHandler(mockService);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderCard(ctx);

    // Assert
    expect(replyMock).toHaveBeenCalledTimes(1);
    expect(mockService.getProfile).toHaveBeenCalled();
    expect(mockService.clearPendingEdit).toHaveBeenCalledWith(7594239391n);
  });

  it('renders card in-place via editMessageText when requested on callback', async () => {
    // Arrange
    const mockService = {
      clearPendingEdit: vi.fn().mockResolvedValue(undefined),
      getProfile: vi.fn().mockResolvedValue(null),
    } as unknown as CorporateProfileService;

    const handler = new CorporateProfileHandler(mockService);
    const editMock = vi.fn().mockResolvedValue({});
    const answerMock = vi.fn().mockResolvedValue(true);
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: { data: 'nav:settings:corporate' },
      editMessageText: editMock,
      answerCallbackQuery: answerMock,
      from: { id: 123456 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderCard(ctx, true);

    // Assert
    expect(editMock).toHaveBeenCalledTimes(1);
    expect(answerMock).toHaveBeenCalled();
  });

  it('rejects text input when no pending edit state exists for user', async () => {
    // Arrange
    const mockService = {
      getPendingEdit: vi.fn().mockResolvedValue(null),
      updateField: vi.fn(),
    } as unknown as CorporateProfileService;

    const handler = new CorporateProfileHandler(mockService);
    const ctx = {
      from: { id: 999888 },
      message: { text: 'New Name' },
    } as unknown as SettingsModuleContext;

    // Act
    const handled = await handler.handleTextInput(ctx);

    // Assert
    expect(handled).toBe(false);
    expect(mockService.updateField).not.toHaveBeenCalled();
  });
});
