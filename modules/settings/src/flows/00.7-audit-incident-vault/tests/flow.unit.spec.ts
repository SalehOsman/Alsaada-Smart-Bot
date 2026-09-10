import { describe, it, expect, vi } from 'vitest';
import { AuditIncidentVaultService } from '../flow.service.js';
import type { AuditIncidentVaultRepository } from '../flow.repository.js';
import type { UserJourneyStep, UnresolvedErrorDto } from '../flow.types.js';

describe('Flow 00.7 Unit Tests — AuditIncidentVault', () => {
  const sampleSteps: UserJourneyStep[] = [
    {
      action: 'menu:domain:hr',
      executionTimeMs: 12,
      performanceTier: 'GREEN_FAST',
      errorMessage: null,
      createdAt: new Date(),
    },
    {
      action: 'action:worker:save',
      executionTimeMs: 310,
      performanceTier: 'RED_SLOW',
      errorMessage: 'Database timeout',
      createdAt: new Date(),
    },
  ];

  it('should get journey steps for direct telegramId input', async () => {
    const mockRepo = {
      findTelegramIdByWorkerCode: vi.fn(),
      getUserJourneySteps: vi.fn().mockResolvedValue(sampleSteps),
    } as unknown as AuditIncidentVaultRepository;

    const service = new AuditIncidentVaultService(mockRepo);
    const res = await service.getUserJourney('7594239391');

    expect(res.error).toBeUndefined();
    expect(res.steps).toHaveLength(2);
    expect(mockRepo.getUserJourneySteps).toHaveBeenCalledWith(7594239391n, 10);
  });

  it('should resolve worker code to telegramId before fetching journey', async () => {
    const mockRepo = {
      findTelegramIdByWorkerCode: vi.fn().mockResolvedValue(999888n),
      getUserJourneySteps: vi.fn().mockResolvedValue(sampleSteps),
    } as unknown as AuditIncidentVaultRepository;

    const service = new AuditIncidentVaultService(mockRepo);
    const res = await service.getUserJourney('OP-01');

    expect(res.error).toBeUndefined();
    expect(mockRepo.findTelegramIdByWorkerCode).toHaveBeenCalledWith('OP-01');
    expect(mockRepo.getUserJourneySteps).toHaveBeenCalledWith(999888n, 10);
  });

  it('should resolve active error and record solver id', async () => {
    const mockRepo = {
      resolveError: vi.fn().mockResolvedValue(true),
    } as unknown as AuditIncidentVaultRepository;

    const service = new AuditIncidentVaultService(mockRepo);
    const res = await service.resolveError('err-123', 7594239391n);

    expect(res).toBe(true);
    expect(mockRepo.resolveError).toHaveBeenCalledWith('err-123', 7594239391n);
  });

  it('should purge logs older than 30 days', async () => {
    const mockRepo = {
      purgeLogsOlderThan: vi.fn().mockResolvedValue({
        purgedErrorsCount: 14,
        purgedPerformanceLogsCount: 520,
      }),
    } as unknown as AuditIncidentVaultRepository;

    const service = new AuditIncidentVaultService(mockRepo);
    const res = await service.purgeOldLogs(30);

    expect(res.purgedErrorsCount).toBe(14);
    expect(res.purgedPerformanceLogsCount).toBe(520);
    expect(mockRepo.purgeLogsOlderThan).toHaveBeenCalledWith(30);
  });
});
