import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionMonitorService } from '../src/services/session-monitor.service.js';
import { handleSessionCallbacks } from '../src/handlers/dashboard.handler.js';
import { dashboardAuthService } from '../src/services/dashboard-auth.service.js';
import { prisma } from '../src/db.js';
import type { MyContext } from '../src/types/context.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

vi.mock('../src/db.js', () => ({
  prisma: {
    dashboardSession: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-uuid' }),
    },
  },
}));

describe('Task 6: Session Lifecycle & Expiry Notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('SessionMonitorService', () => {
    it('sends warning notification with compact callbacks and updates noticeSentAt', async () => {
      // Arrange
      const monitor = new SessionMonitorService();
      const mockApi = {
        sendMessage: vi.fn().mockResolvedValue({}),
      } as unknown as Parameters<SessionMonitorService['checkExpiringSessions']>[0];

      const now = PINNED_BASE_TIME;
      const mockSession = {
        id: 'sess-uuid-1234-5678-abcd',
        actorTelegramId: 987654321n,
        originKind: 'TUNNEL',
        deviceSummary: 'Mozilla/5.0 Chrome Windows',
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000), // 30 mins remaining
        noticeSentAt: null,
      };

      vi.mocked(prisma.dashboardSession.findMany).mockResolvedValueOnce([mockSession] as unknown as ReturnType<typeof prisma.dashboardSession.findMany> extends Promise<infer U> ? U : never);
      vi.mocked(prisma.dashboardSession.update).mockResolvedValueOnce(mockSession as unknown as ReturnType<typeof prisma.dashboardSession.update> extends Promise<infer U> ? U : never);

      // Act
      const count = await monitor.checkExpiringSessions(mockApi);

      // Assert
      expect(count).toBe(1);
      expect(count).not.toBe(0);
      expect(mockApi.sendMessage).toHaveBeenCalledTimes(1);

      const callArgs = (mockApi.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const [targetId, text, options] = callArgs;
      expect(targetId).toBe(987654321);
      expect(text).toContain('اقتراب انتهاء جلسة لوحة التحكم');
      expect(text).toContain('30 دقيقة');

      // Check callback buttons adhere strictly to <= 64 bytes
      const buttons = options.reply_markup.inline_keyboard.flat();
      const extBtn = buttons.find((b: { callback_data?: string }) => b.callback_data?.startsWith('sess_ext:'));
      expect(extBtn).toBeDefined();
      expect(extBtn.callback_data).toBe(`sess_ext:${mockSession.id}`);
      expect(Buffer.byteLength(extBtn.callback_data, 'utf8')).toBeLessThanOrEqual(64);

      const revBtn = buttons.find((b: { callback_data?: string }) => b.callback_data?.startsWith('sess_rev:'));
      expect(revBtn).toBeDefined();
      expect(revBtn.callback_data).toBe(`sess_rev:${mockSession.id}`);
      expect(Buffer.byteLength(revBtn.callback_data, 'utf8')).toBeLessThanOrEqual(64);

      expect(prisma.dashboardSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSession.id },
          data: expect.objectContaining({ noticeSentAt: expect.any(Date) }),
        })
      );
    });
  });

  describe('handleSessionCallbacks', () => {
    it('extends session by 8 hours on sess_ext callback', async () => {
      // Arrange
      vi.spyOn(dashboardAuthService, 'extendSession').mockResolvedValueOnce({
        success: true,
        newExpiresAt: new Date(PINNED_BASE_TIME.getTime() + 8 * 3600 * 1000),
      });

      const mockCtx = {
        from: { id: 987654321 },
        callbackQuery: { data: 'sess_ext:sess-uuid-1234-5678-abcd' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      // Act
      const handled = await handleSessionCallbacks(mockCtx);

      // Assert
      expect(handled).toBe(true);
      expect(handled).not.toBe(false);
      expect(dashboardAuthService.extendSession).toHaveBeenCalledWith(
        'sess-uuid-1234-5678-abcd',
        987654321n
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('تم تمديد الجلسة بنجاح'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    it('revokes session immediately on sess_rev callback', async () => {
      // Arrange
      vi.spyOn(dashboardAuthService, 'revokeSession').mockResolvedValueOnce({
        success: true,
      });

      const mockCtx = {
        from: { id: 987654321 },
        callbackQuery: { data: 'sess_rev:sess-uuid-1234-5678-abcd' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      // Act
      const handled = await handleSessionCallbacks(mockCtx);

      // Assert
      expect(handled).toBe(true);
      expect(handled).not.toBe(false);
      expect(dashboardAuthService.revokeSession).toHaveBeenCalledWith(
        'sess-uuid-1234-5678-abcd',
        'USER_TELEGRAM_REVOCATION',
        987654321n
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('تم إنهاء الجلسة فورياً بنجاح'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    it('revokes all sessions on sess_rev_all callback', async () => {
      // Arrange
      vi.spyOn(dashboardAuthService, 'revokeAllSessions').mockResolvedValueOnce({
        count: 3,
      });

      const mockCtx = {
        from: { id: 987654321 },
        callbackQuery: { data: 'sess_rev_all' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      // Act
      const handled = await handleSessionCallbacks(mockCtx);

      // Assert
      expect(handled).toBe(true);
      expect(handled).not.toBe(false);
      expect(dashboardAuthService.revokeAllSessions).toHaveBeenCalledWith(
        987654321n,
        'USER_REVOKED_ALL_TELEGRAM'
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('تم إنهاء كافة جلساتك النشطة'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    it('lists active sessions on sess_list callback', async () => {
      // Arrange
      vi.spyOn(dashboardAuthService, 'getActiveSessions').mockResolvedValueOnce([
        {
          id: 'sess-1',
          originKind: 'TUNNEL',
          deviceSummary: 'Chrome on Win',
          expiresAt: new Date(PINNED_BASE_TIME.getTime() + 4 * 3600 * 1000),
          createdAt: PINNED_BASE_TIME,
        } as unknown as Awaited<ReturnType<typeof dashboardAuthService.getActiveSessions>>[number],
      ]);

      const mockCtx = {
        from: { id: 987654321 },
        callbackQuery: { data: 'sess_list' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      // Act
      const handled = await handleSessionCallbacks(mockCtx);

      // Assert
      expect(handled).toBe(true);
      expect(handled).not.toBe(false);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('جلسات لوحة التحكم النشطة لحسابك (1)'),
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.any(Object),
        })
      );
    });
  });
});
