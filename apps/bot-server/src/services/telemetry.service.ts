import { prisma } from '../db.js';
import { safeRedisGet, safeRedisSet } from '../redis.js';
import { TelemetryLogger } from '@alsaada/telemetry';

const logger = new TelemetryLogger({
  service: 'bot-server',
  defaultComponent: 'telemetry-service',
});

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

export interface RecordPerformanceInput {
  actorTelegramId: bigint;
  callbackQueryOrCommand: string;
  executionTimeMs: number;
  internalExecutionTimeMs?: number | undefined;
  telegramNetworkTimeMs?: number | undefined;
  traceId?: string | undefined;
  module?: string | undefined;
  flowId?: string | undefined;
  cacheSource?: string | undefined;
  dbQueryCount?: number | undefined;
  errorMessage?: string | undefined;
}

export interface TelemetryAlert {
  type:
    | 'HIGH_INTERNAL_LATENCY'
    | 'CONSECUTIVE_SLOW_OPERATIONS'
    | 'CIRCUIT_BREAKER_TRIPPED'
    | 'CONNECTION_POOL_HEALED';
  actorTelegramId: bigint;
  action: string;
  internalExecutionTimeMs?: number | undefined;
  executionTimeMs: number;
  consecutiveSlowCount?: number | undefined;
  traceId?: string | undefined;
  timestamp: Date;
  details?: string | undefined;
}

export class TelemetryService {
  private readonly fileIdCache = new Map<string, string>();
  private consecutiveSlowCount = 0;
  private alertListeners: Array<(alert: TelemetryAlert) => void | Promise<void>> = [];

  // Circuit-Breaker Latency Watchdog State (Pillar 5)
  private lastHealTimestamp = 0;
  private circuitBreakerOpen = false;
  private circuitBreakerTrippedAt: Date | null = null;
  private consecutiveWatchdogSlowCount = 0;
  private recentOperationsQueue: number[] = [];
  private connectionPoolWarmer: (() => Promise<void>) | null = null;
  public readonly WATCHDOG_COOLDOWN_MS = 60_000; // 60s cooldown
  public readonly WATCHDOG_LATENCY_THRESHOLD_MS = 500; // 500ms
  public readonly WATCHDOG_CONSECUTIVE_LIMIT = 3; // 3 consecutive operations

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
   * 🔔 تسجيل مستمع للتنبيهات الذكية للـ APM
   */
  onAlert(listener: (alert: TelemetryAlert) => void | Promise<void>): () => void {
    this.alertListeners.push(listener);
    return () => {
      this.alertListeners = this.alertListeners.filter((l) => l !== listener);
    };
  }

  /**
   * استرجاع عدد العمليات البطيئة المتتالية حالياً
   */
  getConsecutiveSlowCount(): number {
    return this.consecutiveSlowCount;
  }

  /**
   * إعادة تعيين عداد العمليات البطيئة المتتالية
   */
  resetConsecutiveSlowCount(): void {
    this.consecutiveSlowCount = 0;
  }

