import { resolve } from 'node:path';
import { createResult, fail, listFilesRecursive, readUtf8 } from './common.js';
import {
  CONTRACTUAL_COMPENSATION_FIELDS,
  isFieldMasked,
  projectSafeWorkerFields,
} from '../../packages/rbac/src/index.js';

export async function verifyFieldMasking(repoRoot: string) {
  const result = createResult();

  // 1. Verify that all contractual compensation fields are masked for FIELD_ADMIN
  result.checked++;
  for (const field of CONTRACTUAL_COMPENSATION_FIELDS) {
    result.checked++;
    const masked = isFieldMasked('FIELD_ADMIN', 'workforce.compensation.view', field);
    if (!masked) {
      fail(result, `Compensation field '${field}' is NOT masked for FIELD_ADMIN!`);
    }

    const unmaskedForSuper = isFieldMasked('SUPER_ADMIN', 'workforce.compensation.view', field);
    if (unmaskedForSuper) {
      fail(result, `Compensation field '${field}' should NOT be masked for SUPER_ADMIN!`);
    }
  }

  // 2. Verify projectSafeWorkerFields behavior with sample record
  result.checked++;
  const testWorker = {
    id: 'test-1',
    code: 'WRK-01',
    name: 'اختبار',
    nickname: 'أبو علي',
    basicSalary: 8000,
    dailyWage: 300,
    fixedAllowances: 1000,
    totalCompensation: 9000,
    totalMonthlySalary: 9000,
    phone: '01000000000',
  };

  const safeForFieldAdmin = projectSafeWorkerFields(testWorker, 'FIELD_ADMIN');
  for (const field of ['basicSalary', 'dailyWage', 'fixedAllowances', 'totalCompensation', 'totalMonthlySalary']) {
    result.checked++;
    if ((safeForFieldAdmin as any)[field] !== undefined) {
      fail(result, `projectSafeWorkerFields leaked '${field}' for FIELD_ADMIN!`);
    }
  }

  // 3. Scan export routes to ensure canViewFinances guards compensation columns
  const exportRoutePath = resolve(repoRoot, 'apps/admin-dashboard/src/app/api/export/excel/route.ts');
  result.checked++;
  const exportContent = readUtf8(exportRoutePath);
  if (!exportContent.includes('canViewFinances')) {
    fail(result, 'Excel export route does not check canViewFinances before adding salary columns!');
  }

  const pdfRoutePath = resolve(repoRoot, 'apps/admin-dashboard/src/app/api/export/pdf/route.ts');
  result.checked++;
  const pdfContent = readUtf8(pdfRoutePath);
  if (!pdfContent.includes('canViewFinances')) {
    fail(result, 'PDF export route does not check canViewFinances before adding salary columns!');
  }

  return result;
}

if (process.argv[1]?.includes('verify-field-masking')) {
  const repoRoot = resolve(process.cwd());
  verifyFieldMasking(repoRoot)
    .then((res) => {
      console.log(`\n🔒 [Field Masking Verifier] Checked ${res.checked} rules.`);
      if (!res.ok) {
        console.error('❌ Failures found:');
        for (const f of res.failures) {
          console.error(`  - ${f}`);
        }
        process.exit(1);
      }
      console.log('✅ Field Masking & Strict Compensation Privacy verified 100% compliant.\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Crash in verify-field-masking:', err);
      process.exit(1);
    });
}
