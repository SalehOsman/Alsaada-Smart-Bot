import { FEATURE_POLICIES_CATALOG } from '@alsaada/core-components';
import type { PolicyScope } from './flow.types.js';

export function validatePolicyScope(scope: string): scope is PolicyScope {
  return scope === 'site' || scope === 'hq';
}

export function validateFeatureKey(featureKey: string): boolean {
  return FEATURE_POLICIES_CATALOG.some((f) => f.featureKey === featureKey);
}
