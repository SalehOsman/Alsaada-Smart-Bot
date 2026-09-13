import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionMonitorService } from '../src/services/session-monitor.service.js';
import { handleSessionCallbacks } from '../src/handlers/dashboard.handler.js';
import { dashboardAuthService } from '../src/services/dashboard-auth.service.js';
import { prisma } from '../src/db.js';
import type { MyContext } from '../src/types/context.js';

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
    vi.clearAllMocks();
  });

  describe('SessionMonitorService', () => {
    it('sends warning notification with compact callbacks and updates noticeSentAt', async () => {
      const monitor = new SessionMonitorService();
      const mockApi = {
        sendMessage: vi.fn().mockResolvedValue({}),
      } as any;

      const now = new Date();
      const mockSession = {
        id: 'sess-uuid-1234-5678-abcd',
        actorTelegramId: 987654321n,
        originKind: 'TUNNEL',
        deviceSummary: 'Mozilla/5.0 Chrome Windows',
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000), // 30 mins remaining
        noticeSentAt: null,
      };

      vi.mocked(prisma.dashboardSession.findMany).mockResolvedValueOnce([mockSession] as any);
      vi.mocked(prisma.dashboardSession.update).mockResolvedValueOnce(mockSession as any);

      const count = await monitor.checkExpiringSessions(mockApi);

      expect(count).toBe(1);
      expect(mockApi.sendMessage).toHaveBeenCalledTimes(1);

      const [targetId, text, options] = mockApi.sendMessage.mock.calls[0];
      expect(targetId).toBe(987654321);
      expect(text).toContain('اقتراب انتهاء جلسة لوحة التحكم');
      expect(text).toContain('30 دقيقة');

      // Check callback buttons adhere strictly to <= 64 bytes
      const buttons = options.reply_markup.inline_keyboard.flat();
      const extBtn = buttons.find((b: any) => b.callback_data?.startsWith('sess_ext:'));
      expect(extBtn).toBeDefined();
      expect(extBtn.callback_data).toBe(`sess_ext:${mockSession.id}`);
      expect(Buffer.byteLength(extBtn.callback_data, 'utf8')).toBeLessThanOrEqual(64);

      const revBtn = buttons.find((b: any) => b.callback_data?.startsWith('sess_rev:'));
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
      vi.spyOn(dashboardAuthService, 'extendSession').mockResolvedValueOnce({
        success: true,
        newExpiresAt: new Date(Date.now() + 8 * 3600 * 1000),
      });

      const mockCtx = {
        from: { id: 987654321 },
        callbackQuery: { data: 'sess_ext:sess-uuid-1234-5678-abcd' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      const handled = await handleSessionCallbacks(mockCtx);

      expect(handled).toBe(true);
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
      vi.spyOn(dashboardAuthService, 'revokeSession').mockResolvedValueOnce({
        success: true,
      });

      const mockCtx = {
        from: { id: 987654321 },
        callbackQuery: { data: 'sess_rev:sess-uuid-1234-5678-abcd' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      const handled = await handleSessionCallbacks(mockCtx);

      expect(handled).toBe(true);
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
      vi.spyOn(dashboardAuthService, 'revokeAllSessions').mockResolvedValueOnce({
        count: 3,
      });

      const mockCtx = {
        from: { id: 987654321 },
        callbackQuery: { data: 'sess_rev_all' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      const handled = await handleSessionCallbacks(mockCtx);

      expect(handled).toBe(true);
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
      vi.spyOn(dashboardAuthService, 'getActiveSessions').mockResolvedValueOnce([
        {
          id: 'sess-1',
          originKind: 'TUNNEL',
          deviceSummary: 'Chrome on Win',
          expiresAt: new Date(Date.now() + 4 * 3600 * 1000),
          createdAt: new Date(),
        } as any,
      ]);

      const mockCtx = {
        from: { id: 987654321 },
        callbackQuery: { data: 'sess_list' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      const handled = await handleSessionCallbacks(mockCtx);

      expect(handled).toBe(true);
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
