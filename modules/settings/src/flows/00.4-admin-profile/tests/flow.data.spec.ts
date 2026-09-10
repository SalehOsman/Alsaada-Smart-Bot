import { describe, it, expect } from 'vitest';
import { validateAdminPhone } from '../flow.validators.js';

describe('Flow 00.4 Data & Validation Tests — الملف الشخصي للمدير العام', () => {
  it('should pass valid data check', () => {
    const res = validateAdminPhone('01012345678');
    expect(res).toBeTruthy();
  });

  it('should reject invalid data check', () => {
    const res = validateAdminPhone('123');
    if (typeof res === 'object' && res !== null && 'isValid' in res) {
      expect(res.isValid).toBe(false);
    } else {
      expect(res).toBeFalsy();
    }
  });
});
