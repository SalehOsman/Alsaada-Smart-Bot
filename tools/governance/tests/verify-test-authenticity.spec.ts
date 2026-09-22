import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  scanSpecContentForAuthenticity,
  verifyTestAuthenticity,
} from '../verify-test-authenticity.js';
import {
  SHAM_INEQUALITY_FIXTURE,
  AUTHENTIC_BOUNDARY_FIXTURE,
  TAUTOLOGY_FIXTURE,
  CONSTANT_LITERAL_FIXTURE,
  BOOLEAN_LITERAL_FIXTURE,
  AUTHENTIC_EXECUTION_FIXTURE,
  SYNTHETIC_MUTEX_FIXTURE,
} from './fixtures/test-authenticity-fixtures.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Gate 22: Code Authenticity Verification AST Scanner', () => {
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

  it('detects vacuous lower bound checks on non-negative counts', () => {
    // Arrange
    const specPath = 'test.spec.ts';
    const code = SHAM_INEQUALITY_FIXTURE;

    // Act
    const violations = scanSpecContentForAuthenticity(specPath, code);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("uses 'toBeGreaterThanOrEqual(0)'");
    expect(violations[0]).not.toContain('declares synthetic concurrency control class');
  });

  it('allows authentic boundary checks with valid thresholds', () => {
    // Arrange
    const specPath = 'test.spec.ts';
    const code = AUTHENTIC_BOUNDARY_FIXTURE;

    // Act
    const violations = scanSpecContentForAuthenticity(specPath, code);

    // Assert
    expect(violations).toHaveLength(0);
    expect(violations).not.toContain("uses 'toBeGreaterThanOrEqual(0)'");
  });

  it('detects self identity variable comparisons', () => {
    // Arrange
    const specPath = 'test.spec.ts';
    const code = TAUTOLOGY_FIXTURE;

    // Act
    const violations = scanSpecContentForAuthenticity(specPath, code);

    // Assert
    expect(violations).toHaveLength(2);
    expect(violations[0]).toContain("compares 'x' to itself");
    expect(violations[1]).toContain("compares 'x' to itself");
    expect(violations[0]).not.toContain("uses 'toBeGreaterThanOrEqual(0)'");
  });

  it('detects constant literal threshold comparisons', () => {
    // Arrange
    const specPath = 'test.spec.ts';
    const code = CONSTANT_LITERAL_FIXTURE;

    // Act
    const violations = scanSpecContentForAuthenticity(specPath, code);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("asserts constant 'sampleAmount = 250.75'");
    expect(violations[0]).not.toContain("uses 'toBeGreaterThanOrEqual(0)'");
  });

  it('detects boolean primitive literal comparisons', () => {
    // Arrange
    const specPath = 'test.spec.ts';
    const code = BOOLEAN_LITERAL_FIXTURE;

    // Act
    const violations = scanSpecContentForAuthenticity(specPath, code);

    // Assert
    expect(violations).toHaveLength(2);
    expect(violations[0]).toContain("asserts constant boolean 'true'");
    expect(violations[1]).toContain("asserts constant boolean 'false'");
    expect(violations[0]).not.toContain("uses 'toBeGreaterThanOrEqual(0)'");
  });

  it('allows authentic code execution with concrete assertions', () => {
    // Arrange
    const specPath = 'test.spec.ts';
    const code = AUTHENTIC_EXECUTION_FIXTURE;

    // Act
    const violations = scanSpecContentForAuthenticity(specPath, code);

    // Assert
    expect(violations).toHaveLength(0);
    expect(violations).not.toContain("uses 'toBeGreaterThanOrEqual(0)'");
  });

  it('detects synthetic concurrency primitive classes', () => {
    // Arrange
    const specPath = 'test.spec.ts';
    const code = SYNTHETIC_MUTEX_FIXTURE;

    // Act
    const violations = scanSpecContentForAuthenticity(specPath, code);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("declares synthetic concurrency control class 'TestMutex'");
    expect(violations[0]).not.toContain("uses 'toBeGreaterThanOrEqual(0)'");
  });

  it('passes on whole repository', () => {
    // Arrange
    const cwd = process.cwd();

    // Act
    const res = verifyTestAuthenticity(cwd);

    // Assert
    expect(res.ok).toBe(true);
    expect(res.failures).toHaveLength(0);
    expect(res.checked).toBeGreaterThan(50);
  });
});
