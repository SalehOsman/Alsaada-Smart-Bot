import { prisma } from '../db.js';
import { safeRedisGet, safeRedisSet } from '../redis.js';

export interface UserBreadcrumb {
  action: string;
  timestamp: number;
}

export interface PerformanceSummary {
  totalOps: number;
  avgLatencyMs: number;
  greenPct: number;
  yellowPct: number;
  redPct: number;
  slowestOps: Array<{
    action: string;
    timeMs: number;
    timestamp: Date;
    actorTelegramId: bigint;
  }>;
}

export class TelemetryService {
  private readonly fileIdCache = new Map<string, string>();

  /**
   * ✈️ Flight Recorder (Breadcrumbs):
   * يسجل آخر 5 حركات تفاعلية قام بها المستخدم في Redis
   */
  async recordBreadcrumb(telegramId: bigint, action: string): Promise<void> {
    try {
      const key = `user_breadcrumbs:${telegramId}`;
      const raw = await safeRedisGet(key);
      const list: UserBreadcrumb[] = raw ? JSON.parse(raw) : [];
      list.push({ action, timestamp: Date.now() });
      if (list.length > 5) {
        list.shift();
      }
      await safeRedisSet(key, JSON.stringify(list), 3600); // 1 hour TTL
    } catch {
      // Non-blocking silent catch
    }
  }

  /**
   * 🔍 استرجاع شريط آخر حركات للمستخدم
   */
  async getBreadcrumbs(telegramId: bigint): Promise<UserBreadcrumb[]> {
    try {
      const key = `user_breadcrumbs:${telegramId}`;
      const raw = await safeRedisGet(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * ⚡ رصد الأداء اللحظي وحفظه في الخلفية دون حظر الاستجابة (Fire-and-Forget)
   */
  async recordPerformance(data: {
    actorTelegramId: bigint;
    callbackQueryOrCommand: string;
    executionTimeMs: number;
    errorMessage?: string;
  }): Promise<void> {
    // Determine tier
    let performanceTier = 'GREEN_FAST';
    if (data.executionTimeMs > 250) {
      performanceTier = 'RED_SLOW';
    } else if (data.executionTimeMs > 50) {
      performanceTier = 'YELLOW_ACCEPTABLE';
    }

    const memoryMb = Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2));

    // Asynchronously log to Prisma without blocking the request
    void prisma.botPerformanceLog
      .create({
        data: {
          actorTelegramId: data.actorTelegramId,
          callbackQueryOrCommand: data.callbackQueryOrCommand.slice(0, 100),
          executionTimeMs: data.executionTimeMs,
          performanceTier,
          memoryUsageMb: memoryMb,
          errorMessage: data.errorMessage ? data.errorMessage.slice(0, 500) : null,
        },
      })
      .catch(() => {
        // Fire-and-forget fallback
      });
  }

  /**
   * 📊 إحصائيات APM لأداء المنظومة خلال آخر 24 ساعة
   */
  async getPerformanceSummary24h(): Promise<PerformanceSummary> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const logs = await prisma.botPerformanceLog.findMany({
      where: { timestamp: { gte: since } },
      select: {
        executionTimeMs: true,
        performanceTier: true,
        callbackQueryOrCommand: true,
        timestamp: true,
        actorTelegramId: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    const totalOps = logs.length;
    if (totalOps === 0) {
      return {
        totalOps: 0,
        avgLatencyMs: 0,
        greenPct: 100,
        yellowPct: 0,
        redPct: 0,
        slowestOps: [],
      };
    }

    const sumLatency = logs.reduce((acc, curr) => acc + curr.executionTimeMs, 0);
    const avgLatencyMs = Math.round(sumLatency / totalOps);

    const greenCount = logs.filter((l) => l.performanceTier === 'GREEN_FAST').length;
    const yellowCount = logs.filter((l) => l.performanceTier === 'YELLOW_ACCEPTABLE').length;
    const redCount = logs.filter((l) => l.performanceTier === 'RED_SLOW').length;

    const greenPct = Math.round((greenCount / totalOps) * 100);
    const yellowPct = Math.round((yellowCount / totalOps) * 100);
    const redPct = Math.round((redCount / totalOps) * 100);

    // Sort by execution time descending to get the slowest 5 operations
    const slowest = [...logs]
      .sort((a, b) => b.executionTimeMs - a.executionTimeMs)
      .slice(0, 5)
      .map((l) => ({
        action: l.callbackQueryOrCommand,
        timeMs: l.executionTimeMs,
        timestamp: l.timestamp,
        actorTelegramId: l.actorTelegramId,
      }));

    return {
      totalOps,
      avgLatencyMs,
      greenPct,
      yellowPct,
      redPct,
      slowestOps: slowest,
    };
  }

  /**
   * 📦 File-ID Caching: تخزين واسترجاع معرف وسائط تليجرام للإرسال الفوري
   */
  setCachedFileId(key: string, fileId: string): void {
    this.fileIdCache.set(key, fileId);
  }

  getCachedFileId(key: string): string | undefined {
    return this.fileIdCache.get(key);
  }
}

export const telemetryService = new TelemetryService();
