import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  scanFileForBoundaryViolations,
  verifyBoundaryDeserialization,
} from '../verify-boundary-deserialization.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Gate 24: Boundary Deserialization Gate — Unit Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('detects blind cast as PositiveFiniteAmount', () => {
    // Arrange
    const filePath = 'apps/test.ts';
    const code = `
      const amount = 500 as PositiveFiniteAmount;
    `;

    // Act
    const violations = scanFileForBoundaryViolations(filePath, code);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("uses blind cast 'as PositiveFiniteAmount'");
    expect(violations[0]).not.toContain("uses blind cast 'as SafeFinancialQuantity'");
  });

  it('detects blind cast as SafeFinancialQuantity', () => {
    // Arrange
    const filePath = 'apps/test.ts';
    const code = `
      const qty = 5 as SafeFinancialQuantity;
    `;

    // Act
    const violations = scanFileForBoundaryViolations(filePath, code);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("uses blind cast 'as SafeFinancialQuantity'");
    expect(violations[0]).not.toContain("uses blind cast 'as PositiveFiniteAmount'");
  });

  it('detects blind type assertion <PositiveFiniteAmount>', () => {
    // Arrange
    const filePath = 'apps/test.ts';
    const code = `
      const amount = <PositiveFiniteAmount>500;
    `;

    // Act
    const violations = scanFileForBoundaryViolations(filePath, code);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("uses blind type assertion '<PositiveFiniteAmount>'");
    expect(violations[0]).not.toContain("uses blind cast 'as PositiveFiniteAmount'");
  });

  it('allows safe usage via toPositiveFiniteAmount', () => {
    // Arrange
    const filePath = 'apps/test.ts';
    const code = `
      import { toPositiveFiniteAmount } from '@alsaada/core-components';
      const amount = toPositiveFiniteAmount(500);
    `;

    // Act
    const violations = scanFileForBoundaryViolations(filePath, code);

    // Assert
    expect(violations).toHaveLength(0);
    expect(violations).not.toContain("uses blind cast 'as PositiveFiniteAmount'");
  });

  it('exempts single point of re-branding packages/core-components/src/types.ts', () => {
    // Arrange
    const filePath = 'packages/core-components/src/types.ts';
    const code = `
      export function toPositiveFiniteAmount(val: unknown): PositiveFiniteAmount {
        return num as PositiveFiniteAmount;
      }
    `;

    // Act
    const violations = scanFileForBoundaryViolations(filePath, code);

    // Assert
    expect(violations).toHaveLength(0);
    expect(violations).not.toContain("uses blind cast 'as PositiveFiniteAmount'");
  });

  it('passes on whole repository', () => {
    // Arrange
    const cwd = process.cwd();

    // Act
    const res = verifyBoundaryDeserialization(cwd);

    // Assert
    expect(res.ok).toBe(true);
    expect(res.failures).toHaveLength(0);
    expect(res.checked).toBeGreaterThan(50);
  });
});
