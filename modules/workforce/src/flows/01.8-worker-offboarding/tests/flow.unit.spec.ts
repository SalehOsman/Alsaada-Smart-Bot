import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateTerminationReason,
  validateOffboardingEligibility,
} from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('01.8 Worker Offboarding — Unit Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('validates accepted termination reasons and rejects invalid ones', () => {
    // Arrange
    const validReasons = ['RESIGNATION', 'CONTRACT_END', 'MUTUAL_AGREEMENT', 'DISCIPLINARY'];
    const invalidReason = 'INVALID_REASON';

    // Act
    const validResults = validReasons.map((r) => validateTerminationReason(r));
    const invalidResult = validateTerminationReason(invalidReason);

    // Assert
    expect(validResults).toEqual([true, true, true, true]);
    expect(invalidResult).toBe(false);
  });

  it('verifies offboarding eligibility based on current worker status', () => {
    // Arrange
    const activeStatus = 'ACTIVE';
    const onLeaveStatus = 'ON_LEAVE';
    const terminatedStatus = 'TERMINATED';
    const resignedStatus = 'RESIGNED';

    // Act
    const activeResult = validateOffboardingEligibility(activeStatus);
    const onLeaveResult = validateOffboardingEligibility(onLeaveStatus);
    const terminatedResult = validateOffboardingEligibility(terminatedStatus);
    const resignedResult = validateOffboardingEligibility(resignedStatus);

    // Assert
    expect(activeResult.eligible).toBe(true);
    expect(activeResult.error).toBeUndefined();

    expect(onLeaveResult.eligible).toBe(true);
    expect(onLeaveResult.error).toBeUndefined();

    expect(terminatedResult.eligible).toBe(false);
    expect(terminatedResult.error).toContain('منهية خدمته بالفعل');

    expect(resignedResult.eligible).toBe(false);
    expect(resignedResult.error).toContain('منهية خدمته بالفعل');
  });
});
