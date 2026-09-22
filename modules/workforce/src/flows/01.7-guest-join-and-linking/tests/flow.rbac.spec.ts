import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GuestJoinHandler } from '../flow.handler.js';
import { GuestJoinService } from '../flow.service.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';

describe('01.7 Guest Join & WhatsApp Linking — RBAC Tests', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('prevents already registered non-guest users from submitting guest join requests', async () => {
    // Arrange
    const mockService = {} as unknown as GuestJoinService;
    const handler = new GuestJoinHandler(mockService);

    const ctx = {
      from: { id: 123456 },
      effectiveRole: 'WORKER',
      callbackQuery: { data: 'wizard:guest_join:start' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleStartGuestJoin(ctx);

    // Assert
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('حسابك مسجل ومفعل بالفعل'),
        show_alert: true,
      })
    );
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('allows guest users to initiate guest join wizard', async () => {
    // Arrange
    const mockService = {
      getCompanyTradeName: vi.fn().mockResolvedValue('شركة السعادة المحدودة'),
    } as unknown as GuestJoinService;
    const handler = new GuestJoinHandler(mockService);

    const ctx = {
      from: { id: 987123 },
      effectiveRole: 'GUEST',
      callbackQuery: {
        data: 'wizard:guest_join:start',
        message: { message_id: 101 },
      },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleStartGuestJoin(ctx);

    // Assert
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('تقديم طلب انضمام'),
      expect.objectContaining({})
    );
    expect(ctx.reply).not.toHaveBeenCalledWith(
      expect.stringContaining('حسابك مسجل ومفعل بالفعل')
    );
  });

  it('blocks non-admin users from generating administrative linking links', async () => {
    // Arrange
    const mockService = {} as unknown as GuestJoinService;
    const handler = new GuestJoinHandler(mockService);

    const ctx = {
      from: { id: 987654 },
      effectiveRole: 'GUEST',
      callbackQuery: { data: 'action:guest_join:gen:OP-01:987654' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleGenerateAdminLink(ctx, 'OP-01', 987654n);

    // Assert
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('غير مصرح لك'),
        show_alert: true,
      })
    );
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('allows field admin users to generate administrative linking links', async () => {
    // Arrange
    const mockService = {
      searchWorkerForGuest: vi.fn().mockResolvedValue({
        id: 'w-1',
        code: 'OP-01',
        name: 'علي حسن',
        phoneEncrypted: '01012345678',
      }),
      decryptFieldSafe: vi.fn().mockReturnValue('01012345678'),
      generateVerificationWhatsAppUrl: vi.fn().mockReturnValue({
        whatsAppUrl: 'https://wa.me/201012345678?text=link',
        deepLink: 'https://t.me/AlsaadaSmartBot?start=link_OP-01',
      }),
    } as unknown as GuestJoinService;
    const handler = new GuestJoinHandler(mockService);

    const ctx = {
      from: { id: 998877 },
      effectiveRole: 'FIELD_ADMIN',
      callbackQuery: {
        data: 'action:guest_join:gen:OP-01:987654',
        message: { message_id: 202 },
      },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleGenerateAdminLink(ctx, 'OP-01', 987654n);

    // Assert
    expect(mockService.searchWorkerForGuest).toHaveBeenCalledWith('OP-01');
    expect(mockService.generateVerificationWhatsAppUrl).toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('غير مصرح لك') })
    );
  });
});
