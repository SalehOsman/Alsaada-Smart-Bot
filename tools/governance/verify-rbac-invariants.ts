import { resolve } from 'node:path';
import ts from 'typescript';
import {
  createResult,
  fail,
  isCliEntrypoint,
  listFilesRecursive,
  printAndExit,
  readUtf8,
  toRepoPath,
  type VerificationResult,
} from './common.js';

export interface RbacInvariantViolation {
  file: string;
  rule: string;
  message: string;
}

export function checkEvaluatorTraces(evaluatorContent: string): string[] {
  const violations: string[] = [];

  // Check decision trace points exist in evaluator
  if (!evaluatorContent.includes("'SITE_BOUNDARY_CHECKED'")) {
    violations.push("evaluator.ts is missing 'SITE_BOUNDARY_CHECKED' trace checkpoint.");
  }
  if (!evaluatorContent.includes("'SOVEREIGN_KEYS_CHECKED'")) {
    violations.push("evaluator.ts is missing 'SOVEREIGN_KEYS_CHECKED' trace checkpoint.");
  }
  if (!evaluatorContent.includes('decisionTrace:')) {
    violations.push('evaluator.ts does not attach decisionTrace to AccessDecision results.');
  }

  // Ensure SITE_BOUNDARY_CHECKED appears before SOVEREIGN_KEYS_CHECKED
  const siteIdx = evaluatorContent.indexOf("'SITE_BOUNDARY_CHECKED'");
  const sovereignIdx = evaluatorContent.indexOf("'SOVEREIGN_KEYS_CHECKED'");
  if (siteIdx > -1 && sovereignIdx > -1 && siteIdx > sovereignIdx) {
    violations.push('evaluator.ts does not check SITE_BOUNDARY before SOVEREIGN_KEYS.');
  }

  return violations;
}

export function checkForbiddenSiteFallbacks(filePath: string, content: string): string[] {
  const violations: string[] = [];
  if (content.includes('resolveDefaultFieldAdminSiteId')) {
    violations.push(
      `[Gate 23 Violation] ${filePath} contains banned 'resolveDefaultFieldAdminSiteId'. Automatic fallback site resolution for FIELD_ADMIN is strictly prohibited (Fail-Closed).`
    );
  }
  return violations;
}

export function checkMatrixSovereignProtection(matrixContent: string): string[] {
  const violations: string[] = [];
  if (!matrixContent.includes('SOVEREIGN_SUPER_ADMIN_KEYS')) {
    violations.push(
      'apps/admin-dashboard/src/app/api/permissions/matrix/route.ts must protect SOVEREIGN_SUPER_ADMIN_KEYS from non-SUPER_ADMIN alteration.'
    );
  }
  return violations;
}

export function checkWorkerSiteScoping(workersRouteContent: string): string[] {
  const violations: string[] = [];
  if (
    !workersRouteContent.includes("user.role === 'FIELD_ADMIN'") ||
    !workersRouteContent.includes('assignedSiteId')
  ) {
    violations.push(
      'apps/admin-dashboard/src/app/api/workers/route.ts must enforce assignedSiteId boundary for FIELD_ADMIN.'
    );
  }
  return violations;
}

export function verifyRbacInvariants(root = process.cwd()): VerificationResult {
  const result = createResult();
  const repoRoot = resolve(root);

  // 1. Check evaluator.ts in @alsaada/rbac
  const evaluatorPath = resolve(repoRoot, 'packages/rbac/src/evaluator.ts');
  result.checked++;
  try {
    const evaluatorContent = readUtf8(evaluatorPath);
    const traceViolations = checkEvaluatorTraces(evaluatorContent);
    for (const v of traceViolations) {
      fail(result, `[Gate 23: RBAC Invariant] ${toRepoPath(repoRoot, evaluatorPath)}: ${v}`);
    }
  } catch (err) {
    fail(result, `[Gate 23: RBAC Invariant] Could not read ${evaluatorPath}: ${err}`);
  }

  // 2. Check matrix route sovereign protection
  const matrixPath = resolve(repoRoot, 'apps/admin-dashboard/src/app/api/permissions/matrix/route.ts');
  result.checked++;
  try {
    const matrixContent = readUtf8(matrixPath);
    const matrixViolations = checkMatrixSovereignProtection(matrixContent);
    for (const v of matrixViolations) {
      fail(result, `[Gate 23: RBAC Invariant] ${toRepoPath(repoRoot, matrixPath)}: ${v}`);
    }
  } catch (err) {
    fail(result, `[Gate 23: RBAC Invariant] Could not read ${matrixPath}: ${err}`);
  }

  // 3. Check workers POST route site boundary
  const workersPath = resolve(repoRoot, 'apps/admin-dashboard/src/app/api/workers/route.ts');
  result.checked++;
  try {
    const workersContent = readUtf8(workersPath);
    const workerViolations = checkWorkerSiteScoping(workersContent);
    for (const v of workerViolations) {
      fail(result, `[Gate 23: RBAC Invariant] ${toRepoPath(repoRoot, workersPath)}: ${v}`);
    }
  } catch (err) {
    fail(result, `[Gate 23: RBAC Invariant] Could not read ${workersPath}: ${err}`);
  }

  // 4. Scan apps and modules for banned fallbacks
  const targetDirs = [resolve(repoRoot, 'apps'), resolve(repoRoot, 'modules')];
  for (const dir of targetDirs) {
    const files = listFilesRecursive(dir);
    for (const f of files) {
      if (
        (f.endsWith('.ts') || f.endsWith('.tsx')) &&
        !f.includes('node_modules') &&
        !f.includes('dist') &&
        !f.includes('.next') &&
        !f.includes('.turbo')
      ) {
        result.checked++;
        const content = readUtf8(f);
        const fbViolations = checkForbiddenSiteFallbacks(f, content);
        for (const v of fbViolations) {
          fail(result, v);
        }
      }
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  const result = verifyRbacInvariants(process.cwd());
  printAndExit('Gate 23: RBAC Decision Trace & Boundary Invariants Gate', result);
}
