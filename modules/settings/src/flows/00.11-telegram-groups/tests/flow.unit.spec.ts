import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@alsaada/database';
import type { Redis } from 'ioredis';
import type { Api } from 'grammy';
import type { SettingsModuleContext } from '../../../shared/module.types.js';
import { TelegramGroupsService } from '../flow.service.js';
import { TelegramGroupsRepository } from '../flow.repository.js';
import { TelegramGroupsHandler } from '../flow.handler.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.11 Unit Spec — مجموعات تليجرام', () => {
  let mockPrisma: PrismaClient;
  let mockRedis: Redis;
  let repo: TelegramGroupsRepository;
  let service: TelegramGroupsService;
  let handler: TelegramGroupsHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    mockPrisma = {
      site: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'site-1',
            code: 'QNA',
            name: 'منجم قنا',
            governorateCode: 'QNA',
            telegramGroupId: BigInt(-1001111111),
            status: 'ACTIVE',
            _count: { workers: 15 },
          },
          {
            id: 'site-2',
            code: 'WAH',
            name: 'موقع الواحات',
            governorateCode: 'GZA',
            telegramGroupId: null,
            status: 'ACTIVE',
            _count: { workers: 5 },
          },
        ]),
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === 'site-1') {
            return Promise.resolve({
              id: 'site-1',
              code: 'QNA',
              name: 'منجم قنا',
              governorateCode: 'QNA',
              telegramGroupId: BigInt(-1001111111),
              status: 'ACTIVE',
              _count: { workers: 15 },
            });
          }
          return Promise.resolve(null);
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaClient;

    const redisStore: Record<string, string> = {};
    mockRedis = {
      get: vi.fn().mockImplementation((k: string) => Promise.resolve(redisStore[k] || null)),
      set: vi.fn().mockImplementation((k: string, v: string) => {
        redisStore[k] = v;
        return Promise.resolve('OK');
      }),
      del: vi.fn().mockImplementation((k: string) => {
        delete redisStore[k];
        return Promise.resolve(1);
      }),
    } as unknown as Redis;

    repo = new TelegramGroupsRepository(mockPrisma, mockRedis);
    service = new TelegramGroupsService(repo);
    handler = new TelegramGroupsHandler(service, repo);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Service: HQ & Site Group Operations', () => {
    it('validates and binds HQ group ID correctly', async () => {
      // Arrange
      const hqChatId = '-10099887766';

      // Act
      await service.bindHqGroup(hqChatId);
      const status = await service.getHqGroupStatus();

      // Assert
      expect(status.isBound).toBe(true);
      expect(status.chatId).toBe(hqChatId);
    });

    it('rejects non-numeric chat ID on bind attempt', async () => {
      // Arrange
      const invalidChatId = 'invalid-group';

      // Act
      const bindPromise = service.bindHqGroup(invalidChatId);

      // Assert
      await expect(bindPromise).rejects.toThrow();
    });

    it('creates the 4 HQ forum topics in exact sequence and saves thread IDs', async () => {
      // Arrange
      const mockApi = {
        createForumTopic: vi.fn()
          .mockResolvedValueOnce({ message_thread_id: 101 })
          .mockResolvedValueOnce({ message_thread_id: 102 })
          .mockResolvedValueOnce({ message_thread_id: 103 })
          .mockResolvedValueOnce({ message_thread_id: 104 }),
      } as unknown as Api;

      // Act
      const topics = await service.createHqTopics(mockApi, '-10099887766');

      // Assert
      expect(topics.siteClosuresThreadId).toBe(101);
      expect(topics.financialDigestsThreadId).toBe(102);
      expect(topics.logisticsFuelThreadId).toBe(103);
      expect(topics.executiveDecreesThreadId).toBe(104);

      expect(mockApi.createForumTopic).toHaveBeenCalledTimes(4);
      expect(mockApi.createForumTopic).toHaveBeenNthCalledWith(1, -10099887766, '📊 الإقفالات اليومية للمواقع');
      expect(mockApi.createForumTopic).toHaveBeenNthCalledWith(2, -10099887766, '💰 ملخصات الرواتب والسلف والعهد');
      expect(mockApi.createForumTopic).toHaveBeenNthCalledWith(3, -10099887766, '🚚 تقارير إنتاج وشحن الفوسفات والمحروقات');
      expect(mockApi.createForumTopic).toHaveBeenNthCalledWith(4, -10099887766, '📢 التوجيهات والقرارات السيادية');
    });

    it('diagnoses group permissions and forum status via live API call', async () => {
      // Arrange
      const mockApi = {
        getChat: vi.fn().mockResolvedValue({
          id: -10099887766,
          title: 'جروب الإدارة العليا',
          type: 'supergroup',
          is_forum: true,
        }),
        getChatMember: vi.fn().mockResolvedValue({
          status: 'administrator',
          can_manage_topics: true,
          can_post_messages: true,
          can_delete_messages: true,
        }),
      } as unknown as Api;

      // Act
      const result = await service.diagnoseGroup(mockApi, 12345, '-10099887766');

      // Assert
      expect(result.isAvailable).toBe(true);
      expect(result.isForum).toBe(true);
      expect(result.canManageTopics).toBe(true);
      expect(result.canPostMessages).toBe(true);
      expect(result.title).toBe('جروب الإدارة العليا');
    });

    it('binds and unbinds site group IDs', async () => {
      // Arrange
      const siteId = 'site-2';
      const targetGroup = '-1005555555';

      // Act
      await service.bindSiteGroup(siteId, targetGroup);
      await service.unbindSiteGroup('site-1');

      // Assert
      expect(mockPrisma.site.update).toHaveBeenCalledWith({
        where: { id: 'site-2' },
        data: { telegramGroupId: BigInt(-1005555555) },
      });
      expect(mockPrisma.site.update).toHaveBeenCalledWith({
        where: { id: 'site-1' },
        data: { telegramGroupId: null },
      });
    });

    it('generates one-tap add bot links with required permissions', () => {
      // Arrange
      const botName = 'AlsaadaBot';

      // Act
      const hqUrl = service.buildAddBotUrl(botName, 'hq');
      const siteUrl = service.buildAddBotUrl(botName, 'site', 'QNA');

      // Assert
      expect(hqUrl).toContain('https://t.me/AlsaadaBot?startgroup=bind_hq');
      expect(hqUrl).toContain('manage_topics');
      expect(siteUrl).toContain('https://t.me/AlsaadaBot?startgroup=bind_site_QNA');
    });
  });

  describe('Handler: RBAC & Text Input Processing', () => {
    it('blocks non-super admin users with alert', async () => {
      // Arrange
      const answerMock = vi.fn().mockResolvedValue(true);
      const ctx = {
        isRealSuperAdmin: false,
        effectiveRole: 'FIELD_ADMIN',
        isImpersonating: false,
        callbackQuery: {},
        answerCallbackQuery: answerMock,
      } as unknown as SettingsModuleContext;

      // Act
      await handler.renderGroupsHub(ctx, true);

      // Assert
      expect(answerMock).toHaveBeenCalledWith(
        expect.objectContaining({ show_alert: true })
      );
    });

    it('intercepts and handles pending chat ID text input for HQ', async () => {
      // Arrange
      await repo.setPendingInput(BigInt(999), { type: 'hq' });
      const ctx = {
        from: { id: 999 },
        message: { text: '-100888777666' },
        deleteMessage: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockResolvedValue(true),
        isRealSuperAdmin: true,
        effectiveRole: 'SUPER_ADMIN',
        isImpersonating: false,
        me: { username: 'AlsaadaBot' },
      } as unknown as SettingsModuleContext;

      // Act
      const handled = await handler.handleTextInput(ctx);

      // Assert
      expect(handled).toBe(true);
      const status = await service.getHqGroupStatus();
      expect(status.chatId).toBe('-100888777666');
    });

    it('rejects invalid chat ID input and asks to retry', async () => {
      // Arrange
      await repo.setPendingInput(BigInt(999), { type: 'hq' });
      const replyMock = vi.fn().mockResolvedValue(true);
      const ctx = {
        from: { id: 999 },
        message: { text: 'not-a-number' },
        deleteMessage: vi.fn().mockResolvedValue(true),
        reply: replyMock,
      } as unknown as SettingsModuleContext;

      // Act
      const handled = await handler.handleTextInput(ctx);

      // Assert
      expect(handled).toBe(true);
      expect(replyMock).toHaveBeenCalledWith(
        expect.stringContaining('معرف غير صالح')
      );
    });
  });
});
