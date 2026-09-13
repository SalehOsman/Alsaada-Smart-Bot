import { join, resolve } from 'node:path';
import { createResult, fail, listFilesRecursive, readUtf8 } from './common.js';
import { CANONICAL_ROLES, canAccessDashboard, isCanonicalRole, evaluateAccess } from '../../packages/rbac/src/index.js';

export async function verifyRbacMatrix(repoRoot: string) {
  const result = createResult();
  const DEPRECATED_ROLES = ['EXECUTIVE', 'EXECUTIVE_DIRECTOR', 'ACCOUNTANT', 'PROJECT_MANAGER', 'SITE_ENGINEER'];

  // 1. Verify that exactly 7 canonical roles exist in the SSOT
  result.checked++;
  if (CANONICAL_ROLES.length !== 7) {
    fail(result, `Expected exactly 7 canonical roles, but found ${CANONICAL_ROLES.length}`);
  }

  // 2. Verify dashboard entrance permissions
  result.checked++;
  for (const role of CANONICAL_ROLES) {
    const allowed = canAccessDashboard(role);
    if (['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(role)) {
      if (!allowed) fail(result, `Canonical role ${role} should be allowed dashboard access.`);
    } else {
      if (allowed) fail(result, `Canonical role ${role} should NOT be allowed dashboard access.`);
    }
  }

  // 3. Verify DENY_BY_DEFAULT for unknown/deprecated roles
  result.checked++;
  for (const dep of DEPRECATED_ROLES) {
    if (canAccessDashboard(dep as any)) {
      fail(result, `Deprecated role ${dep} was granted dashboard access!`);
    }
    const evalResult = evaluateAccess({
      role: dep as any,
      permissionKey: 'workforce.worker.view',
      channel: 'DASHBOARD',
    });
    if (evalResult.granted) {
      fail(result, `Deprecated role ${dep} was granted access by evaluator!`);
    }
  }

  // 4. Scan production code in apps/admin-dashboard/src and apps/bot-server/src for deprecated roles
  const appPaths = [
    resolve(repoRoot, 'apps/admin-dashboard/src'),
    resolve(repoRoot, 'apps/bot-server/src'),
    resolve(repoRoot, 'packages/rbac/src'),
  ];

  for (const dir of appPaths) {
    const files = listFilesRecursive(dir);
    for (const f of files) {
      if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue;
      // Skip test files, migration files, or roles.ts (which defines DEPRECATED_ROLES for validation)
      if (
        f.includes('.spec.') ||
        f.includes('.test.') ||
        f.includes('migration') ||
        f.endsWith('roles.ts')
      ) {
        continue;
      }

      result.checked++;
      const content = readUtf8(f);

      // Check if file uses deprecated role as an active permitted role
      for (const dep of DEPRECATED_ROLES) {
        // Regex checking for role in array or string literals like 'ACCOUNTANT' or "ACCOUNTANT"
        const regex = new RegExp(`['"]${dep}['"]`, 'g');
        if (regex.test(content)) {
          fail(result, `File ${f} contains reference to deprecated role: ${dep}`);
        }
      }
    }
  }

  return result;
}

if (process.argv[1]?.includes('verify-rbac-matrix')) {
  const repoRoot = resolve(process.cwd());
  verifyRbacMatrix(repoRoot)
    .then((res) => {
      console.log(`\n🛡️ [RBAC Matrix Verifier] Checked ${res.checked} rules/files.`);
      if (!res.ok) {
        console.error('❌ Failures found:');
        for (const f of res.failures) {
          console.error(`  - ${f}`);
        }
        process.exit(1);
      }
      console.log('✅ RBAC Matrix & Canonical Roles verified 100% compliant.\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Crash in verify-rbac-matrix:', err);
      process.exit(1);
    });
}