  /**
   * ⚡ رصد الأداء اللحظي وحفظه في الخلفية دون حظر الاستجابة (Fire-and-Forget)
   * وفصل زمن المعالجة الداخلية عن زمن شبكة تليجرام، مع نظام التنبيهات المبكرة
   */
  async recordPerformance(data: RecordPerformanceInput): Promise<void> {
    const effectiveTime = data.internalExecutionTimeMs ?? data.executionTimeMs;

    // Determine tier
    let performanceTier = 'GREEN_FAST';
    if (effectiveTime > 250) {
      performanceTier = 'RED_SLOW';
    } else if (effectiveTime > 50) {
      performanceTier = 'YELLOW_ACCEPTABLE';
    }

    // Check early warning alert conditions
    if (effectiveTime > 1000) {
      this.dispatchAlert({
        type: 'HIGH_INTERNAL_LATENCY',
        actorTelegramId: data.actorTelegramId,
        action: data.callbackQueryOrCommand,
        internalExecutionTimeMs: effectiveTime,
        executionTimeMs: data.executionTimeMs,
        traceId: data.traceId,
        timestamp: new Date(),
      });
    }

    // 1. Moving average queue (last 5 operations)
    this.recentOperationsQueue.push(data.executionTimeMs);
    if (this.recentOperationsQueue.length > 5) {
      this.recentOperationsQueue.shift();
    }

    // 2. Circuit-Breaker Latency Watchdog (> 500ms threshold, 3 consecutive ops)
    if (data.executionTimeMs > this.WATCHDOG_LATENCY_THRESHOLD_MS) {
      this.consecutiveWatchdogSlowCount++;
      if (this.consecutiveWatchdogSlowCount >= this.WATCHDOG_CONSECUTIVE_LIMIT) {
        const now = Date.now();
        const cooldownExpired = now - this.lastHealTimestamp > this.WATCHDOG_COOLDOWN_MS;

        if (cooldownExpired && !this.circuitBreakerOpen) {
          // Cooldown expired (>60s): trigger connection pool auto-heal / warm-up
          this.lastHealTimestamp = now;
          void this.warmUpConnectionPool();
          this.dispatchAlert({
            type: 'CONNECTION_POOL_HEALED',
            actorTelegramId: data.actorTelegramId,
            action: data.callbackQueryOrCommand,
            executionTimeMs: data.executionTimeMs,
            consecutiveSlowCount: this.consecutiveWatchdogSlowCount,
            traceId: data.traceId,
            timestamp: new Date(),
            details: 'Auto-healing connection pool triggered after 3 consecutive slow operations (>500ms).',
          });
        } else if (!cooldownExpired && !this.circuitBreakerOpen) {
          // Recurrent slow operations within 60s cooldown: Trip circuit breaker to prevent self-DDoS!
          this.circuitBreakerOpen = true;
          this.circuitBreakerTrippedAt = new Date();
          this.dispatchAlert({
            type: 'CIRCUIT_BREAKER_TRIPPED',
            actorTelegramId: data.actorTelegramId,
            action: data.callbackQueryOrCommand,
            executionTimeMs: data.executionTimeMs,
            consecutiveSlowCount: this.consecutiveWatchdogSlowCount,
            traceId: data.traceId,
            timestamp: new Date(),
            details: 'Circuit breaker TRIPPED! Recurrent slow operations detected during cooldown. Halting socket bursts.',
          });
        }
      }
    } else {
      this.consecutiveWatchdogSlowCount = 0;
    }

    if (performanceTier === 'RED_SLOW') {
      this.consecutiveSlowCount++;
      if (this.consecutiveSlowCount >= 5) {
        this.dispatchAlert({
          type: 'CONSECUTIVE_SLOW_OPERATIONS',
          actorTelegramId: data.actorTelegramId,
          action: data.callbackQueryOrCommand,
          internalExecutionTimeMs: effectiveTime,
          consecutiveSlowCount: this.consecutiveSlowCount,
          executionTimeMs: data.executionTimeMs,
          traceId: data.traceId,
          timestamp: new Date(),
        });
        this.consecutiveSlowCount = 0;
      }
    } else {
      this.consecutiveSlowCount = 0;
    }

    const memoryMb = Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2));

    // Asynchronously log to Prisma without blocking the request
    void prisma.botPerformanceLog
      .create({
        data: {
          actorTelegramId: data.actorTelegramId,
          callbackQueryOrCommand: data.callbackQueryOrCommand.slice(0, 100),
          executionTimeMs: data.executionTimeMs,
          internalExecutionTimeMs: data.internalExecutionTimeMs ?? null,
          telegramNetworkTimeMs: data.telegramNetworkTimeMs ?? null,
          traceId: data.traceId ?? null,
          module: data.module ? data.module.slice(0, 50) : null,
          flowId: data.flowId ? data.flowId.slice(0, 50) : null,
          cacheSource: data.cacheSource ?? 'DB_QUERY',
          dbQueryCount: data.dbQueryCount ?? 0,
          performanceTier,
          memoryUsageMb: memoryMb,
          errorMessage: data.errorMessage ? data.errorMessage.slice(0, 500) : null,
        },
      })
      .catch(() => {
        // Fire-and-forget fallback
      });
  }

  private dispatchAlert(alert: TelemetryAlert): void {
    logger.warn('APM Early Warning Alert triggered', {
      action: 'telemetry.alert',
      durationMs: alert.executionTimeMs,
      ...(alert.traceId ? { traceId: alert.traceId } : {}),
      payload: {
        alertType: alert.type,
        actorTelegramId: alert.actorTelegramId.toString(),
      },
    });

    for (const listener of this.alertListeners) {
      try {
        const res = listener(alert);
        if (res && typeof res.then === 'function') {
          void res.catch(() => {});
        }
      } catch {
        // Suppress listener error
      }
    }
  }

  /**
   * 🧹 تنظيف سجلات الأداء القديمة (افتراضياً أقدم من 30 يوماً)
   */
  async purgeOldLogs(days = 30): Promise<number> {
    const safeDays = Math.max(1, Number.isFinite(days) ? days : 30);
    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    const result = await prisma.botPerformanceLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoff,
        },
      },
    });
    return result.count;
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

  /**
   * 🛡️ هل قاطع دورة الأداء مفتوح حالياً لحماية الخادم من عاصفة الاستدعاءات (Self-DDoS)؟
   */
  isCircuitBreakerOpen(): boolean {
    return this.circuitBreakerOpen;
  }

  /**
   * 🔄 إعادة تعيين قاطع الدورة وإعادة إغلاقه بعد التعافي
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.circuitBreakerTrippedAt = null;
    this.consecutiveWatchdogSlowCount = 0;
  }

  /**
   * 🛑 فتح قاطع الدورة يدوياً في حالات الطوارئ
   */
  tripCircuitBreaker(details?: string): void {
    this.circuitBreakerOpen = true;
    this.circuitBreakerTrippedAt = new Date();
    this.dispatchAlert({
      type: 'CIRCUIT_BREAKER_TRIPPED',
      actorTelegramId: 0n,
      action: 'manual_trip',
      executionTimeMs: 0,
      timestamp: new Date(),
      details: details || 'Circuit breaker tripped manually.',
    });
  }

  getCircuitBreakerTrippedAt(): Date | null {
    return this.circuitBreakerTrippedAt;
  }

  getLastHealTimestamp(): number {
    return this.lastHealTimestamp;
  }

  setLastHealTimestamp(ts: number): void {
    this.lastHealTimestamp = ts;
  }

  getConsecutiveWatchdogSlowCount(): number {
    return this.consecutiveWatchdogSlowCount;
  }

  /**
   * 📈 استرجاع المتوسط المتحرك لزمن الاستجابة لآخر 5 عمليات (Moving Average)
   */
  getMovingAverageLatency(): number {
    if (this.recentOperationsQueue.length === 0) return 0;
    const sum = this.recentOperationsQueue.reduce((acc, curr) => acc + curr, 0);
    return Math.round((sum / this.recentOperationsQueue.length) * 100) / 100;
  }

  /**
   * تسجيل دالة تدفئة مجمع المقابس عند رصد البطء
   */
  setConnectionPoolWarmer(warmer: () => Promise<void>): void {
    this.connectionPoolWarmer = warmer;
  }

  /**
   * ⚡ استعادة وتدفئة مجمع المقابس فورياً (Connection Pool Auto-Heal)
   */
  async warmUpConnectionPool(): Promise<void> {
    if (this.connectionPoolWarmer) {
      try {
        await this.connectionPoolWarmer();
      } catch (err) {
        logger.warn('Connection pool warmer failed', {
          action: 'telemetry.warmer_failed',
          payload: { error: String(err) },
        });
      }
    }
  }
}

export const telemetryService = new TelemetryService();
