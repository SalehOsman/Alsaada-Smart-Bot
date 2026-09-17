import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function parsePorcelainStatus(raw: string, repoRoot: string): string[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const tsFiles: string[] = [];

  for (const line of lines) {
    const status = line.slice(0, 2);
    if (status.includes('D')) continue;

    let filePath = line.slice(3).trim();
    if (filePath.includes(' -> ')) {
      filePath = filePath.split(' -> ')[1]?.trim() ?? '';
    }
    filePath = filePath.replace(/^"|"$/g, '');

    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      continue;
    }

    const fullPath = resolve(repoRoot, filePath);
    if (existsSync(fullPath)) {
      tsFiles.push(filePath);
    }
  }

  return tsFiles;
}

export function getChangedTsFiles(repoRoot: string): string[] {
  try {
    const raw = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
    return parsePorcelainStatus(raw, repoRoot);
  } catch (err) {
    console.error('Failed to get git status:', err);
    return [];
  }
}

export function runPreCommitTestGuard(repoRoot = process.cwd()): number {
  console.log('⚡ [PRE-COMMIT GUARD] Inspecting changed files...');
  const tsFiles = getChangedTsFiles(repoRoot);

  if (tsFiles.length === 0) {
    console.log('🚀 [PRE-COMMIT GUARD] No TypeScript code changes detected (docs/config only). Skipping test suite (< 1s).');
    return 0;
  }

  console.log(`🧪 [PRE-COMMIT GUARD] Detected ${tsFiles.length} changed TypeScript file(s). Running related vitest suite...`);

  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  // If many files changed (> 25), Windows cmd line limit (8191 chars) would be exceeded; run full suite instead
  const args = tsFiles.length > 25
    ? ['vitest', 'run', '--passWithNoTests']
    : ['vitest', 'related', '--passWithNoTests', '--run', ...tsFiles];

  const res = spawnSync(pnpmCmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  });

  if (res.status !== 0) {
    console.error('❌ [PRE-COMMIT GUARD] Related tests failed for changed TypeScript files!');
    return res.status ?? 1;
  }

  console.log('✅ [PRE-COMMIT GUARD] All related tests passed successfully.');
  return 0;
}

if (process.argv[1]?.includes('pre-commit-test-guard')) {
  const code = runPreCommitTestGuard();
  process.exit(code);
}
