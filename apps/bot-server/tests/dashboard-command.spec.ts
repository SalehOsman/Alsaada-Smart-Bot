import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateMagicToken,
  verifyMagicToken,
  dashboardAuthService,
  AUTHORIZED_DASHBOARD_ROLES,
  type MagicTokenPayload,
} from '../src/services/dashboard-auth.service.js';
import {
  handleDashboardCommand,
  handleSessionCallbacks,
  getRoleTitle,
  escapeHtml,
  ROLE_ARABIC_TITLES,
} from '../src/handlers/dashboard.handler.js';
import { getCommandsForRole } from '../src/services/command-scope.service.js';
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
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'session-uuid' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn().mockImplementation((actions) => Array.isArray(actions) ? Promise.all(actions) : actions()),
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-log-uuid' }),
    },
    systemErrorLog: {
      create: vi.fn().mockResolvedValue({ id: 'err-uuid', errorReference: '#ERR-TEST1234', occurrenceCount: 1 }),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'err-uuid', errorReference: '#ERR-TEST1234', occurrenceCount: 1 }),
    },
  },
}));

vi.mock('../src/redis.js', () => ({
  redis: {
    status: 'ready',
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
  },
  getUserActiveScreen: vi.fn().mockResolvedValue(null),
  setUserActiveScreen: vi.fn().mockResolvedValue(undefined),
  clearUserActiveScreen: vi.fn().mockResolvedValue(undefined),
  clearAllPendingUserActions: vi.fn().mockResolvedValue(undefined),
  getPersistentKeyboardMsg: vi.fn().mockResolvedValue(null),
  setPersistentKeyboardMsg: vi.fn().mockResolvedValue(undefined),
  getPendingWorkerWizard: vi.fn().mockResolvedValue(null),
}));

