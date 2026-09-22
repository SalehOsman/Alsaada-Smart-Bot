import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

const { mockCreatedLogs, mockPrisma } = vi.hoisted(() => {
  const created: any[] = [];
  const baseTime = new Date('2026-09-21T12:00:00.000Z');
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
          timestamp: baseTime,
          actorTelegramId: 1001n,
        },
        {
          executionTimeMs: 80,
          performanceTier: 'YELLOW_ACCEPTABLE',
          callbackQueryOrCommand: 'action:worker:directory',
          timestamp: baseTime,
          actorTelegramId: 1002n,
        },
        {
          executionTimeMs: 350,
          performanceTier: 'RED_SLOW',
          callbackQueryOrCommand: 'action:heavy:export',
          timestamp: baseTime,
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
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    service = new TelemetryService();
    mockCreatedLogs.length = 0;
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Performance Tier Categorization SLA', () => {
    it('assigns GREEN_FAST for operations under or equal to 50ms', async () => {
      // Arrange
      const payload = {
        actorTelegramId: 12345n,
        callbackQueryOrCommand: 'action:fast',
        executionTimeMs: 30,
        internalExecutionTimeMs: 25,
        telegramNetworkTimeMs: 5,
      };

      // Act
      await service.recordPerformance(payload);

      // Assert
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
      expect(mockPrisma.botPerformanceLog.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            performanceTier: 'RED_SLOW',
          }),
        })
      );
    });

    it('assigns YELLOW_ACCEPTABLE for operations between 51ms and 250ms', async () => {
      // Arrange
      const payload = {
        actorTelegramId: 12345n,
        callbackQueryOrCommand: 'action:acceptable',
        executionTimeMs: 120,
        internalExecutionTimeMs: 100,
        telegramNetworkTimeMs: 20,
      };

      // Act
      await service.recordPerformance(payload);

      // Assert
      expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            performanceTier: 'YELLOW_ACCEPTABLE',
            executionTimeMs: 120,
            internalExecutionTimeMs: 100,
          }),
        })
      );
      expect(mockPrisma.botPerformanceLog.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            performanceTier: 'GREEN_FAST',
          }),
        })
      );
    });

    it('assigns RED_SLOW for operations exceeding 250ms', async () => {
      // Arrange
      const payload = {
        actorTelegramId: 12345n,
        callbackQueryOrCommand: 'action:slow',
        executionTimeMs: 400,
        internalExecutionTimeMs: 320,
      };

      // Act
      await service.recordPerformance(payload);

      // Assert
      expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            performanceTier: 'RED_SLOW',
            executionTimeMs: 400,
            internalExecutionTimeMs: 320,
          }),
        })
      );
      expect(mockPrisma.botPerformanceLog.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            performanceTier: 'YELLOW_ACCEPTABLE',
          }),
        })
      );
    });
  });

  describe('2. APM Early Warning & Consecutive Alert Triggering', () => {
    it('dispatches alert when internal execution time exceeds 1000ms threshold', async () => {
      // Arrange
      const alerts: TelemetryAlert[] = [];
      service.onAlert((alert) => {
        alerts.push(alert);
      });

      // Act
      await service.recordPerformance({
        actorTelegramId: 99999n,
        callbackQueryOrCommand: 'action:timeout_heavy',
        executionTimeMs: 1250,
        internalExecutionTimeMs: 1100,
        telegramNetworkTimeMs: 150,
        traceId: 'trace-alert-1000',
      });

      // Assert
      expect(alerts.length).toBe(1);
      expect(alerts[0]!.type).toBe('HIGH_INTERNAL_LATENCY');
      expect(alerts[0]!.type).not.toBe('CONSECUTIVE_SLOW_OPERATIONS');
      expect(alerts[0]!.internalExecutionTimeMs).toBe(1100);
      expect(alerts[0]!.traceId).toBe('trace-alert-1000');
    });

    it('dispatches alert when 5 consecutive RED_SLOW operations occur', async () => {
      // Arrange
      const alerts: TelemetryAlert[] = [];
      service.onAlert((alert) => {
        alerts.push(alert);
      });

      // Act & Assert (Step 1: 4 consecutive ops do not trigger alert)
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

      // Act (Step 2: 5th consecutive op triggers alert)
      await service.recordPerformance({
        actorTelegramId: 88888n,
        callbackQueryOrCommand: 'action:slow_5',
        executionTimeMs: 350,
        internalExecutionTimeMs: 320,
      });

      // Assert
      expect(alerts.length).toBe(1);
      expect(alerts[0]!.type).toBe('CONSECUTIVE_SLOW_OPERATIONS');
      expect(alerts[0]!.consecutiveSlowCount).toBe(5);
      expect(alerts[0]!.internalExecutionTimeMs).toBe(320);
      expect(service.getConsecutiveSlowCount()).toBe(0);
      expect(service.getConsecutiveSlowCount()).not.toBe(5);
    });

    it('resets consecutive slow count when a fast or acceptable operation occurs', async () => {
      // Arrange
      for (let i = 0; i < 3; i++) {
        await service.recordPerformance({
          actorTelegramId: 77777n,
          callbackQueryOrCommand: 'action:slow',
          executionTimeMs: 300,
        });
      }
      expect(service.getConsecutiveSlowCount()).toBe(3);

      // Act
      await service.recordPerformance({
        actorTelegramId: 77777n,
        callbackQueryOrCommand: 'action:fast',
        executionTimeMs: 20,
      });

      // Assert
      expect(service.getConsecutiveSlowCount()).toBe(0);
      expect(service.getConsecutiveSlowCount()).not.toBe(3);
    });
  });

  describe('3. APM 24-Hour Summary & Data Retention', () => {
    it('accurately computes 24-hour APM metrics', async () => {
      // Arrange
      // Base mock logs predefined in hoisted mock

      // Act
      const summary = await service.getPerformanceSummary24h();

      // Assert
      expect(summary.totalOps).toBe(3);
      expect(summary.avgLatencyMs).toBe(152);
      expect(summary.greenPct).toBe(33);
      expect(summary.yellowPct).toBe(33);
      expect(summary.redPct).toBe(33);
      expect(summary.slowestOps.length).toBe(3);
      expect(summary.slowestOps[0]!.action).toBe('action:heavy:export');
      expect(summary.slowestOps[0]!.timeMs).toBe(350);
      expect(summary.slowestOps[0]!.action).not.toBe('action:main_menu');
    });

    it('purges logs older than 30 days via purgeOldLogs', async () => {
      // Arrange
      const daysToRetain = 30;

      // Act
      const count = await service.purgeOldLogs(daysToRetain);

      // Assert
      expect(count).toBe(42);
      expect(count).not.toBe(0);
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

    it('safely enforces minimum cutoff of at least 1 day when passed 0 or negative days', async () => {
      // Arrange
      const invalidDays = 0;

      // Act
      await service.purgeOldLogs(invalidDays);

      // Assert
      expect(mockPrisma.botPerformanceLog.deleteMany).toHaveBeenCalled();
      const callArgs = vi.mocked(mockPrisma.botPerformanceLog.deleteMany).mock.calls.at(-1)![0] as any;
      const cutoffDate = callArgs.where.timestamp.lt as Date;
      const diffHours = (PINNED_BASE_TIME.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(23.9);
      expect(diffHours).toBeLessThanOrEqual(24.1);
      expect(diffHours).not.toBe(0);
    });
  });
});
