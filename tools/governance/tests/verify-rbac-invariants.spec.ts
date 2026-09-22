import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkEvaluatorTraces,
  checkForbiddenSiteFallbacks,
  checkMatrixSovereignProtection,
  checkWorkerSiteScoping,
  verifyRbacInvariants,
} from '../verify-rbac-invariants.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Gate 23: RBAC Decision Trace & Boundary Invariants Gate — Unit Tests', () => {
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

  it('passes evaluator content containing required trace checkpoints', () => {
    // Arrange
    const validContent = `
      trace.push('SITE_BOUNDARY_CHECKED');
      trace.push('SOVEREIGN_KEYS_CHECKED');
      return { granted: true, decisionTrace: Object.freeze([...trace]) };
    `;

    // Act
    const violations = checkEvaluatorTraces(validContent);

    // Assert
    expect(violations).toHaveLength(0);
    expect(violations).not.toContain("missing 'SITE_BOUNDARY_CHECKED'");
  });

  it('detects missing SITE_BOUNDARY_CHECKED in evaluator', () => {
    // Arrange
    const invalidContent = `
      trace.push('SOVEREIGN_KEYS_CHECKED');
      return { granted: true, decisionTrace: Object.freeze([...trace]) };
    `;

    // Act
    const violations = checkEvaluatorTraces(invalidContent);

    // Assert
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("missing 'SITE_BOUNDARY_CHECKED'");
    expect(violations[0]).not.toContain("missing 'SOVEREIGN_KEYS_CHECKED'");
  });

  it('detects inverted order where SOVEREIGN_KEYS precedes SITE_BOUNDARY', () => {
    // Arrange
    const invalidContent = `
      trace.push('SOVEREIGN_KEYS_CHECKED');
      trace.push('SITE_BOUNDARY_CHECKED');
      return { granted: true, decisionTrace: Object.freeze([...trace]) };
    `;

    // Act
    const violations = checkEvaluatorTraces(invalidContent);

    // Assert
    expect(violations.length).toBe(1);
    expect(violations.some((v) => v.includes('does not check SITE_BOUNDARY before SOVEREIGN_KEYS'))).toBe(true);
    expect(violations[0]).not.toContain("missing 'SITE_BOUNDARY_CHECKED'");
  });

  it('detects banned fallback resolveDefaultFieldAdminSiteId', () => {
    // Arrange
    const code = `
      const siteId = await resolveDefaultFieldAdminSiteId();
    `;
    const targetPath = 'apps/bot-server/src/middlewares/auth.middleware.ts';

    // Act
    const violations = checkForbiddenSiteFallbacks(targetPath, code);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('resolveDefaultFieldAdminSiteId');
    expect(violations[0]).not.toContain('SITE_BOUNDARY_CHECKED');
  });

  it('detects missing SOVEREIGN_SUPER_ADMIN_KEYS protection in matrix route', () => {
    // Arrange
    const badMatrix = `
      export async function POST(req: Request) {
        // missing sovereign super admin protection
      }
    `;

    // Act
    const violations = checkMatrixSovereignProtection(badMatrix);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('SOVEREIGN_SUPER_ADMIN_KEYS');
    expect(violations[0]).not.toContain('SITE_BOUNDARY_CHECKED');
  });

  it('detects missing assignedSiteId boundary in workers route', () => {
    // Arrange
    const badWorkers = `
      export async function POST(req: Request) {
        // no field admin site check
      }
    `;

    // Act
    const violations = checkWorkerSiteScoping(badWorkers);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('assignedSiteId');
    expect(violations[0]).not.toContain('SOVEREIGN_SUPER_ADMIN_KEYS');
  });

  it('passes on whole repository', () => {
    // Arrange
    const cwd = process.cwd();

    // Act
    const res = verifyRbacInvariants(cwd);

    // Assert
    expect(res.ok).toBe(true);
    expect(res.failures).toHaveLength(0);
    expect(res.checked).toBeGreaterThan(30);
  });
});
