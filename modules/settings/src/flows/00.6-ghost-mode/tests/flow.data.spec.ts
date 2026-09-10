import { describe, it, expect } from 'vitest';
import { validateImpersonationRole } from '../flow.validators.js';

describe('Flow 00.6 Data & Validation Tests — محاكاة وتقمص الأدوار', () => {
  it('should pass valid data check', () => {
    const res = validateImpersonationRole('FIELD_ADMIN').isValid;
    expect(res).toBeTruthy();
  });

  it('should reject invalid data check', () => {
    const res = validateImpersonationRole('INVALID').isValid;
    expect(res).toBe(false);
  });

});
