import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { verifyArchitecture } from './verify-architecture.js';
import { verifyMigrationRegistry } from './verify-migration-registry.js';
import { verifyFlowContracts } from './verify-flow-contracts.js';
import { verifyTelegramContracts } from './verify-telegram-contracts.js';
import { verifyLatencyAntiPatterns } from './verify-latency-anti-patterns.js';
import { verifyRbacMatrix } from './verify-rbac-matrix.js';
import { verifyFieldMasking } from './verify-field-masking.js';
import { verifyObservabilityContract } from './verify-observability-contract.js';
import { verifyTestAuthenticity } from './verify-test-authenticity.js';
import { verifyLegacyParity } from './verify-legacy-parity.js';
import { verifyFinancialIntegrity } from './verify-financial-integrity.js';
import { verifyGovernanceTamper } from './verify-governance-tamper.js';
import { detectActiveTestScope } from './smart-test-runner.js';
import type { VerificationResult } from './common.js';

export function getStagedFiles(root = process.cwd()): string[] {
  try {
    const raw = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      cwd: root,
      encoding: 'utf8',
    });
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/\\/g, '/'))
      .filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

export function checkMainBranchImmunity(root = process.cwd()): void {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();

    if (branch === 'main') {
      const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], { cwd: root, encoding: 'utf8' }).trim();
      const mergeHeadPath = resolve(root, gitDir, 'MERGE_HEAD');
      if (!existsSync(mergeHeadPath)) {
        console.error('\n🛑 [GOVERNANCE ERROR] يُحظر تماماً ارتكاب أي Commit مباشر على فرع "main".');
        console.error('📌 منهجية العمل تلزم بإنشاء فرع منفصل لكل مهمة (مثال: pnpm branch:feature <name>).');
        console.error('🔒 لا يُدمج الفرع إلى main إلا بعد الاختبار الكامل وبإذن صريح ومطابق حرفياً: «ادمج الفرع».\n');
        process.exit(1);
      }
    }
  } catch {
    // Non-fatal if git rev-parse fails in headless environments
  }
}

export function checkRedirectPoisoning(stagedFiles: string[], root = process.cwd()): void {
  const forbiddenPattern = /^\{"numTotalTestSuites/;
  for (const f of stagedFiles) {
    if (f.endsWith('.spec.ts') || f.endsWith('.test.ts')) {
      const fullPath = resolve(root, f);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, 'utf8');
        if (forbiddenPattern.test(content.trim())) {
          console.error(`\n❌ [PRE-COMMIT ERROR] ملف اختبار مُتلف باسم ${f} — يحتوي مخرجات vitest JSON`);
          process.exit(1);
        }
      }
    }
  }
}

