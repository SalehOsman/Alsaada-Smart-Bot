import { describe, it, expect } from 'vitest';
import { validateSiteScope } from '../flow.validators.js';

describe('Flow 00.5 Data & Validation Tests — تعيين وتوزيع مدراء المواقع', () => {
  it('should pass valid data check', () => {
    const res = validateSiteScope('GLOBAL');
    expect(res).toBeTruthy();
  });

  it('should reject invalid data check', () => {
    const res = validateSiteScope('?');
    expect(res).toBe(false);
  });

});
