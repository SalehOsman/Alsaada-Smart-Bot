import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerGroupManagerHandlers } from '../src/handlers/group-manager.handler.js';
import { prisma } from '../src/db.js';
import { redis } from '../src/redis.js';
import { config } from '../src/config/env.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

vi.mock('../src/db.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    site: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../src/redis.js', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
  },
}));

describe('Group Manager & Auto-Capture Handlers', () => {
  let handlers: Record<string, Function>;
  let mockBot: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
    handlers = {};
    mockBot = {
      on: vi.fn((event: string, fn: Function) => {
        handlers[`on:${event}`] = fn;
      }),
      callbackQuery: vi.fn((pattern: any, fn: Function) => {
        const key = typeof pattern === 'string' ? `cb:${pattern}` : `cb:regex:${pattern.toString()}`;
        handlers[key] = fn;
      }),
      command: vi.fn((name: string, fn: Function) => {
        handlers[`cmd:${name}`] = fn;
      }),
    };

    registerGroupManagerHandlers(mockBot);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Auto-capture via my_chat_member', () => {
    it('prompts Super Admin when added to a group', async () => {
      // Arrange
      const myChatMemberHandler = handlers['on:my_chat_member'];
      expect(myChatMemberHandler).toBeDefined();

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-1',
        telegramId: BigInt(777),
        role: 'SUPER_ADMIN',
      } as any);

      const ctx: any = {
        myChatMember: {
          new_chat_member: { status: 'administrator' },
        },
        chat: { id: -100999888, title: 'جروب العمليات' },
        from: { id: 777 },
        api: {
          sendMessage: vi.fn().mockResolvedValue(true),
        },
      };

      // Act
      await myChatMemberHandler!(ctx);

      // Assert
      expect(ctx.api.sendMessage).toHaveBeenCalledTimes(1);
      expect(ctx.api.sendMessage).toHaveBeenCalledWith(
        777,
        expect.stringContaining('تمت إضافة البوت لمجموعة جديدة'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ callback_data: 'grp:quick_hq:-100999888' }),
              ]),
            ]),
          }),
        })
      );
    });

    it('ignores updates when user is not Super Admin', async () => {
      // Arrange
      const myChatMemberHandler = handlers['on:my_chat_member'];
      expect(myChatMemberHandler).toBeDefined();

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-2',
        telegramId: BigInt(888),
        role: 'WORKER',
      } as any);

      const ctx: any = {
        myChatMember: {
          new_chat_member: { status: 'administrator' },
        },
        chat: { id: -100999888 },
        from: { id: 888 },
        api: {
          sendMessage: vi.fn(),
        },
      };

      // Act
      await myChatMemberHandler!(ctx);

      // Assert
      expect(ctx.api.sendMessage).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { telegramId: BigInt(888) },
        })
      );
    });
  });

  describe('Group command: /setup_hq_group', () => {
    it('binds group as HQ and sends read-only notification without reply_markup', async () => {
      // Arrange
      const setupHqHandler = handlers['cmd:setup_hq_group'];
      expect(setupHqHandler).toBeDefined();

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-1',
        telegramId: BigInt(777),
        role: 'SUPER_ADMIN',
      } as any);

      const ctx: any = {
        chat: { id: -100123456789, type: 'supergroup', is_forum: false },
        from: { id: 777, first_name: 'المهندس' },
        reply: vi.fn().mockResolvedValue(true),
      };

      // Act
      await setupHqHandler!(ctx);

      // Assert
      expect(redis.set).toHaveBeenCalledWith('system:hq_telegram_group_id', '-100123456789');
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('جروب الإدارة العليا والتقارير التنفيذية'),
        { parse_mode: 'Markdown' }
      );
      const replyCallOpts = ctx.reply.mock.calls[0][1];
      expect(replyCallOpts).not.toHaveProperty('reply_markup');
    });
  });

  describe('Group command: /bind_site', () => {
    it('binds group to site and sends read-only notification without reply_markup', async () => {
      // Arrange
      const bindSiteHandler = handlers['cmd:bind_site'];
      expect(bindSiteHandler).toBeDefined();

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u-1',
        telegramId: BigInt(777),
        role: 'SUPER_ADMIN',
      } as any);

      vi.mocked(prisma.site.findUnique).mockResolvedValue({
        id: 'site-qna',
        name: 'منجم قنا',
        code: 'QNA',
      } as any);

      const ctx: any = {
        chat: { id: -10099881122, type: 'supergroup' },
        from: { id: 777, first_name: 'المهندس' },
        match: 'QNA',
        reply: vi.fn().mockResolvedValue(true),
      };

      // Act
      await bindSiteHandler!(ctx);

      // Assert
      expect(prisma.site.update).toHaveBeenCalledWith({
        where: { id: 'site-qna' },
        data: { telegramGroupId: BigInt(-10099881122) },
      });
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('تم ربط هذه المجموعة رسمياً بموقع: منجم قنا'),
        { parse_mode: 'Markdown' }
      );
      const replyCallOpts = ctx.reply.mock.calls[0][1];
      expect(replyCallOpts).not.toHaveProperty('reply_markup');
    });
  });
});
