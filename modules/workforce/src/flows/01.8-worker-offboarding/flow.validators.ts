import type { TerminationReason } from './flow.types.js';
import { TERMINATION_REASON_LABELS } from './flow.types.js';

export function validateTerminationReason(reason: string): reason is TerminationReason {
  return Object.prototype.hasOwnProperty.call(TERMINATION_REASON_LABELS, reason);
}

export function validateOffboardingEligibility(workerStatus: string): { eligible: boolean; error?: string } {
  if (workerStatus === 'TERMINATED' || workerStatus === 'RESIGNED') {
    return { eligible: false, error: 'هذا العامل منهية خدمته بالفعل بالمنظومة ومسجل بحالة غير نشطة.' };
  }
  return { eligible: true };
}
