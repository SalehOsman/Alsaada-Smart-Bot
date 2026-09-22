import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { auditTestFileAST, auditTestFile, RULE_NAMES } from '../test-constitutional-sentinel.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('TypeSafe Constitutional Test Sentinel Specification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Rule R1: Triple-A Structure Enforcement', () => {
    it('detects missing Arrange, Act, or Assert markers in multi-statement tests', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it('executes user operation', () => {
            const x = 1;
            const y = x + 2;
            expect(y).toBe(3);
            expect(y).not.toBe(0);
          });
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r1 = violations.filter((v) => v.rule === 'R1');
      expect(r1.length).toBeGreaterThan(0);
      expect(r1[0]!.ruleName).toBe(RULE_NAMES.R1);
      expect(r1[0]!.message).toContain('lacks explicit Triple-A separation');
      expect(r1[0]!.message).not.toContain('Zero Sham Assertions');
    });

    it('passes tests containing explicit Arrange, Act, Assert markers', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it('executes user operation cleanly', () => {
            // Arrange
            const x = 1;
            // Act
            const y = x + 2;
            // Assert
            expect(y).toBe(3);
            expect(y).not.toBe(0);
          });
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r1 = violations.filter((v) => v.rule === 'R1');
      expect(r1.length).toBe(0);
      expect(r1).toHaveLength(0);
      expect(r1).not.toBeNull();
    });
  });

  describe('Rule R2: Zero Sham Assertions', () => {
    it('detects tautological comparisons and vacuous boundary checks', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it('performs mock assertion', () => {
            // Arrange
            const a = 1;
            // Act
            const b = a;
            // Assert
            expect(true).toBe(true);
            expect(b).toBeGreaterThanOrEqual(0);
            expect(b).not.toBe(-1);
          });
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r2 = violations.filter((v) => v.rule === 'R2');
      expect(r2.length).toBeGreaterThanOrEqual(2);
      expect(r2.some((v) => v.message.includes('Tautological assertion'))).toBe(true);
      expect(r2.some((v) => v.message.includes('Vacuous assertion'))).toBe(true);
      expect(r2.some((v) => v.message.includes('Tautological assertion'))).not.toBe(false);
    });

    it('detects test blocks with zero assertions', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it('executes empty test', () => {
            // Arrange
            const a = 1;
            // Act
            const b = a + 1;
            // Assert
          });
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r2 = violations.filter((v) => v.rule === 'R2');
      expect(r2.length).toBeGreaterThan(0);
      expect(r2[0]!.message).toContain('Sham test detected');
      expect(r2[0]!.message).not.toBe('');
    });
  });

  describe('Rule R3: Declarative Descriptive Naming', () => {
    it('flags test titles containing the non-declarative auxiliary token', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it('should reject invalid credentials', () => {
            // Arrange
            const pass = 'invalid';
            // Act
            const valid = pass === 'valid';
            // Assert
            expect(valid).toBe(false);
          });
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r3 = violations.filter((v) => v.rule === 'R3');
      expect(r3.length).toBe(1);
      expect(r3[0]!.message).toContain('contains "should"');
      expect(r3[0]!.message).not.toContain('Zero Sham');
    });
  });

  describe('Rule R4: Timeout Ceiling and Delay Elimination', () => {
    it('flags real setTimeout delays exceeding 50ms without fake timers', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it('waits for real delay', async () => {
            // Arrange
            const start = 1;
            // Act
            await new Promise((resolve) => setTimeout(resolve, 500));
            // Assert
            expect(start).toBe(1);
            expect(start).not.toBe(0);
          });
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r4 = violations.filter((v) => v.rule === 'R4');
      expect(r4.length).toBe(1);
      expect(r4[0]!.message).toContain('Real sleep delay of 500ms detected');
      expect(r4[0]!.message).not.toBeUndefined();
    });

    it('flags test timeouts exceeding constitutional ceiling of 5000ms', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it('runs long test', async () => {
            // Arrange
            const x = 1;
            // Act
            const y = x * 2;
            // Assert
            expect(y).toBe(2);
            expect(y).not.toBe(1);
          }, 10000);
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r4 = violations.filter((v) => v.rule === 'R4');
      expect(r4.length).toBe(1);
      expect(r4[0]!.message).toContain('exceeds constitutional ceiling of 5000ms');
      expect(r4[0]!.message).not.toBeNull();
    });
  });

  describe('Rule R5: Deterministic Clocks and RNG Guard', () => {
    it('flags unmocked Date.now calls and unseeded Math.random calls', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it('generates random timestamp', () => {
            // Arrange
            const now = Date.now();
            // Act
            const rnd = Math.random();
            // Assert
            expect(now).toBeGreaterThan(0);
            expect(rnd).toBeLessThan(1);
            expect(rnd).not.toBe(0);
          });
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r5 = violations.filter((v) => v.rule === 'R5');
      expect(r5.length).toBeGreaterThanOrEqual(2);
      expect(r5.some((v) => v.message.includes('Unmocked Date.now()'))).toBe(true);
      expect(r5.some((v) => v.message.includes('Unseeded Math.random()'))).toBe(true);
      expect(r5.some((v) => v.message.includes('Unmocked Date.now()'))).not.toBe(false);
    });
  });

  describe('Rule R6: Console Silence Interception', () => {
    it('flags direct console.log or console.error calls lacking active spies', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it('leaks debug log', () => {
            // Arrange
            const x = 10;
            // Act
            console.log('debugging value:', x);
            // Assert
            expect(x).toBe(10);
            expect(x).not.toBe(0);
          });
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r6 = violations.filter((v) => v.rule === 'R6');
      expect(r6.length).toBe(1);
      expect(r6[0]!.message).toContain('Direct console.log call detected');
      expect(r6[0]!.message).not.toBe('');
    });
  });

  describe('Rule R7: Boundary and Negative Contrast Assertions', () => {
    it('flags test suites lacking negative contrast assertions', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it('only tests positive outcome', () => {
            // Arrange
            const x = 1;
            // Act
            const y = x + 1;
            // Assert
            expect(y).toBe(2);
          });
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r7 = violations.filter((v) => v.rule === 'R7');
      expect(r7.length).toBe(1);
      expect(r7[0]!.message).toContain('Test suite lacks negative/boundary contrast assertions');
      expect(r7[0]!.message).not.toBeUndefined();
    });

    it('recognizes toBe(false) and .not. as valid negative assertions', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it('verifies negative status correctly', () => {
            // Arrange
            const isInvalid = false;
            // Act
            const result = isInvalid;
            // Assert
            expect(result).toBe(false);
          });
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r7 = violations.filter((v) => v.rule === 'R7');
      expect(r7.length).toBe(0);
      expect(r7).toHaveLength(0);
      expect(r7).not.toBeNull();
    });
  });

  describe('it.each Support and Edge Cases', () => {
    it('audits parameterized tests created with it.each cleanly', () => {
      // Arrange
      const snippet = `
        describe('suite', () => {
          it.each([
            [1, 2, 3],
            [2, 3, 5],
          ])('should sum values properly', (a, b, expected) => {
            // Arrange
            const sum = a + b;
            // Act
            const diff = sum - expected;
            // Assert
            expect(diff).toBe(0);
            expect(diff).not.toBe(1);
          });
        });
      `;

      // Act
      const violations = auditTestFileAST('sample.spec.ts', snippet);

      // Assert
      const r3 = violations.filter((v) => v.rule === 'R3');
      expect(r3.length).toBe(1);
      expect(r3[0]!.message).toContain('contains "should"');
      expect(r3[0]!.message).not.toBeNull();
    });

    it('returns error when file does not exist', async () => {
      // Arrange
      const nonExistentPath = 'non-existent-test-file-path.spec.ts';

      // Act
      const result = await auditTestFile(nonExistentPath);

      // Assert
      expect(result.ok).toBe(false);
      expect(result.violations.length).toBe(1);
      expect(result.violations[0]!.message).toContain('File not found');
      expect(result.ok).not.toBe(true);
    });
  });
});
