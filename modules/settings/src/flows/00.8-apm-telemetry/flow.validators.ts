import type { AlertPolicyType } from './flow.types.js';

export function validateAlertPolicy(policy: string): policy is AlertPolicyType {
  return policy === 'IMMEDIATE' || policy === 'SMART' || policy === 'DAILY_DIGEST';
}
