import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApmTelemetryService } from '../flow.service.js';
import type { ApmTelemetryRepository } from '../flow.repository.js';
import type { ApmSummaryDto, SlowOperationDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.8 Unit Tests — ApmTelemetry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const sampleSummary: ApmSummaryDto = {
    totalOps24h: 150,
    avgLatencyMs: 24,
    greenPct: 92,
    yellowPct: 6,
    redPct: 2,
  };

  const sampleSlowOps: SlowOperationDto[] = [
    {
      action: 'action:worker_export:excel',
      executionTimeMs: 420,
      actorTelegramId: 7594239391n,
      errorMessage: null,
      createdAt: new Date(),
    },
  ];

  it('fetches APM 24h summary metrics and computes distribution', async () => {
    // Arrange
    const mockRepo = {
      getApmSummary24h: vi.fn().mockResolvedValue(sampleSummary),
    } as unknown as ApmTelemetryRepository;
    const service = new ApmTelemetryService(mockRepo);

    // Act
    const summary = await service.getApmSummary();

    // Assert
    expect(summary.totalOps24h).toBe(150);
    expect(summary.avgLatencyMs).toBe(24);
    expect(mockRepo.getApmSummary24h).toHaveBeenCalledTimes(1);
  });

  it('lists recorded slow operations within threshold limits', async () => {
    // Arrange
    const mockRepo = {
      getSlowOperations24h: vi.fn().mockResolvedValue(sampleSlowOps),
    } as unknown as ApmTelemetryRepository;
    const service = new ApmTelemetryService(mockRepo);

    // Act
    const ops = await service.getSlowOperations();

    // Assert
    expect(ops).toHaveLength(1);
    expect(ops[0]?.executionTimeMs).toBe(420);
    expect(mockRepo.getSlowOperations24h).toHaveBeenCalledWith(10);
  });

  it('validates and updates alert sensitivity policy in repository', async () => {
    // Arrange
    const mockRepo = {
      setAlertPolicy: vi.fn().mockResolvedValue(undefined),
    } as unknown as ApmTelemetryRepository;
    const service = new ApmTelemetryService(mockRepo);

    // Act
    const res = await service.setAlertPolicy('DAILY_DIGEST');

    // Assert
    expect(res.success).toBe(true);
    expect(res.policy).toBe('DAILY_DIGEST');
    expect(mockRepo.setAlertPolicy).toHaveBeenCalledWith('DAILY_DIGEST');
  });

  it('rejects unsupported alert policy string and halts repository persistence', async () => {
    // Arrange
    const mockRepo = {
      setAlertPolicy: vi.fn(),
    } as unknown as ApmTelemetryRepository;
    const service = new ApmTelemetryService(mockRepo);

    // Act
    const res = await service.setAlertPolicy('INVALID_POLICY');

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toBe('سياسة الإنذار غير معتمدة.');
    expect(mockRepo.setAlertPolicy).not.toHaveBeenCalled();
  });
});