describe('Milestone 2: Bot Server Command /dashboard & Cryptographic Magic Token Engine', () => {
  const testSecret = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz12345678';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Cryptographic HMAC-SHA256 Magic Token Engine', () => {
    const validPayload: MagicTokenPayload = {
      userId: 'usr-admin-uuid-001',
      telegramId: '987654321',
      role: 'SUPER_ADMIN',
      name: 'مهندس أحمد السعادة',
      assignedSiteId: 'site-alamein-01',
      assignedSiteName: 'مشروع العلمين الجديدة',
      jti: 'e2b3c4d5-0000-4000-8000-112233445566',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
    };

    it('should generate a two-part base64url HMAC-SHA256 signed token', () => {
      const token = generateMagicToken(validPayload, testSecret);
      expect(typeof token).toBe('string');
      const parts = token.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[0]!.length).toBeGreaterThan(20);
      expect(parts[1]!.length).toBeGreaterThan(20);
    });

    it('should strictly verify an authentic token with the correct secret', () => {
      const token = generateMagicToken(validPayload, testSecret);
      const result = verifyMagicToken(token, testSecret);
      expect(result.valid).toBe(true);
      expect(result.payload?.userId).toBe(validPayload.userId);
      expect(result.payload?.telegramId).toBe(validPayload.telegramId);
      expect(result.payload?.role).toBe(validPayload.role);
      expect(result.payload?.jti).toBe(validPayload.jti);
      expect(result.payload?.exp).toBe(validPayload.exp);
    });

    it('should enforce strict 5-minute (300 seconds) lifespan', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload: MagicTokenPayload = {
        ...validPayload,
        iat: now,
        exp: now + 300,
      };
      expect(payload.exp - payload.iat).toBe(300);
      const token = generateMagicToken(payload, testSecret);
      const decoded = verifyMagicToken(token, testSecret);
      expect(decoded.valid).toBe(true);
      expect(decoded.payload!.exp - decoded.payload!.iat).toBe(300);
    });

    it('should reject tokens with signature mismatch (wrong secret or tampering)', () => {
      const token = generateMagicToken(validPayload, testSecret);
      const invalidVerification = verifyMagicToken(token, 'wrong-secret-token');
      expect(invalidVerification.valid).toBe(false);
      expect(invalidVerification.error).toBe('SIGNATURE_MISMATCH');

      // Tampered payload
      const parts = token.split('.');
      const tamperedData = Buffer.from(
        JSON.stringify({ ...validPayload, role: 'SUPER_ADMIN_HACKED' })
      ).toString('base64url');
      const tamperedToken = `${tamperedData}.${parts[1]}`;
      const tamperedResult = verifyMagicToken(tamperedToken, testSecret);
      expect(tamperedResult.valid).toBe(false);
      expect(tamperedResult.error).toBe('SIGNATURE_MISMATCH');
    });

    it('should reject expired tokens with TOKEN_EXPIRED', () => {
      const expiredPayload: MagicTokenPayload = {
        ...validPayload,
        iat: Math.floor(Date.now() / 1000) - 400,
        exp: Math.floor(Date.now() / 1000) - 100, // expired 100s ago
      };
      const token = generateMagicToken(expiredPayload, testSecret);
      const result = verifyMagicToken(token, testSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('TOKEN_EXPIRED');
    });

    it('should reject malformed token strings', () => {
      expect(verifyMagicToken('not-a-token', testSecret).valid).toBe(false);
      expect(verifyMagicToken('part1.part2.part3', testSecret).valid).toBe(false);
      expect(verifyMagicToken('', testSecret).valid).toBe(false);
    });
  });

  describe('2. DashboardAuthService Authorization & Audit Trail', () => {
    it('should authorize the 3 ratified administrative roles into dashboard with dual links', async () => {
      for (const role of AUTHORIZED_DASHBOARD_ROLES) {
        vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
          id: `usr-${role.toLowerCase()}`,
          telegramId: 11223344n,
          fullName: `Admin ${role}`,
          role,
          isActive: true,
          isBanned: false,
          assignedSiteId: 'site-01',
          assignedSite: { name: 'الموقع الرئيسي' },
        } as any);

        const result = await dashboardAuthService.issueDualDashboardAccess({
          telegramId: 11223344n,
          username: `user_${role}`,
          firstName: 'Admin',
          lastName: role,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.user.role).toBe(role);
          expect(result.localUrl).toContain('/api/auth/claim?token=');
          expect(result.tunnelUrl).toContain('/api/auth/claim?token=');
          expect(result.localToken).not.toBe(result.tunnelToken);
          expect(result.expiresInMinutes).toBe(5);
        }

        // Verify AuditLog creation
        expect(prisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'DASHBOARD_DUAL_LINKS_ISSUED',
              entityType: 'DashboardAuthLink',
              actorTelegramId: 11223344n,
            }),
          })
        );
      }
    });

    it('should reject unauthorized roles (WORKER, SUPPLIER, GUEST) and log access denial', async () => {
      const unauthorizedRoles = ['WORKER', 'SUPPLIER', 'GUEST', 'UNKNOWN'];

      for (const role of unauthorizedRoles) {
        vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
          id: `usr-${role.toLowerCase()}`,
          telegramId: 99887766n,
          fullName: `Unauth ${role}`,
          role,
          isActive: true,
          isBanned: false,
        } as any);

        const result = await dashboardAuthService.issueDashboardAccess({
          telegramId: 99887766n,
          username: `user_${role}`,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.reason).toBe('UNAUTHORIZED_ROLE');
        }

        expect(prisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'DASHBOARD_ACCESS_DENIED',
              entityType: 'DashboardAuth',
              actorTelegramId: 99887766n,
            }),
          })
        );
      }
    });

    it('should reject inactive users with ACCOUNT_INACTIVE', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-inactive',
        telegramId: 55443322n,
        fullName: 'Inactive Admin',
        role: 'FIELD_ADMIN',
        isActive: false,
        isBanned: false,
      } as any);

      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: 55443322n,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('ACCOUNT_INACTIVE');
      }
    });

    it('should reject banned users with ACCOUNT_BANNED', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-banned',
        telegramId: 66554433n,
        fullName: 'Banned Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: true,
      } as any);

      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: 66554433n,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('ACCOUNT_BANNED');
      }
    });

    it('should reject unregistered users with USER_NOT_FOUND', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: 11112222n,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('USER_NOT_FOUND');
      }
    });

    it('should auto-upsert Super Admin if telegramId matches SUPER_ADMIN_TELEGRAM_ID', async () => {
      const superAdminId = 77889900n;
      config.superAdminTelegramId = superAdminId;

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.upsert).mockResolvedValueOnce({
        id: 'usr-super-auto',
        telegramId: superAdminId,
        fullName: 'المدير العام المالك',
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: false,
        assignedSite: null,
      } as any);

      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: superAdminId,
        username: 'super_owner',
        firstName: 'المدير',
        lastName: 'العام',
      });

      expect(result.success).toBe(true);
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { telegramId: superAdminId },
          update: expect.objectContaining({ role: 'SUPER_ADMIN' }),
        })
      );
    });

    it('should cache magic token in Redis when available', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-exec',
        telegramId: 88776655n,
        fullName: 'مشرف موقع ميداني',
        role: 'FIELD_ADMIN',
        isActive: true,
        isBanned: false,
      } as any);

      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: 88776655n,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(redis.set).toHaveBeenCalledWith(
          `magic_token:${result.jti}:issued`,
          'usr-exec',
          'EX',
          300
        );
      }
    });
  });

  describe('3. Dynamic Command Scope Registration & Legacy Command Purge', () => {
    it('should strictly PURGE dashboard, admin_dashboard, and panel commands for ALL roles', () => {
      const allRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR', 'WORKER', 'SUPPLIER', 'GUEST'];
      for (const role of allRoles) {
        const commands = getCommandsForRole(role);
        const hasDashboard = commands.some((cmd) =>
          cmd.command === 'dashboard' || cmd.command === 'admin_dashboard' || cmd.command === 'panel'
        );
        expect(hasDashboard).toBe(false);
      }
    });
  });

  describe('4. Telegram Bot Handler (handleDashboardCommand)', () => {
    it('renders dashboard access card with localized role, site info, and dual links', async () => {
      config.dashboardTunnelUrl = 'https://tunnel.alsaada.example';
      config.dashboardLocalUrl = 'http://localhost:3002';
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-fa-01',
        telegramId: 12345678n,
        fullName: 'م. حسام الدين',
        role: 'FIELD_ADMIN',
        isActive: true,
        isBanned: false,
        assignedSite: { name: 'برج الأمل' },
      } as any);

      const mockCtx = {
        from: {
          id: 12345678,
          first_name: 'حسام',
          last_name: 'الدين',
          username: 'hossam_fa',
        },
        chat: {
          type: 'private',
        },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      await handleDashboardCommand(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      const [replyText, replyOptions] = vi.mocked(mockCtx.reply).mock.calls[0] as [string, any];

      // 1. Text checks: contains localized role and site, and strictly zero in-text links
      expect(replyText).toContain('لوحة التحكم المؤسسية — رابط الدخول المباشر');
      expect(replyText).toContain('مشرف موقع ميداني');
      expect(replyText).not.toContain('(FIELD_ADMIN)');
      expect(replyText).toContain('برج الأمل');
      expect(replyText).not.toContain('/api/auth/claim?token=');
      expect(replyText).not.toContain('<a href=');

      // 2. Keyboard checks: contains dual URL buttons and session management
      expect(replyOptions.parse_mode).toBe('HTML');
      expect(replyOptions.link_preview_options?.is_disabled).toBe(true);
      const flatButtons = replyOptions.reply_markup.inline_keyboard.flat();
      const tunnelBtn = flatButtons.find((btn: any) => btn.text === '🌐 فتح عبر النفق (Tunnel)');
      expect(tunnelBtn).toBeDefined();
      expect(tunnelBtn.url).toContain('/api/auth/claim?token=');
      const localBtn = flatButtons.find((btn: any) => btn.text === '💻 فتح محلياً (Localhost)');
      expect(localBtn).toBeDefined();
      expect(localBtn.url).toContain('/api/auth/claim?token=');
      expect(localBtn.url).toContain('127.0.0.1.nip.io');

      // 3. Regeneration and main-menu callbacks remain available.
      const sessListBtn = flatButtons.find((btn: any) => btn.callback_data === 'sess_list');
      expect(sessListBtn).toBeDefined();
      const mainMenuBtn = flatButtons.find((btn: any) => btn.callback_data === 'action:main_menu');
      expect(mainMenuBtn).toBeDefined();
    });

    it('returns an interactive safe fallback when Telegram rejects the rich dashboard card', async () => {
      config.dashboardUrl = 'https://dashboard.alsaada.com';
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-dashboard-fallback',
        telegramId: 12344321n,
        fullName: 'م. اختبار لوحة التحكم',
        role: 'FIELD_ADMIN',
        isActive: true,
        isBanned: false,
        assignedSite: null,
      } as any);

      const reply = vi
        .fn()
        .mockRejectedValueOnce(new Error('Bad Request: rich message rejected'))
        .mockResolvedValueOnce({});
      const mockCtx = {
        from: { id: 12344321, first_name: 'اختبار' },
        chat: { type: 'private' },
        reply,
      } as unknown as MyContext;

      await expect(handleDashboardCommand(mockCtx)).resolves.toBeUndefined();

      expect(reply).toHaveBeenCalledTimes(2);
      const [fallbackText, fallbackOptions] = reply.mock.calls[1] as [string, any];
      expect(fallbackText).toContain('رمز البلاغ المرجعي:');
      const fallbackButtons = fallbackOptions.reply_markup.inline_keyboard.flat();
      expect(fallbackButtons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ callback_data: 'menu:exec:dashboard' }),
          expect.objectContaining({ callback_data: 'action:main_menu' }),
        ]),
      );
    });

    it('gracefully recovers when Telegram Bot API rejects localhost button with Wrong HTTP URL', async () => {
      config.dashboardTunnelUrl = 'https://tunnel.alsaada.example';
      config.dashboardLocalUrl = 'http://localhost:3002';

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-fa-recovery',
        telegramId: 55667788n,
        fullName: 'م. أحمد التعافي',
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: false,
      } as any);

      // First attempt throws Wrong HTTP URL (Telegram API real behavior on localhost), second attempt succeeds
      const reply = vi
        .fn()
        .mockRejectedValueOnce(
          new Error("Bad Request: inline keyboard button URL 'http://localhost:3002/api/auth/claim?token=xyz' is invalid: Wrong HTTP URL"),
        )
        .mockResolvedValueOnce({});

      const mockCtx = {
        from: { id: 55667788, first_name: 'أحمد' },
        chat: { type: 'private' },
        reply,
      } as unknown as MyContext;

      await handleDashboardCommand(mockCtx);

      expect(reply).toHaveBeenCalledTimes(2);
      const [retryText, retryOptions] = reply.mock.calls[1] as [string, any];
      expect(retryText).toContain('لوحة التحكم المؤسسية — رابط الدخول المباشر');
      const retryButtons = retryOptions.reply_markup.inline_keyboard.flat();
      expect(retryButtons.find((btn: any) => btn.text === '🌐 فتح عبر النفق (Tunnel)')).toBeDefined();
      expect(retryButtons.find((btn: any) => btn.text === '💻 فتح محلياً (Localhost)')).toBeUndefined();
    });

    it('should include dual link buttons (Tunnel and Localhost) and session management in keyboard', async () => {
      config.dashboardTunnelUrl = 'https://tunnel.alsaada.example';
      config.dashboardLocalUrl = 'http://localhost:3002';

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-fa-02',
        telegramId: 87654321n,
        fullName: 'م. خالد المنصوري',
        role: 'FIELD_ADMIN',
        isActive: true,
        isBanned: false,
      } as any);

      const mockCtx = {
        from: {
          id: 87654321,
          first_name: 'خالد',
          last_name: 'المنصوري',
          username: 'khaled_fa',
        },
        chat: {
          type: 'private',
        },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      await handleDashboardCommand(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      const [replyText, replyOptions] = vi.mocked(mockCtx.reply).mock.calls[0] as [string, any];

      // 1. Text checks: strictly zero in-text links
      expect(replyText).toContain('لوحة التحكم المؤسسية — رابط الدخول المباشر');
      expect(replyText).not.toContain('/api/auth/claim?token=');
      expect(replyText).not.toContain('<a href=');

      // 2. Keyboard checks: MUST contain Tunnel and Local buttons
      expect(replyOptions.link_preview_options?.is_disabled).toBe(true);
      const flatButtons = replyOptions.reply_markup.inline_keyboard.flat();
      const tunnelBtn = flatButtons.find((btn: any) => btn.text === '🌐 فتح عبر النفق (Tunnel)');
      expect(tunnelBtn).toBeDefined();
      expect(tunnelBtn.url).toContain('/api/auth/claim?token=');

      const localBtn = flatButtons.find((btn: any) => btn.text === '💻 فتح محلياً (Localhost)');
      expect(localBtn).toBeDefined();
      expect(localBtn.url).toContain('/api/auth/claim?token=');
      expect(localBtn.url).toContain('127.0.0.1.nip.io');

      const sessListBtn = flatButtons.find((btn: any) => btn.text === '📋 جلساتي النشطة');
      expect(sessListBtn).toBeDefined();
      expect(sessListBtn.callback_data).toBe('sess_list');
    });

    it('should handle unexpected errors gracefully in try/catch and reply with error card without freezing', async () => {
      vi.mocked(prisma.user.findFirst).mockRejectedValueOnce(new Error('Prisma database failure'));

      const mockCtx = {
        from: { id: 99887766, first_name: 'مستخدم' },
        chat: { type: 'private' },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      await expect(handleDashboardCommand(mockCtx)).resolves.not.toThrow();

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('رمز البلاغ المرجعي:'),
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });

    it('should strictly reject invocation in group/supergroup chats without generating tokens or sending DMs', async () => {
      const mockCtx = {
        from: {
          id: 87654321,
          first_name: 'إبراهيم',
        },
        chat: {
          type: 'supergroup',
          id: -1001987654321,
        },
        api: {
          sendMessage: vi.fn().mockResolvedValue({}),
        },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      await handleDashboardCommand(mockCtx);

      // Never sends DM to user
      expect(mockCtx.api.sendMessage).not.toHaveBeenCalled();

      // Zero tokens generated
      expect(prisma.dashboardAuthLink.create).not.toHaveBeenCalled();

      // Sent in group (polite rejection notice instructing private chat)
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('عذراً، الوصول إلى لوحة التحكم متاح حصرياً عبر المحادثة الخاصة مع البوت'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    it('should strictly reject regular group chats without generating tokens', async () => {
      const mockCtx = {
        from: {
          id: 99881122,
          first_name: 'أحمد',
        },
        chat: {
          type: 'group',
          id: -10011223344,
        },
        api: {
          sendMessage: vi.fn().mockResolvedValue({}),
        },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      await handleDashboardCommand(mockCtx);

      expect(mockCtx.api.sendMessage).not.toHaveBeenCalled();
      expect(prisma.dashboardAuthLink.create).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('عذراً، الوصول إلى لوحة التحكم متاح حصرياً عبر المحادثة الخاصة مع البوت'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    it('should reply with polite Arabic rejection card when unauthorized user invokes command', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-worker-01',
        telegramId: 33445566n,
        fullName: 'صالح العامل',
        role: 'WORKER',
        isActive: true,
        isBanned: false,
      } as any);

      const mockCtx = {
        from: {
          id: 33445566,
          first_name: 'صالح',
        },
        chat: {
          type: 'private',
        },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

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
  });

  describe('5. Localized Arabic Administrative Titles & HTML Escaping Robustness', () => {
    it('should map all specified roles to their official Arabic administrative titles', () => {
      expect(getRoleTitle('SUPER_ADMIN')).toBe('مدير عام المنظومة (سوبر أدمن)');
      expect(getRoleTitle('GENERAL_ADMIN')).toBe('الإدارة العامة للمنظومة');
      expect(getRoleTitle('FIELD_ADMIN')).toBe('مشرف موقع ميداني');
      expect(getRoleTitle('WORKER_SUPERVISOR')).toBe('عامل مشرف');
      expect(getRoleTitle('WORKER')).toBe('مستخدم ميداني');
      expect(getRoleTitle('SUPPLIER')).toBe('مورد');
      expect(getRoleTitle('GUEST')).toBe('زائر');
      expect(getRoleTitle('UNKNOWN_ROLE')).toBe('مستخدم ميداني');
      expect(getRoleTitle(null)).toBe('غير مسجل بالمنظومة');
      expect(getRoleTitle(undefined)).toBe('غير مسجل بالمنظومة');
    });

    it('should escape HTML characters (&, <, >) to avoid Telegram parsing crashes (#ERR-A62P)', () => {
      const dangerousInput = 'شركة النيل <للمقاولات> & التوريدات > قسم 1';
      const escaped = escapeHtml(dangerousInput);
      expect(escaped).toBe('شركة النيل &lt;للمقاولات&gt; &amp; التوريدات &gt; قسم 1');
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');

      // Characters like underscores and asterisks are safe in HTML mode
      const markdownChars = 'user_with_underscores *bold* `code`';
      expect(escapeHtml(markdownChars)).toBe('user_with_underscores *bold* `code`');
    });

    it('should safely render user with special characters in name and site without malformed HTML', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-sa-special',
        telegramId: 99001122n,
        fullName: 'م. أحمد & شركاه <المدير>',
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: false,
        assignedSite: { name: 'مشروع البرج <A & B>' },
      } as any);

      const mockCtx = {
        from: {
          id: 99001122,
          first_name: 'أحمد',
          username: 'ahmed_special',
        },
        chat: {
          type: 'private',
        },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      await handleDashboardCommand(mockCtx);

      const replyCall = vi.mocked(mockCtx.reply).mock.calls[0]!;
      const replyText = replyCall[0] as string;

      expect(replyText).toContain('م. أحمد &amp; شركاه &lt;المدير&gt;');
      expect(replyText).toContain('مشروع البرج &lt;A &amp; B&gt;');
      expect(replyText).toContain('مدير عام المنظومة (سوبر أدمن)');
      expect(replyCall[1]?.parse_mode).toBe('HTML');
    });
  });

  describe('6. Session Management Callbacks & In-Place Navigation', () => {
    it('renders session list in-place via editMessageText without sending a new message', async () => {
      vi.mocked(prisma.dashboardSession.findMany).mockResolvedValueOnce([
        {
          id: 'sess-active-01',
          userId: 'usr-fa-01',
          actorTelegramId: 12345678n,
          originKind: 'LOCAL',
          deviceSummary: 'Chrome on Windows',
          expiresAt: new Date(Date.now() + 3600 * 1000),
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      const mockCtx = {
        from: { id: 12345678 },
        chat: { id: 9988 },
        callbackQuery: {
          data: 'sess_list',
          message: { message_id: 5544 },
        },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      const handled = await handleSessionCallbacks(mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
      expect(mockCtx.editMessageText).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).not.toHaveBeenCalled();

      const [editedText, editedOptions] = vi.mocked(mockCtx.editMessageText).mock.calls[0] as [string, any];
      expect(editedText).toContain('جلسات لوحة التحكم النشطة لحسابك (1)');
      expect(editedText).toContain('Chrome on Windows');
      expect(editedOptions.reply_markup.inline_keyboard.flat().some((b: any) => b.callback_data === 'sess_rev:sess-active-01')).toBe(true);
      expect(editedOptions.reply_markup.inline_keyboard.flat().some((b: any) => b.callback_data === 'menu:exec:dashboard')).toBe(true);
    });

    it('revokes session, answers callback without alert, and updates list in-place', async () => {
      // First call inside revokeSession, second call inside getActiveSessions returns empty
      vi.mocked(prisma.dashboardSession.findMany).mockResolvedValueOnce([]);

      const mockCtx = {
        from: { id: 12345678 },
        chat: { id: 9988 },
        callbackQuery: {
          data: 'sess_rev:sess-to-terminate',
          message: { message_id: 5544 },
        },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      const handled = await handleSessionCallbacks(mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.editMessageText).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).not.toHaveBeenCalled();

      const [editedText] = vi.mocked(mockCtx.editMessageText).mock.calls[0] as [string, any];
      expect(editedText).toContain('لا توجد أي جلسات نشطة حالياً');
    });

    it('revokes all sessions and renders confirmation in-place with back button', async () => {
      const mockCtx = {
        from: { id: 12345678 },
        chat: { id: 9988 },
        callbackQuery: {
          data: 'sess_rev_all',
          message: { message_id: 5544 },
        },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      const handled = await handleSessionCallbacks(mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith({
        text: '🛑 تم إنهاء كافة جلساتك النشطة بنجاح',
        show_alert: true,
      });
      expect(mockCtx.editMessageText).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).not.toHaveBeenCalled();

      const [editedText, editedOptions] = vi.mocked(mockCtx.editMessageText).mock.calls[0] as [string, any];
      expect(editedText).toContain('تم إنهاء كافة جلساتك النشطة في لوحة التحكم بنجاح');
      expect(editedOptions.reply_markup.inline_keyboard.flat().some((b: any) => b.callback_data === 'menu:exec:dashboard')).toBe(true);
    });

    it('returns to dashboard card in-place via editMessageText when invoked from callback', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-fa-01',
        telegramId: 12345678n,
        fullName: 'م. حسام الدين',
        role: 'FIELD_ADMIN',
        isActive: true,
        isBanned: false,
        assignedSite: { name: 'برج الأمل' },
      } as any);

      const mockCtx = {
        from: { id: 12345678, first_name: 'حسام' },
        chat: { id: 9988, type: 'private' },
        callbackQuery: {
          data: 'menu:exec:dashboard',
          message: { message_id: 5544 },
        },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      await handleDashboardCommand(mockCtx);

      expect(mockCtx.editMessageText).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).not.toHaveBeenCalled();
      const [editedText] = vi.mocked(mockCtx.editMessageText).mock.calls[0] as [string, any];
      expect(editedText).toContain('لوحة التحكم المؤسسية — رابط الدخول المباشر');
    });
  });
});
