import { describe, it, expect, vi } from 'vitest';
import { ApmTelemetryService } from '../flow.service.js';
import type { ApmTelemetryRepository } from '../flow.repository.js';
import type { ApmSummaryDto, SlowOperationDto } from '../flow.types.js';

describe('Flow 00.8 Unit Tests — ApmTelemetry', () => {
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

  it('should fetch APM summary metrics', async () => {
    const mockRepo = {
      getApmSummary24h: vi.fn().mockResolvedValue(sampleSummary),
    } as unknown as ApmTelemetryRepository;

    const service = new ApmTelemetryService(mockRepo);
    const summary = await service.getApmSummary();

    expect(summary.totalOps24h).toBe(150);
    expect(summary.avgLatencyMs).toBe(24);
    expect(mockRepo.getApmSummary24h).toHaveBeenCalledTimes(1);
  });

  it('should list slow operations correctly', async () => {
    const mockRepo = {
      getSlowOperations24h: vi.fn().mockResolvedValue(sampleSlowOps),
    } as unknown as ApmTelemetryRepository;

    const service = new ApmTelemetryService(mockRepo);
    const ops = await service.getSlowOperations();

    expect(ops).toHaveLength(1);
    expect(ops[0]!.executionTimeMs).toBe(420);
    expect(mockRepo.getSlowOperations24h).toHaveBeenCalledWith(10);
  });

  it('should validate and update alert policy', async () => {
    const mockRepo = {
      setAlertPolicy: vi.fn().mockResolvedValue(undefined),
    } as unknown as ApmTelemetryRepository;

    const service = new ApmTelemetryService(mockRepo);
    const res = await service.setAlertPolicy('DAILY_DIGEST');

    expect(res.success).toBe(true);
    expect(res.policy).toBe('DAILY_DIGEST');
    expect(mockRepo.setAlertPolicy).toHaveBeenCalledWith('DAILY_DIGEST');
  });

  it('should reject invalid alert policy', async () => {
    const mockRepo = {
      setAlertPolicy: vi.fn(),
    } as unknown as ApmTelemetryRepository;

    const service = new ApmTelemetryService(mockRepo);
    const res = await service.setAlertPolicy('INVALID_POLICY');

    expect(res.success).toBe(false);
    expect(mockRepo.setAlertPolicy).not.toHaveBeenCalled();
  });
});
