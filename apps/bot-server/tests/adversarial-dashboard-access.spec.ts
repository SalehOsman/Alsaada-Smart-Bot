import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

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
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // Section 1: Access Control & Role Boundary Rejections
  // ==========================================================================
  describe('1. Access Control Rejection for Unauthorized, Banned & Non-Existent Users', () => {
    it('rejects non-existent (unregistered) user at service level and logs DASHBOARD_ACCESS_DENIED', async () => {
      // Arrange
      const nonExistentTelegramId = 9999888877n;
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      // Act
      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: nonExistentTelegramId,
        username: 'unknown_attacker',
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('USER_NOT_FOUND');
        expect(result.user).toBeNull();
      }
      expect(result).not.toHaveProperty('token');
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
    });

    it('replies with rejection message and main menu button when unregistered user invokes dashboard command', async () => {
      // Arrange
      const nonExistentTelegramId = 9999888877n;
      const mockCtx = {
        from: {
          id: Number(nonExistentTelegramId),
          username: 'unknown_attacker',
        },
        chat: { type: 'private' },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      // Act
      await handleDashboardCommand(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
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
      expect(prisma.dashboardAuthLink.create).not.toHaveBeenCalled();
    });

    it('rejects unauthorized roles (WORKER, SUPPLIER, GUEST, CONTRACTOR) with UNAUTHORIZED_ROLE and logs denial', async () => {
      // Arrange
      const unauthorizedRoles = ['WORKER', 'SUPPLIER', 'GUEST', 'CONTRACTOR'] as const;
      const roleIds: Record<(typeof unauthorizedRoles)[number], bigint> = {
        WORKER: 1000001n,
        SUPPLIER: 1000002n,
        GUEST: 1000003n,
        CONTRACTOR: 1000004n,
      };

      for (const role of unauthorizedRoles) {
        const telegramId = roleIds[role];
        vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
          id: `usr-${role.toLowerCase()}-01`,
          telegramId,
          fullName: `عامل تجريبي ${role}`,
          role,
          isActive: true,
          isBanned: false,
        } as any);

        // Act
        const result = await dashboardAuthService.issueDashboardAccess({
          telegramId,
          username: `test_${role.toLowerCase()}`,
        });

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.reason).toBe('UNAUTHORIZED_ROLE');
          expect(result.user?.role).toBe(role);
        }
        expect(result).not.toHaveProperty('token');
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

    it('strictly rejects BANNED user at service level even if they hold SUPER_ADMIN role', async () => {
      // Arrange
      const bannedTelegramId = 4455667788n;
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-banned-superadmin',
        telegramId: bannedTelegramId,
        fullName: 'أدمن محظور جنائياً',
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: true, // BANNED
      } as any);

      // Act
      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: bannedTelegramId,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('ACCOUNT_BANNED');
        expect(result.user?.isBanned).toBe(true);
      }
      expect(result).not.toHaveProperty('token');
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
    });

    it('replies with banned account notice when banned user invokes dashboard command', async () => {
      // Arrange
      const bannedTelegramId = 4455667788n;
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

      // Act
      await handleDashboardCommand(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('محظور'),
        expect.any(Object)
      );
      expect(prisma.dashboardAuthLink.create).not.toHaveBeenCalled();
    });

    it('strictly rejects INACTIVE (deactivated) user even if they hold SUPER_ADMIN role', async () => {
      // Arrange
      const inactiveTelegramId = 3322110099n;
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-inactive-superadmin',
        telegramId: inactiveTelegramId,
        fullName: 'أدمن معطل مؤقتاً',
        role: 'SUPER_ADMIN',
        isActive: false, // DEACTIVATED
        isBanned: false,
      } as any);

      // Act
      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: inactiveTelegramId,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('ACCOUNT_INACTIVE');
        expect(result.user?.isActive).toBe(false);
      }
      expect(result).not.toHaveProperty('token');
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
    it('strictly rejects group invocation without generating tokens or sending DMs', async () => {
      // Arrange
      const userTelegramId = 77665544n;
      const groupChatId = -1001234567890;

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

      // Act
      await handleDashboardCommand(mockCtx);

      // Assert
      expect(mockCtx.api.sendMessage).not.toHaveBeenCalled();
      expect(prisma.dashboardAuthLink.create).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledTimes(1);

      const groupReplyCall = vi.mocked(mockCtx.reply).mock.calls[0] as [string, any];
      const groupReplyText = groupReplyCall[0] as string;

      expect(groupReplyText).toContain('عذراً، الوصول إلى لوحة التحكم متاح حصرياً عبر المحادثة الخاصة مع البوت');
      expect(groupReplyText).not.toContain('/api/auth/claim');
      expect(groupReplyText).not.toContain('token=');
    });

    it('strictly rejects supergroup invocation without generating tokens', async () => {
      // Arrange
      const userTelegramId = 66554433n;
      const supergroupId = -1009876543210;

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

      // Act
      await handleDashboardCommand(mockCtx);

      // Assert
      expect(mockCtx.api.sendMessage).not.toHaveBeenCalled();
      expect(prisma.dashboardAuthLink.create).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledTimes(1);

      const groupText = vi.mocked(mockCtx.reply).mock.calls[0]![0] as string;
      expect(groupText).toContain('عذراً، الوصول إلى لوحة التحكم متاح حصرياً عبر المحادثة الخاصة مع البوت');
      expect(groupText).not.toContain('token=');
      expect(groupText).not.toContain('/api/auth/claim');
    });
  });
});
