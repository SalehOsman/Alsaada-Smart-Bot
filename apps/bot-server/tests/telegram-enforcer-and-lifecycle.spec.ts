import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramGroupEnforcerService } from '../src/services/telegram-group-enforcer.service.js';
import { SupervisorLifecycleService } from '../src/services/supervisor-lifecycle.service.js';
import { prisma } from '../src/db.js';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    site: {
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    supervisorLifecycleLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-001' }),
    },
    telegramEnforcementTask: {
      create: vi.fn().mockResolvedValue({ id: 'task-001' }),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(prisma)),
  },
}));

vi.mock('../src/middlewares/auth.middleware.js', () => ({
  invalidateUserCache: vi.fn().mockResolvedValue(true),
}));

describe('Telegram Group Enforcer & Supervisor Lifecycle Service Specification', () => {
  let mockBot: any;
  let enforcer: TelegramGroupEnforcerService;
  let lifecycleService: SupervisorLifecycleService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBot = {
      api: {
        getChatMember: vi.fn().mockResolvedValue({ status: 'member' }),
        banChatMember: vi.fn().mockResolvedValue(true),
        unbanChatMember: vi.fn().mockResolvedValue(true),
        createChatInviteLink: vi.fn().mockResolvedValue({ invite_link: 'https://t.me/+join_test' }),
      },
    };

    enforcer = new TelegramGroupEnforcerService();
    enforcer.setBot(mockBot);

    lifecycleService = new SupervisorLifecycleService(enforcer);
  });

  describe('1. TelegramGroupEnforcerService Operations', () => {
    it('ejects a normal member temporarily (ban followed by unban)', async () => {
      const result = await enforcer.ejectMember(-100123456789n, 12345n, false);

      expect(result.success).toBe(true);
      expect(result.action).toBe('KICKED');
      expect(mockBot.api.banChatMember).toHaveBeenCalledWith(-100123456789, 12345);
      expect(mockBot.api.unbanChatMember).toHaveBeenCalledWith(-100123456789, 12345, { only_if_banned: true });
    });

    it('ejects a member permanently without unbanning when isPermanent is true', async () => {
      const result = await enforcer.ejectMember(-100123456789n, 12345n, true);

      expect(result.success).toBe(true);
      expect(result.action).toBe('BANNED');
      expect(mockBot.api.banChatMember).toHaveBeenCalledWith(-100123456789, 12345);
      expect(mockBot.api.unbanChatMember).not.toHaveBeenCalled();
    });

    it('handles CANNOT_REMOVE_ADMIN gracefully when member is admin or creator', async () => {
      mockBot.api.getChatMember.mockResolvedValueOnce({ status: 'administrator' });

      const result = await enforcer.ejectMember(-100123456789n, 99999n, false);

      expect(result.success).toBe(false);
      expect(result.action).toBe('CANNOT_REMOVE_ADMIN');
      expect(mockBot.api.banChatMember).not.toHaveBeenCalled();
    });

    it('generates a single-use join request invite link', async () => {
      const result = await enforcer.createSingleUseJoinRequestInvite(-100123456789n, 'موقع الكباش');

      expect(result.success).toBe(true);
      expect(result.inviteLink).toBe('https://t.me/+join_test');
      expect(mockBot.api.createChatInviteLink).toHaveBeenCalledWith(
        -100123456789,
        expect.objectContaining({
          member_limit: 1,
          creates_join_request: true,
        })
      );
    });

    it('auto-heals and updates sites on group migration to supergroup', async () => {
      await enforcer.handleGroupMigration(-12345n, -10012345n);

      expect(prisma.site.updateMany).toHaveBeenCalledWith({
        where: { telegramGroupId: -12345n },
        data: { telegramGroupId: -10012345n },
      });
    });
  });

  describe('2. SupervisorLifecycleService with Configurable Leave Policies', () => {
    it('executes startLeave with default strict policies (freezeBotAccessOnLeave=true, ejectTelegramOnLeave=true)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-1',
        telegramId: 555444n,
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-1',
        freezeBotAccessOnLeave: true,
        ejectTelegramOnLeave: true,
        assignedSite: {
          id: 'site-1',
          name: 'موقع الوادي',
          telegramGroupId: -100999n,
          telegramTopicId: 10,
        },
      } as any);

      const result = await lifecycleService.startLeave({
        userId: 'u-1',
        actorTelegramId: 777n,
      });

      expect(result.success).toBe(true);
      expect(result.botAccessFrozen).toBe(true);
      expect(result.telegramEjected).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { role: 'WORKER' },
      });
      expect(prisma.supervisorLifecycleLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: 'LEAVE_START',
            telegramAction: 'KICKED',
          }),
        })
      );
    });

    it('executes startLeave when management unfreezes policies (freezeBotAccessOnLeave=false, ejectTelegramOnLeave=false)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-2',
        telegramId: 666777n,
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-1',
        freezeBotAccessOnLeave: false,
        ejectTelegramOnLeave: false,
        assignedSite: {
          id: 'site-1',
          name: 'موقع الوادي',
          telegramGroupId: -100999n,
        },
      } as any);

      const result = await lifecycleService.startLeave({
        userId: 'u-2',
        actorTelegramId: 777n,
      });

      expect(result.success).toBe(true);
      expect(result.botAccessFrozen).toBe(false);
      expect(result.telegramEjected).toBe(false);
      // Role was NOT changed to WORKER
      expect(prisma.user.update).not.toHaveBeenCalled();
      // Logged as SKIPPED_POLICY
      expect(prisma.supervisorLifecycleLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: 'LEAVE_START',
            telegramAction: 'SKIPPED_POLICY',
          }),
        })
      );
    });

    it('executes returnFromLeave and restores supervisor role and generates invite link', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-1',
        telegramId: 555444n,
        role: 'WORKER',
        assignedSiteId: 'site-1',
        assignedSite: {
          id: 'site-1',
          name: 'موقع الوادي',
          telegramGroupId: -100999n,
        },
      } as any);

      const result = await lifecycleService.returnFromLeave({
        userId: 'u-1',
        actorTelegramId: 777n,
      });

      expect(result.success).toBe(true);
      expect(result.inviteLink).toBe('https://t.me/+join_test');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { role: 'FIELD_ADMIN' },
      });
      expect(prisma.supervisorLifecycleLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: 'LEAVE_RETURN',
            telegramAction: 'INVITE_SENT',
          }),
        })
      );
    });

    it('executes transferSite: changes assignedSite, ejects from old group, generates new invite', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-1',
        telegramId: 555444n,
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-old',
        assignedSite: {
          id: 'site-old',
          name: 'الموقع القديم',
          telegramGroupId: -100111n,
        },
      } as any);

      vi.mocked(prisma.site.findUnique).mockResolvedValue({
        id: 'site-new',
        name: 'الموقع الجديد',
        telegramGroupId: -100222n,
        telegramTopicId: 5,
      } as any);

      const result = await lifecycleService.transferSite({
        userId: 'u-1',
        targetSiteId: 'site-new',
        actorTelegramId: 777n,
      });

      expect(result.success).toBe(true);
      expect(result.previousSiteName).toBe('الموقع القديم');
      expect(result.newSiteName).toBe('الموقع الجديد');
      expect(result.inviteLink).toBe('https://t.me/+join_test');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { assignedSiteId: 'site-new' },
      });
    });

    it('executes terminate: deactivates user account and permanently bans from group', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-1',
        telegramId: 555444n,
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-1',
        assignedSite: {
          id: 'site-1',
          telegramGroupId: -100999n,
        },
      } as any);

      const result = await lifecycleService.terminate({
        userId: 'u-1',
        actorTelegramId: 777n,
        reason: 'استقالة رسمية',
      });

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { isActive: false, isBanned: true },
      });
      expect(prisma.supervisorLifecycleLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: 'TERMINATION',
            telegramAction: 'BANNED',
          }),
        })
      );
    });
  });
});
