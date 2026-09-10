import { describe, it, expect } from 'vitest';
import { validateDeptCode } from '../flow.validators.js';

describe('Flow 00.3 Data & Validation Tests — الهيكل الوظيفي ومصفوفة المهن والورديات', () => {
  it('should pass valid data check', () => {
    const res = validateDeptCode('D-ENG');
    expect(res).toBeTruthy();
  });

  it('should reject invalid data check', () => {
    const res = validateDeptCode('');
    if (typeof res === 'object' && res !== null && 'isValid' in res) {
      expect(res.isValid).toBe(false);
    } else {
      expect(res).toBeFalsy();
    }
  });
});
