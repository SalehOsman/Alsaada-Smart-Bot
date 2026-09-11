import type { PrismaClient } from '@alsaada/database';
import type { Redis } from 'ioredis';
import type { HqGroupStatusDto, SiteGroupItemDto } from './flow.types.js';

export const REDIS_KEY_HQ_GROUP = 'system:hq_telegram_group_id';
export const REDIS_KEY_HQ_TOPICS = 'system:hq_topics_config';

export class TelegramGroupsRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis?: Redis | null
  ) {}

  async getHqGroupStatus(): Promise<HqGroupStatusDto> {
    const [chatId, topicsRaw] = await Promise.all([
      this.redis ? this.redis.get(REDIS_KEY_HQ_GROUP) : Promise.resolve(null),
      this.redis ? this.redis.get(REDIS_KEY_HQ_TOPICS) : Promise.resolve(null),
    ]);

    let topics = {};
    let topicsConfigured = false;

    if (topicsRaw) {
      try {
        topics = JSON.parse(topicsRaw);
        if (
          topics &&
          typeof topics === 'object' &&
          ('siteClosuresThreadId' in topics ||
            'financialDigestsThreadId' in topics ||
            'logisticsFuelThreadId' in topics ||
            'executiveDecreesThreadId' in topics)
        ) {
          topicsConfigured = true;
        }
      } catch {
        topics = {};
      }
    }

    return {
      chatId: chatId || null,
      isBound: Boolean(chatId),
      topicsConfigured,
      topics,
    };
  }

  async setHqGroupId(chatId: string): Promise<void> {
    if (this.redis) {
      await this.redis.set(REDIS_KEY_HQ_GROUP, chatId.trim());
    }
  }

  async deleteHqGroup(): Promise<void> {
    if (this.redis) {
      await Promise.all([
        this.redis.del(REDIS_KEY_HQ_GROUP),
        this.redis.del(REDIS_KEY_HQ_TOPICS),
      ]);
    }
  }

  async saveHqTopics(topics: {
    siteClosuresThreadId?: number;
    financialDigestsThreadId?: number;
    logisticsFuelThreadId?: number;
    executiveDecreesThreadId?: number;
  }): Promise<void> {
    if (this.redis) {
      await this.redis.set(REDIS_KEY_HQ_TOPICS, JSON.stringify(topics));
    }
  }

  async listSites(): Promise<SiteGroupItemDto[]> {
    const sites = await this.prisma.site.findMany({
      where: { status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        code: true,
        name: true,
        governorateCode: true,
        telegramGroupId: true,
        _count: {
          select: { workers: { where: { isDeleted: false } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return sites.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      governorate: s.governorateCode || '-',
      telegramGroupId: s.telegramGroupId ? s.telegramGroupId.toString() : null,
      isBound: Boolean(s.telegramGroupId),
      workersCount: s._count.workers,
    }));
  }

  async getSiteById(siteId: string): Promise<SiteGroupItemDto | null> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        code: true,
        name: true,
        governorateCode: true,
        status: true,
        telegramGroupId: true,
        _count: {
          select: { workers: { where: { isDeleted: false } } },
        },
      },
    });

    if (!site || site.status === 'ARCHIVED') return null;

    return {
      id: site.id,
      code: site.code,
      name: site.name,
      governorate: site.governorateCode || '-',
      telegramGroupId: site.telegramGroupId ? site.telegramGroupId.toString() : null,
      isBound: Boolean(site.telegramGroupId),
      workersCount: (site as { _count?: { workers?: number } })._count?.workers ?? 0,
    };
  }

  async getSiteByCode(code: string): Promise<SiteGroupItemDto | null> {
    const site = await this.prisma.site.findUnique({
      where: { code: code.trim().toUpperCase() },
      select: {
        id: true,
        code: true,
        name: true,
        governorateCode: true,
        status: true,
        telegramGroupId: true,
        _count: {
          select: { workers: { where: { isDeleted: false } } },
        },
      },
    });

    if (!site || site.status === 'ARCHIVED') return null;

    return {
      id: site.id,
      code: site.code,
      name: site.name,
      governorate: site.governorateCode || '-',
      telegramGroupId: site.telegramGroupId ? site.telegramGroupId.toString() : null,
      isBound: Boolean(site.telegramGroupId),
      workersCount: (site as { _count?: { workers?: number } })._count?.workers ?? 0,
    };
  }

  async updateSiteTelegramGroupId(siteId: string, telegramGroupId: string | null): Promise<void> {
    await this.prisma.site.update({
      where: { id: siteId },
      data: {
        telegramGroupId: telegramGroupId ? BigInt(telegramGroupId.trim()) : null,
      },
    });
  }

  async setPendingInput(
    telegramId: bigint,
    data: { type: 'hq' } | { type: 'site'; siteId: string }
  ): Promise<void> {
    if (this.redis) {
      await this.redis.set(
        `system:groups:pending:${telegramId.toString()}`,
        JSON.stringify(data),
        'EX',
        300
      );
    }
  }

  async getPendingInput(
    telegramId: bigint
  ): Promise<({ type: 'hq' } | { type: 'site'; siteId: string }) | null> {
    if (!this.redis) return null;
    const raw = await this.redis.get(`system:groups:pending:${telegramId.toString()}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async clearPendingInput(telegramId: bigint): Promise<void> {
    if (this.redis) {
      await this.redis.del(`system:groups:pending:${telegramId.toString()}`);
    }
  }
}
