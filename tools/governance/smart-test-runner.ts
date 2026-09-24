import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export interface ScopeDetectionResult {
  scopeType: 'flow' | 'module' | 'package' | 'governance' | 'app' | 'generic' | 'none';
  targetPaths: string[];
  description: string;
}

export function getChangedFiles(root = process.cwd()): string[] {
  try {
    const raw = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const files: string[] = [];

    for (const line of lines) {
      const status = line.slice(0, 2);
      if (status.includes('D')) continue;

      let filePath = line.slice(3).trim();
      if (filePath.includes(' -> ')) {
        filePath = filePath.split(' -> ')[1]?.trim() ?? '';
      }
      filePath = filePath.replace(/^"|"$/g, '').replace(/\\/g, '/');

      if (existsSync(resolve(root, filePath))) {
        files.push(filePath);
      }
    }

    return files;
  } catch {
    return [];
  }
}

export function detectActiveTestScope(changedFiles: string[], root = process.cwd()): ScopeDetectionResult {
  if (changedFiles.length === 0) {
    return {
      scopeType: 'none',
      targetPaths: [],
      description: 'لا توجد أي ملفات معدلة في شجرة العمل الحالية (Working Tree Clean).',
    };
  }

  // 1. Detect if active work is inside a specific bot flow (modules/<name>/src/flows/<slug>/...)
  for (const file of changedFiles) {
    const flowMatch = file.match(/^modules\/([^/]+)\/src\/flows\/([^/]+)\//);
    if (flowMatch && flowMatch[1] && flowMatch[2]) {
      const modName = flowMatch[1];
      const flowSlug = flowMatch[2];

      // 1.1 Check vertical slice internal tests directory: modules/<name>/src/flows/<slug>/tests/
      const sliceTestsDir = join(root, 'modules', modName, 'src', 'flows', flowSlug, 'tests');
      if (existsSync(sliceTestsDir)) {
        return {
          scopeType: 'flow',
          targetPaths: [`modules/${modName}/src/flows/${flowSlug}/tests`],
          description: `تدفق البوت النشط [${modName}/${flowSlug}]`,
        };
      }

      // 1.2 Check modules/<name>/tests/flows/
      const flowTestsDir = join(root, 'modules', modName, 'tests', 'flows');
      if (existsSync(flowTestsDir)) {
        const testFiles = readdirSync(flowTestsDir).filter((f) => f.endsWith('.spec.ts'));
        // Try exact slug or prefix match
        const exact = testFiles.find((f) => f === `${flowSlug}.spec.ts`);
        if (exact) {
          const target = `modules/${modName}/tests/flows/${exact}`;
          return {
            scopeType: 'flow',
            targetPaths: [target],
            description: `تدفق البوت النشط [${modName}/${flowSlug}]`,
          };
        }

        const prefix = flowSlug.split('-')[0];
        if (prefix) {
          const matchPrefix = testFiles.find((f) => f.startsWith(`${prefix}-`) || f.startsWith(`${prefix}.`));
          if (matchPrefix) {
            const target = `modules/${modName}/tests/flows/${matchPrefix}`;
            return {
              scopeType: 'flow',
              targetPaths: [target],
              description: `تدفق البوت النشط [${modName}/${flowSlug}]`,
            };
          }
        }
      }

      // Fallback: run all flow tests for this module
      return {
        scopeType: 'module',
        targetPaths: [`modules/${modName}/tests/flows`],
        description: `أجنحة تدفقات موديول [${modName}]`,
      };
    }
  }

  // 2. Detect if active work is inside a specific module
  for (const file of changedFiles) {
    const modMatch = file.match(/^modules\/([^/]+)\//);
    if (modMatch && modMatch[1]) {
      const modName = modMatch[1];
      const modTests = `modules/${modName}/tests`;
      if (existsSync(join(root, modTests))) {
        return {
          scopeType: 'module',
          targetPaths: [modTests],
          description: `موديول المنظومة [${modName}]`,
        };
      }
    }
  }

  // 3. Detect if active work is inside a package (packages/<name>/...)
  for (const file of changedFiles) {
    const pkgMatch = file.match(/^packages\/([^/]+)\//);
    if (pkgMatch && pkgMatch[1]) {
      const pkgName = pkgMatch[1];
      const pkgTests = `packages/${pkgName}/tests`;
      if (existsSync(join(root, pkgTests))) {
        return {
          scopeType: 'package',
          targetPaths: [pkgTests],
          description: `حزمة النواة المشتركة [@alsaada/${pkgName}]`,
        };
      }
    }
  }

  // 4. Detect if active work is inside tools/governance
  for (const file of changedFiles) {
    if (file.startsWith('tools/governance/')) {
      const govTests = 'tools/governance/tests';
      if (existsSync(join(root, govTests))) {
        return {
          scopeType: 'governance',
          targetPaths: [govTests],
          description: 'أدوات الحوكمة والبوابات الرقابية [tools/governance]',
        };
      }
    }
  }

  // 5. Detect if active work is inside apps
  for (const file of changedFiles) {
    const appMatch = file.match(/^apps\/([^/]+)\//);
    if (appMatch && appMatch[1]) {
      const appName = appMatch[1];
      const appTests = `apps/${appName}/tests`;
      if (existsSync(join(root, appTests))) {
        return {
          scopeType: 'app',
          targetPaths: [appTests],
          description: `تطبيق [${appName}]`,
        };
      }
    }
  }

  // 6. Generic TypeScript files changed
  const tsFiles = changedFiles.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  if (tsFiles.length > 0) {
    return {
      scopeType: 'generic',
      targetPaths: tsFiles,
      description: `${tsFiles.length} ملفات برمجية معدلة (Vitest Related Mode)`,
    };
  }

  return {
    scopeType: 'none',
    targetPaths: [],
    description: 'تعديلات توثيقية أو تهيئة عامة فقط (لا توجد ملفات برمجية معدلة).',
  };
}

export function runSmartTests(argv = process.argv.slice(2), root = process.cwd()): number {
  console.log('⚡ [SMART TEST RUNNER] الفاحص الذكي للاستهداف التلقائي (Work Plan 104)...');

  // If explicit targets provided via CLI
  if (argv.length > 0) {
    console.log(`🎯 [SMART TEST] تشغيل الاختبارات المستهدفة صراحة: ${argv.join(' ')}`);
    const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const res = spawnSync(pnpmCmd, ['vitest', 'run', ...argv], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });
    return res.status ?? 0;
  }

  const changed = getChangedFiles(root);
  const detected = detectActiveTestScope(changed, root);

  console.log(`🔍 [SMART TEST] النطاق المستكشف: ${detected.description}`);

  if (detected.scopeType === 'none' || detected.targetPaths.length === 0) {
    console.log('✨ [SMART TEST] لا توجد اختبارات مستهدفة للتعديلات الحالية. شجرة العمل نظيفة أو التعديل توثيقي (< 50ms).');
    return 0;
  }

  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  let vitestArgs: string[] = [];

  if (detected.scopeType === 'generic') {
    vitestArgs = ['vitest', 'related', '--run', '--passWithNoTests', ...detected.targetPaths];
  } else {
    vitestArgs = ['vitest', 'run', ...detected.targetPaths];
  }

  console.log(`🚀 [SMART TEST] إطلاق Vitest المستهدف: pnpm ${vitestArgs.join(' ')}`);

  const startTime = Date.now();
  const res = spawnSync(pnpmCmd, vitestArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  const durationMs = Date.now() - startTime;

  if (res.status === 0) {
    console.log(`\n✅ [SMART TEST] اجتاز الاختبار المستهدف بنجاح في ${durationMs}ms (استهلاك موارد أدنى).`);
  } else {
    console.error(`\n❌ [SMART TEST] فشل الاختبار المستهدف (Exit Code: ${res.status}).`);
  }

  return res.status ?? 1;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/governance/smart-test-runner.ts')) {
  const code = runSmartTests();
  process.exit(code);
}
