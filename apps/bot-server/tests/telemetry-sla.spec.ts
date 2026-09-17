import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreatedLogs, mockPrisma } = vi.hoisted(() => {
  const created: any[] = [];
  const prisma = {
    botPerformanceLog: {
      create: vi.fn().mockImplementation(({ data }: { data: any }) => {
        created.push(data);
        return Promise.resolve({ id: 'log-' + created.length, ...data });
      }),
      deleteMany: vi.fn().mockImplementation(() => {
        return Promise.resolve({ count: 42 });
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          executionTimeMs: 25,
          performanceTier: 'GREEN_FAST',
          callbackQueryOrCommand: 'action:main_menu',
          timestamp: new Date(),
          actorTelegramId: 1001n,
        },
        {
          executionTimeMs: 80,
          performanceTier: 'YELLOW_ACCEPTABLE',
          callbackQueryOrCommand: 'action:worker:directory',
          timestamp: new Date(),
          actorTelegramId: 1002n,
        },
        {
          executionTimeMs: 350,
          performanceTier: 'RED_SLOW',
          callbackQueryOrCommand: 'action:heavy:export',
          timestamp: new Date(),
          actorTelegramId: 1003n,
        },
      ]),
    },
  };
  return { mockCreatedLogs: created, mockPrisma: prisma };
});

vi.mock('../src/db.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../src/redis.js', () => ({
  safeRedisGet: vi.fn().mockResolvedValue(null),
  safeRedisSet: vi.fn().mockResolvedValue(true),
}));

import { TelemetryService, type TelemetryAlert } from '../src/services/telemetry.service.js';

