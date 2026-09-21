import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryLogger } from '@alsaada/telemetry';
import {
  dashboardAuthService,
  AUTHORIZED_DASHBOARD_ROLES,
} from '../src/services/dashboard-auth.service.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');
import {
  isValidOpaqueTokenFormat,
  normalizeOrigin,
  isExactOriginMatch,
} from '@alsaada/rbac';
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
  beforeEach(() => {
    vi.clearAllMocks();
    config.dashboardLocalUrl = 'http://localtest.me:3002';
    config.dashboardTunnelUrl = 'https://panel.alsaada.org';
  });

  describe('1. Cryptographic Opaque Token & SSOT Security Standards', () => {
    it('generates strict 64-hex opaque tokens conforming to security specifications', () => {
      // Arrange & Act
      const token = crypto.randomBytes(32).toString('hex');

      // Assert
      expect(token).toMatch(/^[0-9a-f]{64}$/i);
      expect(isValidOpaqueTokenFormat(token)).toBe(true);
      expect(isValidOpaqueTokenFormat('invalid-token')).toBe(false);
      expect(isValidOpaqueTokenFormat('header.payload.signature')).toBe(false);
    });

    it('verifies exact origin normalization and matching', () => {
      // Arrange, Act & Assert
      expect(normalizeOrigin('http://localhost:3002/')).toBe('http://localhost:3002');
      expect(normalizeOrigin('http://localhost:3002')).toBe('http://localhost:3002');
      expect(isExactOriginMatch('http://localhost:3002', 'http://localhost:3002')).toBe(true);
      expect(isExactOriginMatch('http://localhost:3002', 'http://127.0.0.1:3002')).toBe(false);
    });
  });

  describe('2. DashboardAuthService Authorization & Audit Trail', () => {
    it('authorizes the 3 ratified administrative roles into dashboard with dual links', async () => {
      // Arrange
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

        // Act
        const result = await dashboardAuthService.issueDualDashboardAccess({
          telegramId: 11223344n,
          username: `user_${role}`,
          firstName: 'Admin',
          lastName: role,
        });

        // Assert
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

    it('rejects unauthorized roles (WORKER, SUPPLIER, GUEST) and logs access denial', async () => {
      // Arrange
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

        // Act
        const result = await dashboardAuthService.issueDashboardAccess({
          telegramId: 99887766n,
          username: `user_${role}`,
        });

        // Assert
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

    it('rejects inactive users with ACCOUNT_INACTIVE', async () => {
      // Arrange
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-inactive',
        telegramId: 55443322n,
        fullName: 'Inactive Admin',
        role: 'FIELD_ADMIN',
        isActive: false,
        isBanned: false,
      } as any);

      // Act
      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: 55443322n,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('ACCOUNT_INACTIVE');
      }
      expect(result).not.toHaveProperty('token');
    });

    it('rejects banned users with ACCOUNT_BANNED', async () => {
      // Arrange
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-banned',
        telegramId: 66554433n,
        fullName: 'Banned Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: true,
      } as any);

      // Act
      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: 66554433n,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('ACCOUNT_BANNED');
      }
      expect(result).not.toHaveProperty('token');
    });

    it('rejects unregistered users with USER_NOT_FOUND', async () => {
      // Arrange
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      // Act
      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: 11112222n,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('USER_NOT_FOUND');
      }
      expect(result).not.toHaveProperty('token');
    });

    it('auto-upserts Super Admin if telegramId matches SUPER_ADMIN_TELEGRAM_ID', async () => {
      // Arrange
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

      // Act
      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: superAdminId,
        username: 'super_owner',
        firstName: 'المدير',
        lastName: 'العام',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { telegramId: superAdminId },
          update: expect.objectContaining({ role: 'SUPER_ADMIN' }),
        })
      );
    });

    it('caches magic token in Redis when available', async () => {
      // Arrange
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-exec',
        telegramId: 88776655n,
        fullName: 'مشرف موقع ميداني',
        role: 'FIELD_ADMIN',
        isActive: true,
        isBanned: false,
      } as any);

      // Act
      const result = await dashboardAuthService.issueDashboardAccess({
        telegramId: 88776655n,
      });

      // Assert
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
    it('strictly purges dashboard, admin_dashboard, and panel commands for all roles', () => {
      // Arrange
      const allRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR', 'WORKER', 'SUPPLIER', 'GUEST'];

      // Act & Assert
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
      config.dashboardLocalUrl = 'http://localtest.me:3002';
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
      const localBtn = flatButtons.find((btn: any) => btn.text === '💻 فتح محلياً (localtest.me)');
      expect(localBtn).toBeDefined();
      expect(localBtn.url).toContain('/api/auth/claim?token=');
      expect(localBtn.url).toContain('localtest.me');

      // 3. Regeneration and main-menu callbacks remain available.
      const sessListBtn = flatButtons.find((btn: any) => btn.callback_data === 'sess_list');
      expect(sessListBtn).toBeDefined();
      const mainMenuBtn = flatButtons.find((btn: any) => btn.callback_data === 'action:main_menu');
      expect(mainMenuBtn).toBeDefined();
    });

    it('returns an interactive safe fallback when Telegram rejects the rich dashboard card', async () => {
      // Arrange
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      config.dashboardTunnelUrl = 'https://tunnel.alsaada.example';
      config.dashboardLocalUrl = 'http://localtest.me:3002';
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

      // Act & Assert
      try {
        await expect(handleDashboardCommand(mockCtx)).resolves.toBeUndefined();

        expect(reply).toHaveBeenCalledTimes(2);
        const [fallbackText, fallbackOptions] = reply.mock.calls[1] as [string, any];
        expect(fallbackText).toContain('رمز البلاغ المرجعي:');
        const fallbackButtons = fallbackOptions.reply_markup.inline_keyboard.flat();
        expect(fallbackButtons).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ callback_data: 'action:main_menu' }),
          ]),
        );
      } finally {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
      }
    });

    it('gracefully recovers with interactive error card when dashboard origins configuration fails', async () => {
      // Arrange
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      config.dashboardTunnelUrl = 'https://tunnel.alsaada.example';
      config.dashboardLocalUrl = 'http://invalid-hostname:3002';

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-fa-recovery',
        telegramId: 55667788n,
        fullName: 'م. أحمد التعافي',
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: false,
      } as any);

      const reply = vi.fn().mockResolvedValueOnce({});
      const mockCtx = {
        from: { id: 55667788, first_name: 'أحمد' },
        chat: { type: 'private' },
        reply,
      } as unknown as MyContext;

      // Act
      try {
        await handleDashboardCommand(mockCtx);

        // Assert
        expect(reply).toHaveBeenCalledTimes(1);
        const [replyText, replyOptions] = reply.mock.calls[0] as [string, any];
        expect(replyText).toContain('تعذر الوصول المؤقت إلى لوحة التحكم');
        const buttons = replyOptions.reply_markup.inline_keyboard.flat();
        expect(buttons.find((btn: any) => btn.text === '🔄 إعادة المحاولة')).toBeDefined();
        expect(buttons.find((btn: any) => btn.text === '🏠 القائمة الرئيسية')).toBeDefined();
      } finally {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
      }
    });

    it('includes dual link buttons (Tunnel and Local) and session management in keyboard', async () => {
      // Arrange
      config.dashboardTunnelUrl = 'https://tunnel.alsaada.example';
      config.dashboardLocalUrl = 'http://localtest.me:3002';

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

      // Act
      await handleDashboardCommand(mockCtx);

      // Assert
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

      const localBtn = flatButtons.find((btn: any) => btn.text === '💻 فتح محلياً (localtest.me)');
      expect(localBtn).toBeDefined();
      expect(localBtn.url).toContain('/api/auth/claim?token=');
      expect(localBtn.url).toContain('localtest.me');

      const sessListBtn = flatButtons.find((btn: any) => btn.text === '📋 جلساتي النشطة');
      expect(sessListBtn).toBeDefined();
      expect(sessListBtn.callback_data).toBe('sess_list');
    });

    it('handles unexpected errors gracefully in try/catch and replies with error card without freezing', async () => {
      // Arrange
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      vi.mocked(prisma.user.findFirst).mockRejectedValueOnce(new Error('Prisma database failure'));

      const mockCtx = {
        from: { id: 99887766, first_name: 'مستخدم' },
        chat: { type: 'private' },
        reply: vi.fn().mockResolvedValue({}),
      } as unknown as MyContext;

      // Act & Assert
      try {
        await expect(handleDashboardCommand(mockCtx)).resolves.not.toThrow();

        expect(mockCtx.reply).toHaveBeenCalledWith(
          expect.stringContaining('رمز البلاغ المرجعي:'),
          expect.objectContaining({ parse_mode: 'HTML' }),
        );
      } finally {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
      }
    });

    it('strictly rejects invocation in group/supergroup chats without generating tokens or sending DMs', async () => {
      // Arrange
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

      // Act
      await handleDashboardCommand(mockCtx);

      // Assert
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

    it('strictly rejects regular group chats without generating tokens', async () => {
      // Arrange
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

      // Act
      await handleDashboardCommand(mockCtx);

      // Assert
      expect(mockCtx.api.sendMessage).not.toHaveBeenCalled();
      expect(prisma.dashboardAuthLink.create).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('عذراً، الوصول إلى لوحة التحكم متاح حصرياً عبر المحادثة الخاصة مع البوت'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    it('replies with polite Arabic rejection card when unauthorized user invokes command', async () => {
      // Arrange
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

      // Act
      await handleDashboardCommand(mockCtx);

      // Assert
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
    it('maps all specified roles to their official Arabic administrative titles', () => {
      // Arrange, Act & Assert
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

    it('escapes HTML characters (&, <, >) to avoid Telegram parsing crashes (#ERR-A62P)', () => {
      // Arrange
      const dangerousInput = 'شركة النيل <للمقاولات> & التوريدات > قسم 1';

      // Act
      const escaped = escapeHtml(dangerousInput);

      // Assert
      expect(escaped).toBe('شركة النيل &lt;للمقاولات&gt; &amp; التوريدات &gt; قسم 1');
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');

      // Characters like underscores and asterisks are safe in HTML mode
      const markdownChars = 'user_with_underscores *bold* `code`';
      expect(escapeHtml(markdownChars)).toBe('user_with_underscores *bold* `code`');
    });

    it('safely renders user with special characters in name and site without malformed HTML', async () => {
      // Arrange
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

      // Act
      await handleDashboardCommand(mockCtx);

      // Assert
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
      // Arrange
      vi.mocked(prisma.dashboardSession.findMany).mockResolvedValueOnce([
        {
          id: 'sess-active-01',
          userId: 'usr-fa-01',
          actorTelegramId: 12345678n,
          originKind: 'LOCAL',
          deviceSummary: 'Chrome on Windows',
          expiresAt: new Date(PINNED_BASE_TIME.getTime() + 3600 * 1000),
          revokedAt: null,
          createdAt: new Date(PINNED_BASE_TIME.getTime()),
          updatedAt: new Date(PINNED_BASE_TIME.getTime()),
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
      expect(editedOptions.reply_markup.inline_keyboard.flat().some((b: any) => b.callback_data === 'action:main_menu')).toBe(true);
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
      expect(editedOptions.reply_markup.inline_keyboard.flat().some((b: any) => b.callback_data === 'action:main_menu')).toBe(true);
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
          data: 'refresh_dashboard',
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

  describe('5. R1C-A: Regression, Schema Compatibility & Governance Suite', () => {
    it('R1C-01: strictly passes distinct originKind (LOCAL and TUNNEL) to prevent Prisma P2002', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-p2002-test',
        telegramId: 44556677n,
        fullName: 'Test Admin P2002',
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: false,
        assignedSite: null,
      } as any);

      const result = await dashboardAuthService.issueDualDashboardAccess({
        telegramId: 44556677n,
      });

      expect(result.success).toBe(true);

      // Verify transaction was called with 2 creates
      expect(prisma.$transaction).toHaveBeenCalled();
      const createCalls = vi.mocked(prisma.dashboardAuthLink.create).mock.calls;
      expect(createCalls.length).toBeGreaterThanOrEqual(2);

      const lastTwoCalls = createCalls.slice(-2);
      const firstCreateData = (lastTwoCalls[0]![0] as any).data;
      const secondCreateData = (lastTwoCalls[1]![0] as any).data;

      // Both links must share the same groupId
      expect(firstCreateData.groupId).toBe(secondCreateData.groupId);
      // Both links must have different originKind values (LOCAL and TUNNEL)
      expect(firstCreateData.originKind).toBe('LOCAL');
      expect(secondCreateData.originKind).toBe('TUNNEL');
      expect(firstCreateData.originKind).not.toBe(secondCreateData.originKind);
    });

    it('R1C-01 Characterization: legacy client without originKind collides on (groupId, originKind)', () => {
      const simulateLegacyInsertion = (links: Array<{ groupId: string; originKind?: string }>) => {
        const uniqueSet = new Set<string>();
        for (const link of links) {
          const kind = link.originKind ?? 'LOCAL'; // Default value in schema
          const key = `${link.groupId}:${kind}`;
          if (uniqueSet.has(key)) {
            const err = new Error(`P2002: Unique constraint failed on (groupId, originKind)`);
            (err as any).code = 'P2002';
            throw err;
          }
          uniqueSet.add(key);
        }
      };

      const testGroupId = 'legacy-group-uuid';
      // Legacy bot behavior: emits two links without originKind (both become LOCAL)
      expect(() =>
        simulateLegacyInsertion([
          { groupId: testGroupId }, // becomes LOCAL
          { groupId: testGroupId }, // becomes LOCAL -> collision!
        ])
      ).toThrowError(/P2002/);

      // Current compatible bot behavior: passes LOCAL and TUNNEL
      expect(() =>
        simulateLegacyInsertion([
          { groupId: testGroupId, originKind: 'LOCAL' },
          { groupId: testGroupId, originKind: 'TUNNEL' },
        ])
      ).not.toThrow();
    });

    it('R1C-04: AST / Source check enforces ZERO console.error, operational console.warn, and silent catches in the 5 source files', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const filesToCheck = [
        'apps/admin-dashboard/src/app/api/auth/claim/route.ts',
        'apps/admin-dashboard/src/app/api/auth/logout/route.ts',
        'apps/admin-dashboard/src/lib/auth.ts',
        'apps/bot-server/src/services/dashboard-auth.service.ts',
        'apps/bot-server/src/handlers/dashboard.handler.ts',
      ];

      const violations: string[] = [];

      for (const relPath of filesToCheck) {
        // Resolve absolute path from repo root
        const absPath = path.resolve(process.cwd(), '..', '..', relPath);
        if (!fs.existsSync(absPath)) continue;

        const content = fs.readFileSync(absPath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          const lineNum = idx + 1;
          const trimmed = line.trim();

          // Skip comments
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

          if (line.includes('console.error(') || line.includes('console.error`')) {
            violations.push(`${relPath}:${lineNum} contains forbidden console.error`);
          }
          if (line.includes('console.warn(') || line.includes('console.warn`')) {
            violations.push(`${relPath}:${lineNum} contains forbidden console.warn`);
          }
          if (/catch\s*\{\s*\}/.test(line) || /catch\s*\([a-zA-Z0-9_]+\)\s*\{\s*\}/.test(line)) {
            violations.push(`${relPath}:${lineNum} contains silent catch {}`);
          }
          if (/\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/.test(line) || /\.catch\(\s*\(\s*\)\s*=>\s*\[\s*\]\s*\)/.test(line)) {
            violations.push(`${relPath}:${lineNum} contains silent .catch(() => {})`);
          }
        });
      }

      expect(violations, `Found logging/catch violations:\n${violations.join('\n')}`).toEqual([]);
    });
  });
});
