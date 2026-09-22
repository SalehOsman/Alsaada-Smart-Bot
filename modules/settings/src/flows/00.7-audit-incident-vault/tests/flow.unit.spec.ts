import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditIncidentVaultService } from '../flow.service.js';
import type { AuditIncidentVaultRepository } from '../flow.repository.js';
import type { UserJourneyStep } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.7 Unit Tests — AuditIncidentVault', () => {
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

  it('retrieves user journey steps for numeric telegramId input', async () => {
    // Arrange
    const mockRepo = {
      findTelegramIdByWorkerCode: vi.fn(),
      getUserJourneySteps: vi.fn().mockResolvedValue(sampleSteps),
    } as unknown as AuditIncidentVaultRepository;
    const service = new AuditIncidentVaultService(mockRepo);

    // Act
    const res = await service.getUserJourney('7594239391');

    // Assert
    expect(res.error).toBeUndefined();
    expect(res.steps).toHaveLength(2);
    expect(mockRepo.getUserJourneySteps).toHaveBeenCalledWith(7594239391n, 10);
  });

  it('resolves alphanumeric worker code to telegramId before querying journey', async () => {
    // Arrange
    const mockRepo = {
      findTelegramIdByWorkerCode: vi.fn().mockResolvedValue(999888n),
      getUserJourneySteps: vi.fn().mockResolvedValue(sampleSteps),
    } as unknown as AuditIncidentVaultRepository;
    const service = new AuditIncidentVaultService(mockRepo);

    // Act
    const res = await service.getUserJourney('OP-01');

    // Assert
    expect(res.error).toBeUndefined();
    expect(mockRepo.findTelegramIdByWorkerCode).toHaveBeenCalledWith('OP-01');
    expect(mockRepo.getUserJourneySteps).toHaveBeenCalledWith(999888n, 10);
  });

  it('rejects unmapped worker code and aborts journey lookup', async () => {
    // Arrange
    const mockRepo = {
      findTelegramIdByWorkerCode: vi.fn().mockResolvedValue(null),
      getUserJourneySteps: vi.fn(),
    } as unknown as AuditIncidentVaultRepository;
    const service = new AuditIncidentVaultService(mockRepo);

    // Act
    const res = await service.getUserJourney('UNKNOWN-CODE');

    // Assert
    expect(res.error).toContain('لم يتم العثور على حساب تيليجرام');
    expect(res.steps).toHaveLength(0);
    expect(mockRepo.getUserJourneySteps).not.toHaveBeenCalled();
  });

  it('rejects invalid identifier format with localized error without database access', async () => {
    // Arrange
    const mockRepo = {
      findTelegramIdByWorkerCode: vi.fn(),
      getUserJourneySteps: vi.fn(),
    } as unknown as AuditIncidentVaultRepository;
    const service = new AuditIncidentVaultService(mockRepo);

    // Act
    const res = await service.getUserJourney('###');

    // Assert
    expect(res.error).toContain('يرجى إدخال معرف تيليجرام صحيح');
    expect(res.steps).toHaveLength(0);
    expect(mockRepo.findTelegramIdByWorkerCode).not.toHaveBeenCalled();
    expect(mockRepo.getUserJourneySteps).not.toHaveBeenCalled();
  });

  it('resolves active system incident and stamps investigator attribution', async () => {
    // Arrange
    const mockRepo = {
      resolveError: vi.fn().mockResolvedValue(true),
    } as unknown as AuditIncidentVaultRepository;
    const service = new AuditIncidentVaultService(mockRepo);

    // Act
    const res = await service.resolveError('err-123', 7594239391n);

    // Assert
    expect(res).toBe(true);
    expect(mockRepo.resolveError).toHaveBeenCalledWith('err-123', 7594239391n);
  });

  it('purges audit and error log records beyond retention window', async () => {
    // Arrange
    const mockRepo = {
      purgeLogsOlderThan: vi.fn().mockResolvedValue({
        purgedErrorsCount: 14,
        purgedPerformanceLogsCount: 520,
      }),
    } as unknown as AuditIncidentVaultRepository;
    const service = new AuditIncidentVaultService(mockRepo);

    // Act
    const res = await service.purgeOldLogs(30);

    // Assert
    expect(res.purgedErrorsCount).toBe(14);
    expect(res.purgedPerformanceLogsCount).toBe(520);
    expect(mockRepo.purgeLogsOlderThan).toHaveBeenCalledWith(30);
  });
});
