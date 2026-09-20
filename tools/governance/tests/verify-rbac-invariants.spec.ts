import { describe, it, expect } from 'vitest';
import {
  checkEvaluatorTraces,
  checkForbiddenSiteFallbacks,
  checkMatrixSovereignProtection,
  checkWorkerSiteScoping,
  verifyRbacInvariants,
} from '../verify-rbac-invariants.js';

describe('Gate 23: RBAC Decision Trace & Boundary Invariants Gate — Unit Tests', () => {
  it('passes evaluator content containing required trace checkpoints', () => {
    const validContent = `
      trace.push('SITE_BOUNDARY_CHECKED');
      trace.push('SOVEREIGN_KEYS_CHECKED');
      return { granted: true, decisionTrace: Object.freeze([...trace]) };
    `;
    const violations = checkEvaluatorTraces(validContent);
    expect(violations.length).toBe(0);
  });

  it('detects missing SITE_BOUNDARY_CHECKED in evaluator', () => {
    const invalidContent = `
      trace.push('SOVEREIGN_KEYS_CHECKED');
      return { granted: true, decisionTrace: Object.freeze([...trace]) };
    `;
    const violations = checkEvaluatorTraces(invalidContent);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]).toContain("missing 'SITE_BOUNDARY_CHECKED'");
  });

  it('detects inverted order where SOVEREIGN_KEYS precedes SITE_BOUNDARY', () => {
    const invalidContent = `
      trace.push('SOVEREIGN_KEYS_CHECKED');
      trace.push('SITE_BOUNDARY_CHECKED');
      return { granted: true, decisionTrace: Object.freeze([...trace]) };
    `;
    const violations = checkEvaluatorTraces(invalidContent);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => v.includes('does not check SITE_BOUNDARY before SOVEREIGN_KEYS'))).toBe(true);
  });

  it('detects banned fallback resolveDefaultFieldAdminSiteId', () => {
    const code = `
      const siteId = await resolveDefaultFieldAdminSiteId();
    `;
    const violations = checkForbiddenSiteFallbacks('apps/bot-server/src/middlewares/auth.middleware.ts', code);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('resolveDefaultFieldAdminSiteId');
  });

  it('detects missing SOVEREIGN_SUPER_ADMIN_KEYS protection in matrix route', () => {
    const badMatrix = `
      export async function POST(req: Request) {
        // missing sovereign super admin protection
      }
    `;
    const violations = checkMatrixSovereignProtection(badMatrix);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('SOVEREIGN_SUPER_ADMIN_KEYS');
  });

  it('detects missing assignedSiteId boundary in workers route', () => {
    const badWorkers = `
      export async function POST(req: Request) {
        // no field admin site check
      }
    `;
    const violations = checkWorkerSiteScoping(badWorkers);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('assignedSiteId');
  });

  it('passes on whole repository', () => {
    const res = verifyRbacInvariants(process.cwd());
    expect(res.ok).toBe(true);
    expect(res.failures).toEqual([]);
    expect(res.checked).toBeGreaterThan(30);
  });
});