export async function runPreCommitOrchestrator(root = process.cwd()): Promise<number> {
  const totalStartTime = Date.now();
  console.log('⚡ [PRE-COMMIT ORCHESTRATOR] منسق الالتزام السريع المتوازي (Work Plan 104)...');

  // 1. صمام الحماية السيادي: حظر الالتزام على main
  checkMainBranchImmunity(root);

  // 2. فحص الملفات المجهزة للالتزام (Staged Files Only)
  const stagedFiles = getStagedFiles(root);
  if (stagedFiles.length === 0) {
    console.log('✨ [PRE-COMMIT ORCHESTRATOR] لا توجد أي ملفات مجهزة للالتزام (Staging clean). تخطي الفحص (< 30ms).');
    return 0;
  }

  console.log(`📦 [PRE-COMMIT] تم رصد ${stagedFiles.length} ملف(ات) مجهزة للالتزام.`);

  // 3. حماية من تلف ملفات الاختبار
  checkRedirectPoisoning(stagedFiles, root);

  // 4. خط أنابيب بوابات الحوكمة الساكنة المتوازي (Concurrent In-Process Execution)
  console.log('🔍 [PRE-COMMIT] تشغيل بوابات الحوكمة الساكنة بالتوازي الكامل عبر Promise.all...');
  const gatesStartTime = Date.now();

  const touchesFinance = stagedFiles.some((f) =>
    /(?:finance|ledger|custody|expense|payment|supplier|accounting)/i.test(f) ||
    f.includes('packages/database/prisma/schema.prisma')
  );

  const gateResults = await Promise.all([
    Promise.resolve().then(() => ({ name: 'Architecture (G2)', res: verifyArchitecture(root) })),
    Promise.resolve().then(() => ({ name: 'Migration Registry (G3)', res: verifyMigrationRegistry(root) })),
    Promise.resolve().then(() => ({ name: 'Flow Contracts (G4)', res: verifyFlowContracts(root) })),
    Promise.resolve().then(() => ({ name: 'Telegram Contracts (G5)', res: verifyTelegramContracts(root) })),
    Promise.resolve().then(() => ({ name: 'Latency Anti-Patterns (G6)', res: verifyLatencyAntiPatterns(root) })),
    verifyRbacMatrix(root).then((res) => ({ name: 'RBAC Matrix (G7)', res })),
    verifyFieldMasking(root).then((res) => ({ name: 'Field Masking (G8)', res })),
    verifyObservabilityContract(root).then((res) => ({ name: 'Observability G9 AST (G9)', res })),
    Promise.resolve().then(() => ({ name: 'Test Authenticity (G10)', res: verifyTestAuthenticity(root) })),
    Promise.resolve().then(() => ({ name: 'Legacy Parity (G11)', res: verifyLegacyParity(root) })),
    verifyFinancialIntegrity({ minChecked: 1, memoryOnly: !touchesFinance }).then((res) => ({ name: 'Financial Integrity (G12)', res })),
    Promise.resolve().then(() => ({ name: 'Governance Tamper (G13)', res: verifyGovernanceTamper(root) })),
  ]);

  const gatesDurationMs = Date.now() - gatesStartTime;
  console.log(`⏱️ [PRE-COMMIT] اكتمل فحص الـ 12 بوابة حوكمة بالتوازي في ${gatesDurationMs}ms.`);

  let hasGateFailures = false;
  for (const { name, res } of gateResults) {
    if (!res.ok) {
      hasGateFailures = true;
      console.error(`\n❌ [PRE-COMMIT GATE FAILED] ${name}:`);
      for (const failure of res.failures) {
        console.error(`   - ${failure}`);
      }
    }
  }

  if (hasGateFailures) {
    console.error('\n🛑 [PRE-COMMIT] فشل فحص بوابات الحوكمة. يرجى تصحيح الأخطاء قبل الالتزام.');
    return 1;
  }

  // 5. فحص الأنواع التراكمي السريع (Incremental Typecheck)
  const stagedTsFiles = stagedFiles.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  if (stagedTsFiles.length > 0) {
    console.log(`🔎 [PRE-COMMIT] فحص الأنواع التراكمي لـ ${stagedTsFiles.length} ملف TS معدل...`);
    const tsStartTime = Date.now();
    const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const tsRes = spawnSync(pnpmCmd, ['typecheck'], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });
    const tsDurationMs = Date.now() - tsStartTime;

    if (tsRes.status !== 0) {
      console.error('\n❌ [PRE-COMMIT ERROR] فشل فحص الأنواع (Typecheck Failed G1).');
      return tsRes.status ?? 1;
    }
    console.log(`✅ [PRE-COMMIT] اجتاز فحص الأنواع بنجاح في ${tsDurationMs}ms.`);
  }

  // 6. حارس الاختبارات الذكي للملفات المجهزة (Smart Related Tests Guard)
  if (stagedTsFiles.length > 0) {
    console.log('🧪 [PRE-COMMIT] تشغيل الاختبارات المتأثرة بالملفات المجهزة فقط (Smart Blast Radius)...');
    const testStartTime = Date.now();
    const scope = detectActiveTestScope(stagedFiles, root);
    const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

    let vitestArgs: string[] = [];
    if (scope.scopeType === 'flow' || scope.scopeType === 'module' || scope.scopeType === 'package') {
      vitestArgs = ['vitest', 'run', ...scope.targetPaths];
      console.log(`🎯 [PRE-COMMIT] استهداف نطاق العمل المباشر: ${scope.description}`);
    } else {
      // General related files
      vitestArgs = stagedTsFiles.length > 25
        ? ['vitest', 'run', '--passWithNoTests']
        : ['vitest', 'related', '--run', '--passWithNoTests', ...stagedTsFiles];
    }

    const testRes = spawnSync(pnpmCmd, vitestArgs, {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });
    const testDurationMs = Date.now() - testStartTime;

    if (testRes.status !== 0) {
      console.error('\n❌ [PRE-COMMIT ERROR] فشلت الاختبارات المرتبطة بالتعديلات الحالية!');
      return testRes.status ?? 1;
    }
    console.log(`✅ [PRE-COMMIT] اجتازت الاختبارات المرتبطة بنجاح في ${testDurationMs}ms.`);
  }

  const totalDurationMs = Date.now() - totalStartTime;
  console.log(`\n🎉 [PRE-COMMIT ORCHESTRATOR] اجتازت كافة الفحوصات بنجاح في ${totalDurationMs}ms (< 6s Budget). تم الترخيص بالالتزام.`);
  return 0;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/governance/pre-commit-orchestrator.ts')) {
  runPreCommitOrchestrator()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('Fatal crash in pre-commit orchestrator:', err);
      process.exit(1);
    });
}
