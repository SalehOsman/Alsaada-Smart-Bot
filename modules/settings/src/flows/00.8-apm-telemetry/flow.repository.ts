import type { PrismaClient } from '@alsaada/database';
import type { Redis } from 'ioredis';
import type { SlowOperationDto, ApmSummaryDto, AlertPolicyType } from './flow.types.js';

export class ApmTelemetryRepository {
  private localPolicy: AlertPolicyType = 'SMART';

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis?: Redis | null
  ) {}

  async getSlowOperations24h(limit = 10): Promise<SlowOperationDto[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await this.prisma.botPerformanceLog.findMany({
      where: {
        timestamp: { gte: since },
        executionTimeMs: { gte: 250 },
      },
      orderBy: { executionTimeMs: 'desc' },
      take: limit,
    });

    return logs.map((l) => ({
      action: l.callbackQueryOrCommand,
      executionTimeMs: l.executionTimeMs,
      actorTelegramId: l.actorTelegramId,
      errorMessage: l.errorMessage,
      createdAt: l.timestamp,
    }));
  }

  async getApmSummary24h(): Promise<ApmSummaryDto> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await this.prisma.botPerformanceLog.findMany({
      where: { timestamp: { gte: since } },
      select: { executionTimeMs: true, performanceTier: true },
    });


    if (logs.length === 0) {
      return { totalOps24h: 0, avgLatencyMs: 0, greenPct: 100, yellowPct: 0, redPct: 0 };
    }

    const totalOps = logs.length;
    const totalLatency = logs.reduce((acc, l) => acc + l.executionTimeMs, 0);
    const avgLatency = Math.round(totalLatency / totalOps);

    let green = 0;
    let yellow = 0;
    let red = 0;

    for (const l of logs) {
      if (l.performanceTier === 'GREEN_FAST') green++;
      else if (l.performanceTier === 'YELLOW_ACCEPTABLE') yellow++;
      else red++;
    }

    return {
      totalOps24h: totalOps,
      avgLatencyMs: avgLatency,
      greenPct: Math.round((green / totalOps) * 100),
      yellowPct: Math.round((yellow / totalOps) * 100),
      redPct: Math.round((red / totalOps) * 100),
    };
  }

  async pingPostgres(): Promise<{ latencyMs: number; isHealthy: boolean }> {
    const start = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { latencyMs: Math.round(performance.now() - start), isHealthy: true };
    } catch {
      return { latencyMs: Math.round(performance.now() - start), isHealthy: false };
    }
  }

  async checkRedis(): Promise<{ latencyMs: number; memoryUsed: string; isHealthy: boolean }> {
    if (!this.redis) {
      return { latencyMs: 0, memoryUsed: 'In-Memory (Local)', isHealthy: true };
    }

    const start = performance.now();
    try {
      await this.redis.ping();
      const latency = Math.round(performance.now() - start);
      const info = await this.redis.info('memory');
      const match = info.match(/used_memory_human:(.+)/);
      const memoryUsed = match && match[1] ? match[1].trim() : 'N/A';
      return { latencyMs: latency, memoryUsed, isHealthy: true };
    } catch {
      return { latencyMs: Math.round(performance.now() - start), memoryUsed: 'Unavailable', isHealthy: false };
    }
  }

  async getAlertPolicy(): Promise<AlertPolicyType> {
    if (this.redis) {
      const raw = await this.redis.get('system:alert_policy');
      if (raw && (raw === 'IMMEDIATE' || raw === 'SMART' || raw === 'DAILY_DIGEST')) {
        return raw as AlertPolicyType;
      }
    }
    return this.localPolicy;
  }

  async setAlertPolicy(policy: AlertPolicyType): Promise<void> {
    if (this.redis) {
      await this.redis.set('system:alert_policy', policy);
    } else {
      this.localPolicy = policy;
    }
  }
}