describe('📊 Telemetry APM & SLA Monitoring Suite', () => {
  let service: TelemetryService;

  beforeEach(() => {
    service = new TelemetryService();
    mockCreatedLogs.length = 0;
    vi.clearAllMocks();
  });

  describe('1. Performance Tier Categorization SLA', () => {
    it('should assign GREEN_FAST for operations <= 50ms', async () => {
      await service.recordPerformance({
        actorTelegramId: 12345n,
        callbackQueryOrCommand: 'action:fast',
        executionTimeMs: 30,
        internalExecutionTimeMs: 25,
        telegramNetworkTimeMs: 5,
      });

      expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            performanceTier: 'GREEN_FAST',
            executionTimeMs: 30,
            internalExecutionTimeMs: 25,
            telegramNetworkTimeMs: 5,
          }),
        })
      );
    });

    it('should assign YELLOW_ACCEPTABLE for operations between 51ms and 250ms', async () => {
      await service.recordPerformance({
        actorTelegramId: 12345n,
        callbackQueryOrCommand: 'action:acceptable',
        executionTimeMs: 120,
        internalExecutionTimeMs: 100,
        telegramNetworkTimeMs: 20,
      });

      expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            performanceTier: 'YELLOW_ACCEPTABLE',
            executionTimeMs: 120,
            internalExecutionTimeMs: 100,
          }),
        })
      );
    });

    it('should assign RED_SLOW for operations > 250ms', async () => {
      await service.recordPerformance({
        actorTelegramId: 12345n,
        callbackQueryOrCommand: 'action:slow',
        executionTimeMs: 400,
        internalExecutionTimeMs: 320,
      });

      expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            performanceTier: 'RED_SLOW',
            executionTimeMs: 400,
            internalExecutionTimeMs: 320,
          }),
        })
      );
    });
  });

  describe('2. APM Early Warning & Consecutive Alert Triggering', () => {
    it('should dispatch alert when internal execution time exceeds 1000ms threshold', async () => {
      const alerts: TelemetryAlert[] = [];
      service.onAlert((alert) => {
        alerts.push(alert);
      });

      await service.recordPerformance({
        actorTelegramId: 99999n,
        callbackQueryOrCommand: 'action:timeout_heavy',
        executionTimeMs: 1250,
        internalExecutionTimeMs: 1100,
        telegramNetworkTimeMs: 150,
        traceId: 'trace-alert-1000',
      });

      expect(alerts.length).toBe(1);
      expect(alerts[0]!.type).toBe('HIGH_INTERNAL_LATENCY');
      expect(alerts[0]!.internalExecutionTimeMs).toBe(1100);
      expect(alerts[0]!.traceId).toBe('trace-alert-1000');
    });

    it('should dispatch alert when 5 consecutive RED_SLOW operations occur', async () => {
      const alerts: TelemetryAlert[] = [];
      service.onAlert((alert) => {
        alerts.push(alert);
      });

      // 4 consecutive RED_SLOW ops (should not alert yet)
      for (let i = 1; i <= 4; i++) {
        await service.recordPerformance({
          actorTelegramId: 88888n,
          callbackQueryOrCommand: `action:slow_${i}`,
          executionTimeMs: 300,
          internalExecutionTimeMs: 290,
        });
        expect(service.getConsecutiveSlowCount()).toBe(i);
        expect(alerts.length).toBe(0);
      }

      // 5th consecutive RED_SLOW op -> triggers CONSECUTIVE_SLOW_OPERATIONS alert
      await service.recordPerformance({
        actorTelegramId: 88888n,
        callbackQueryOrCommand: 'action:slow_5',
        executionTimeMs: 350,
        internalExecutionTimeMs: 320,
      });

      expect(alerts.length).toBe(1);
      expect(alerts[0]!.type).toBe('CONSECUTIVE_SLOW_OPERATIONS');
      expect(alerts[0]!.consecutiveSlowCount).toBe(5);
      expect(alerts[0]!.internalExecutionTimeMs).toBe(320);

      // Counter resets to 0 after alert
      expect(service.getConsecutiveSlowCount()).toBe(0);
    });

    it('should reset consecutive slow count when a fast or acceptable operation occurs', async () => {
      // 3 slow operations
      for (let i = 0; i < 3; i++) {
        await service.recordPerformance({
          actorTelegramId: 77777n,
          callbackQueryOrCommand: 'action:slow',
          executionTimeMs: 300,
        });
      }
      expect(service.getConsecutiveSlowCount()).toBe(3);

      // Fast operation occurs
      await service.recordPerformance({
        actorTelegramId: 77777n,
        callbackQueryOrCommand: 'action:fast',
        executionTimeMs: 20,
      });

      // Counter must be reset to 0
      expect(service.getConsecutiveSlowCount()).toBe(0);
    });
  });

  describe('3. APM 24-Hour Summary & Data Retention', () => {
    it('should accurately compute 24-hour APM metrics', async () => {
      const summary = await service.getPerformanceSummary24h();

      expect(summary.totalOps).toBe(3);
      // Avg latency of 25, 80, 350 = 455 / 3 = 151.67 -> 152 ms
      expect(summary.avgLatencyMs).toBe(152);
      expect(summary.greenPct).toBe(33);
      expect(summary.yellowPct).toBe(33);
      expect(summary.redPct).toBe(33);
      expect(summary.slowestOps.length).toBe(3);
      expect(summary.slowestOps[0]!.action).toBe('action:heavy:export');
      expect(summary.slowestOps[0]!.timeMs).toBe(350);
    });

    it('should purge logs older than 30 days via purgeOldLogs', async () => {
      const count = await service.purgeOldLogs(30);

      expect(count).toBe(42);
      expect(mockPrisma.botPerformanceLog.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timestamp: {
              lt: expect.any(Date),
            },
          },
        })
      );
    });

    it('should safely enforce a minimum cutoff of at least 1 day even when passed 0 or negative days', async () => {
      await service.purgeOldLogs(0);
      expect(mockPrisma.botPerformanceLog.deleteMany).toHaveBeenCalled();
      const callArgs = vi.mocked(mockPrisma.botPerformanceLog.deleteMany).mock.calls.at(-1)![0] as any;
      const cutoffDate = callArgs.where.timestamp.lt as Date;
      // Cutoff must be approximately 1 day in the past (not now)
      const diffHours = (Date.now() - cutoffDate.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(23.9);
      expect(diffHours).toBeLessThanOrEqual(24.1);
    });
  });
});
