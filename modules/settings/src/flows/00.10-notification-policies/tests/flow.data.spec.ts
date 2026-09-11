import { describe, it, expect } from 'vitest';
import { FEATURE_POLICIES_CATALOG } from '@alsaada/core-components';
import { validateFeatureKey, validatePolicyScope } from '../flow.validators.js';

describe('Flow 00.10: Data & Validation Spec', () => {
  it('validates scopes correctly', () => {
    expect(validatePolicyScope('site')).toBe(true);
    expect(validatePolicyScope('hq')).toBe(true);
    expect(validatePolicyScope('invalid')).toBe(false);
  });

  it('validates feature keys against the catalog', () => {
    expect(validateFeatureKey('canteen:cigarettes')).toBe(true);
    expect(validateFeatureKey('unknown:action')).toBe(false);
    expect(FEATURE_POLICIES_CATALOG.length).toBeGreaterThan(10);
  });
});
