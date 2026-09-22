import { describe, it, expect } from 'vitest';
import { verifyModuleBoundaries } from '../verify-module-boundaries.js';

describe('Work Plan 89 — Module Boundaries & Architectural Separation (Phase P9)', () => {
  it('P9.10: verifies zero reverse dependencies and zero illegal cross-module internal imports', () => {
    const report = verifyModuleBoundaries();
    expect(report.checkedImports).toBeGreaterThan(100);

    if (!report.ok) {
      console.error('Module boundary violations detected:', report.violations);
    }

    expect(report.ok).toBe(true);
    expect(report.failures).toHaveLength(0);
    expect(report.violations).toHaveLength(0);
  });
});
