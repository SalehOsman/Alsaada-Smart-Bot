import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dashboardAuthService,
  AUTHORIZED_DASHBOARD_ROLES,
  type AuthorizedDashboardRole,
} from '../src/services/dashboard-auth.service.js';
import { handleDashboardCommand } from '../src/handlers/dashboard.handler.js';
import { prisma } from '../src/db.js';
import { redis } from '../src/redis.js';
import { config } from '../src/config/env.js';
import type { MyContext } from '../src/types/context.js';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    dashboardAuthLink: {
      create: vi.fn().mockResolvedValue({ id: 'auth-link-uuid' }),
    },
    dashboardSession: {
      create: vi.fn().mockResolvedValue({ id: 'session-uuid' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn().mockImplementation((actions) => Array.isArray(actions) ? Promise.all(actions) : actions()),
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-log-uuid' }),
    },
  },
}));

vi.mock('../src/redis.js', () => ({
  redis: {
    status: 'ready',
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
  },
}));

describe('Adversarial Stress Test: Bot Command /dashboard Access Control & Group Privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Section 1: Access Control & Role Boundary Rejections
  // ==========================================================================
  describe('1. Access Control Rejection for Unauthorized, Banned & Non-Existent Users', () => {
    it('rejects non-existent (unregistered) user, logs DASHBOARD_ACCESS_DENIED, and replies with rejection message', async () => {
      const nonExistentTelegramId = 9999888877n;
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      // Test service directly
      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: nonExistentTelegramId,
        username: 'unknown_attacker',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('USER_NOT_FOUND');
        expect(result.user).toBeNull();
      }

      // Verify AuditLog record
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorTelegramId: nonExistentTelegramId,
            action: 'DASHBOARD_ACCESS_DENIED',
            entityType: 'DashboardAuth',
            afterPayload: expect.objectContaining({
              reason: 'USER_NOT_FOUND',
              role: 'UNREGISTERED',
            }),
          }),
        })
      );

      // Test bot handler response
      const mockCtx = {
        from: {
          id: Number(nonExistentTelegramId),
          username: 'unknown_attacker',
        },
        chat: { type: 'private' },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      await handleDashboardCommand(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('عذراً، الوصول غير مصرح به'),
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🏠 القائمة الرئيسية',
                  callback_data: 'action:main_menu',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('rejects unauthorized roles (WORKER, SUPPLIER, GUEST) with UNAUTHORIZED_ROLE and logs denial', async () => {
      const unauthorizedRoles = ['WORKER', 'SUPPLIER', 'GUEST', 'CONTRACTOR'];

      for (const role of unauthorizedRoles) {
        const telegramId = BigInt(1000000 + Math.floor(Math.random() * 9000000));
        vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
          id: `usr-${role.toLowerCase()}-01`,
          telegramId,
          fullName: `عامل تجريبي ${role}`,
          role,
          isActive: true,
          isBanned: false,
        } as any);

        const result = await dashboardAuthService.issueDashboardAccess({
          telegramId,
          username: `test_${role.toLowerCase()}`,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.reason).toBe('UNAUTHORIZED_ROLE');
          expect(result.user?.role).toBe(role);
        }

        expect(prisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              actorTelegramId: telegramId,
              action: 'DASHBOARD_ACCESS_DENIED',
              entityType: 'DashboardAuth',
              afterPayload: expect.objectContaining({
                reason: 'UNAUTHORIZED_ROLE',
                role,
              }),
            }),
          })
        );
      }
    });

    it('strictly rejects BANNED user even if they hold SUPER_ADMIN role', async () => {
      const bannedTelegramId = 4455667788n;
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-banned-superadmin',
        telegramId: bannedTelegramId,
        fullName: 'أدمن محظور جنائياً',
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: true, // BANNED
      } as any);

      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: bannedTelegramId,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('ACCOUNT_BANNED');
      }

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorTelegramId: bannedTelegramId,
            action: 'DASHBOARD_ACCESS_DENIED',
            afterPayload: expect.objectContaining({
              reason: 'ACCOUNT_BANNED',
              role: 'SUPER_ADMIN',
            }),
          }),
        })
      );

      // Verify handler response displays 'محظور'
      const mockCtx = {
        from: { id: Number(bannedTelegramId), first_name: 'محظور' },
        chat: { type: 'private' },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-banned-superadmin',
        telegramId: bannedTelegramId,
        fullName: 'أدمن محظور جنائياً',
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: true,
      } as any);

      await handleDashboardCommand(mockCtx);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('محظور'),
        expect.any(Object)
      );
    });

    it('strictly rejects INACTIVE (deactivated) user even if they hold SUPER_ADMIN role', async () => {
      const inactiveTelegramId = 3322110099n;
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-inactive-superadmin',
        telegramId: inactiveTelegramId,
        fullName: 'أدمن معطل مؤقتاً',
        role: 'SUPER_ADMIN',
        isActive: false, // DEACTIVATED
        isBanned: false,
      } as any);

      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: inactiveTelegramId,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('ACCOUNT_INACTIVE');
      }

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorTelegramId: inactiveTelegramId,
            action: 'DASHBOARD_ACCESS_DENIED',
            afterPayload: expect.objectContaining({
              reason: 'ACCOUNT_INACTIVE',
              role: 'SUPER_ADMIN',
            }),
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Section 2: Group Chat Privacy Guard (Token Leakage Prevention)
  // ==========================================================================
  describe('2. Group Chat Privacy Guard & Token Leakage Prevention', () => {
    it('group chat invocation: sends token strictly to user private DM, NEVER in group chat', async () => {
      const userTelegramId = 77665544n;
      const groupChatId = -1001234567890;

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-fa-001',
        telegramId: userTelegramId,
        fullName: 'م. سامح مشرف الموقع',
        role: 'FIELD_ADMIN',
        isActive: true,
        isBanned: false,
        assignedSiteId: 'site-capital',
        assignedSite: { name: 'العاصمة الإدارية' },
      } as any);

      const mockCtx = {
        from: {
          id: Number(userTelegramId),
          first_name: 'سامح',
          last_name: 'المهندس',
        },
        chat: {
          id: groupChatId,
          type: 'group',
        },
        api: {
          sendMessage: vi.fn().mockResolvedValue({}),
        },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      config.dashboardTunnelUrl = 'https://tunnel.alsaada.example';
      config.dashboardLocalUrl = 'http://localhost:3002';
      await handleDashboardCommand(mockCtx);

      // 1. Check private message (DM) was sent to user ID
      expect(mockCtx.api.sendMessage).toHaveBeenCalledTimes(1);
      const dmCall = vi.mocked(mockCtx.api.sendMessage).mock.calls[0] as [number, string, any];
      expect(dmCall[0]).toBe(Number(userTelegramId));
      const dmText = dmCall[1] as string;
      expect(dmText).toContain('رابط الدخول المباشر للوحة التحكم المؤسسية');

      const dmOptions = dmCall[2] as any;
      expect(dmOptions.parse_mode).toBe('HTML');
      const flatButtons = dmOptions.reply_markup.inline_keyboard.flat();
      const tunnelBtn = flatButtons.find((btn: any) => btn.text === '🌐 فتح عبر النفق (Tunnel)');
      expect(tunnelBtn).toBeDefined();
      expect(tunnelBtn.url).toContain('/api/auth/claim?token=');

      // 2. Check group reply: MUST NEVER contain token or URL!
      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      const groupReplyCall = vi.mocked(mockCtx.reply).mock.calls[0] as [string, any];
      const groupReplyText = groupReplyCall[0] as string;

      expect(groupReplyText).toContain('تم إرسال رابط الدخول المباشر إلى محادثتك الخاصة');
      expect(groupReplyText).not.toContain('/api/auth/claim');
      expect(groupReplyText).not.toContain('token=');
      expect(groupReplyCall[1]?.reply_markup).toBeUndefined(); // Zero inline buttons in group
    });

    it('supergroup chat invocation: guarantees privacy and zero token leakage in supergroups', async () => {
      const userTelegramId = 66554433n;
      const supergroupId = -1009876543210;

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-fa-002',
        telegramId: userTelegramId,
        fullName: 'مشرف الموقع الميداني',
        role: 'FIELD_ADMIN',
        isActive: true,
        isBanned: false,
      } as any);

      const mockCtx = {
        from: {
          id: Number(userTelegramId),
          first_name: 'المدير',
        },
        chat: {
          id: supergroupId,
          type: 'supergroup',
        },
        api: {
          sendMessage: vi.fn().mockResolvedValue({}),
        },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      await handleDashboardCommand(mockCtx);

      expect(mockCtx.api.sendMessage).toHaveBeenCalledWith(
        Number(userTelegramId),
        expect.stringContaining('رابط الدخول المباشر للوحة التحكم المؤسسية'),
        expect.any(Object)
      );

      // Group reply contains notice only, zero token
      const groupText = vi.mocked(mockCtx.reply).mock.calls[0]![0] as string;
      expect(groupText).not.toContain('token=');
      expect(groupText).not.toContain('/api/auth/claim');
    });

    it('handles blocked DM failure gracefully without leaking token in group', async () => {
      const userTelegramId = 12344321n;

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-fa-003',
        telegramId: userTelegramId,
        fullName: 'أ. محمود المشرف',
        role: 'FIELD_ADMIN',
        isActive: true,
        isBanned: false,
      } as any);

      const mockCtx = {
        from: { id: Number(userTelegramId), first_name: 'محمود' },
        chat: { id: -10055555, type: 'group' },
        api: {
          sendMessage: vi.fn().mockRejectedValue(new Error('Forbidden: bot was blocked by the user')),
        },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      await handleDashboardCommand(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('تعذر إرسال الرابط في الخاص'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );

      const groupText = vi.mocked(mockCtx.reply).mock.calls[0]![0] as string;
      expect(groupText).not.toContain('token=');
      expect(groupText).not.toContain('/api/auth/claim');
    });
  });
});
