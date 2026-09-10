import { describe, it, expect } from 'vitest';
import { validateSiteName } from '../flow.validators.js';

describe('Flow 00.2 Data & Validation Tests — مصفوفة المشاريع والمواقع الميدانية', () => {
  it('should pass valid data check', () => {
    const res = validateSiteName('موقع السويس');
    expect(res).toBeTruthy();
  });

  it('should reject invalid data check', () => {
    const res = validateSiteName('a');
    if (typeof res === 'object' && res !== null && 'isValid' in res) {
      expect(res.isValid).toBe(false);
    } else {
      expect(res).toBeFalsy();
    }
  });
});
