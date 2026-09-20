import { describe, it, expect } from 'vitest';
import {
  scanFileForBoundaryViolations,
  verifyBoundaryDeserialization,
} from '../verify-boundary-deserialization.js';

describe('Gate 24: Boundary Deserialization Gate — Unit Tests', () => {
  it('detects blind cast as PositiveFiniteAmount', () => {
    const code = `
      const amount = 500 as PositiveFiniteAmount;
    `;
    const violations = scanFileForBoundaryViolations('apps/test.ts', code);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("uses blind cast 'as PositiveFiniteAmount'");
  });

  it('detects blind cast as SafeFinancialQuantity', () => {
    const code = `
      const qty = 5 as SafeFinancialQuantity;
    `;
    const violations = scanFileForBoundaryViolations('apps/test.ts', code);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("uses blind cast 'as SafeFinancialQuantity'");
  });

  it('detects blind type assertion <PositiveFiniteAmount>', () => {
    const code = `
      const amount = <PositiveFiniteAmount>500;
    `;
    const violations = scanFileForBoundaryViolations('apps/test.ts', code);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("uses blind type assertion '<PositiveFiniteAmount>'");
  });

  it('allows safe usage via toPositiveFiniteAmount', () => {
    const code = `
      import { toPositiveFiniteAmount } from '@alsaada/core-components';
      const amount = toPositiveFiniteAmount(500);
    `;
    const violations = scanFileForBoundaryViolations('apps/test.ts', code);
    expect(violations.length).toBe(0);
  });

  it('exempts single point of re-branding packages/core-components/src/types.ts', () => {
    const code = `
      export function toPositiveFiniteAmount(val: unknown): PositiveFiniteAmount {
        return num as PositiveFiniteAmount;
      }
    `;
    const violations = scanFileForBoundaryViolations('packages/core-components/src/types.ts', code);
    expect(violations.length).toBe(0);
  });

  it('passes on whole repository', () => {
    const res = verifyBoundaryDeserialization(process.cwd());
    expect(res.ok).toBe(true);
    expect(res.failures).toEqual([]);
    expect(res.checked).toBeGreaterThan(50);
  });
});
