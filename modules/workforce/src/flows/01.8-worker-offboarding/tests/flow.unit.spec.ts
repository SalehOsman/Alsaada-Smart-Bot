import { describe, it, expect } from 'vitest';
import {
  validateTerminationReason,
  validateOffboardingEligibility,
} from '../flow.validators.js';

describe('01.8 Worker Offboarding — Unit Tests', () => {
  it('should validate accepted termination reasons', () => {
    expect(validateTerminationReason('RESIGNATION')).toBe(true);
    expect(validateTerminationReason('CONTRACT_END')).toBe(true);
    expect(validateTerminationReason('MUTUAL_AGREEMENT')).toBe(true);
    expect(validateTerminationReason('DISCIPLINARY')).toBe(true);
    expect(validateTerminationReason('INVALID_REASON')).toBe(false);
  });

  it('should check offboarding eligibility based on current status', () => {
    expect(validateOffboardingEligibility('ACTIVE').eligible).toBe(true);
    expect(validateOffboardingEligibility('ON_LEAVE').eligible).toBe(true);

    const terminated = validateOffboardingEligibility('TERMINATED');
    expect(terminated.eligible).toBe(false);
    expect(terminated.error).toContain('منهية خدمته بالفعل');

    const resigned = validateOffboardingEligibility('RESIGNED');
    expect(resigned.eligible).toBe(false);
  });
});
