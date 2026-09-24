import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createResult,
  countLines,
  fail,
  fileIsNonEmpty,
  isCliEntrypoint,
  listFilesRecursive,
  listFlowDirs,
  readUtf8,
  toRepoPath,
  type VerificationResult,
} from './common.js';
import { validateMermaidStateDiagram } from './verify-architecture.js';

const REQUIRED_FLOW_FILES = [
  'flow.contract.json',
  'flow.handler.ts',
  'flow.keyboard.ts',
  'flow.service.ts',
  'flow.repository.ts',
  'flow.types.ts',
  'flow.validators.ts',
  'flow.messages.ts',
  'flow.telemetry.ts',
  'flow.docs.md',
  'tests/flow.unit.spec.ts',
  'tests/flow.integration.spec.ts',
  'tests/flow.ux.spec.ts',
  'tests/flow.rbac.spec.ts',
  'tests/flow.data.spec.ts',
] as const;

export interface FastFlowOptions {
  flowPath?: string | undefined;
  skipTests?: boolean | undefined;
  root?: string | undefined;
}

export function resolveTargetFlowDir(root: string, target?: string | undefined): string | null {
  if (target) {
    const directPath = resolve(root, target);
    if (existsSync(directPath) && existsSync(join(directPath, 'flow.contract.json'))) {
      return directPath;
    }

    // Try finding by flow key or slug prefix
    const allDirs = listFlowDirs(root);
    const matched = allDirs.find((dir) => {
      const folder = dir.replace(/\\/g, '/').split('/').pop() ?? '';
      return folder.toLowerCase().includes(target.toLowerCase());
    });
    if (matched) return matched;
  }

  // Detect from git status
  try {
    const gitOut = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' });
    const lines = gitOut.split(/\r?\n/);
    for (const line of lines) {
      const filePath = line.slice(3).trim().replace(/\\/g, '/');
      if (filePath.startsWith('modules/')) {
        const parts = filePath.split('/');
        const flowsIndex = parts.indexOf('flows');
        if (flowsIndex !== -1 && parts[flowsIndex + 1]) {
          const detected = join(root, ...parts.slice(0, flowsIndex + 2));
          if (existsSync(join(detected, 'flow.contract.json'))) {
            return detected;
          }
        }
      }
    }
  } catch {
    // ignore git error
  }

  return null;
}

export function verifyFlowFast(options: FastFlowOptions = {}): VerificationResult {
  const root = options.root ?? process.cwd();
  const result = createResult();

  const targetDir = resolveTargetFlowDir(root, options.flowPath);
  if (!targetDir) {
    fail(
      result,
      options.flowPath
        ? `Could not find flow directory matching: ${options.flowPath}`
        : 'No target flow specified and no changed flow detected in git status.'
    );
    return result;
  }

  const repoFlowPath = toRepoPath(root, targetDir);
  result.checked += 1;

  // 1. Check all required 15 files
  for (const file of REQUIRED_FLOW_FILES) {
    result.checked += 1;
    const fullPath = join(targetDir, file);
    if (!fileIsNonEmpty(fullPath)) {
      fail(result, `${repoFlowPath} is missing required file: ${file}`);
    }
  }

  // 1.1 Check mandatory Mermaid state diagram in flow.docs.md / walkthrough.md
  const docsPath = existsSync(join(targetDir, 'flow.docs.md'))
    ? join(targetDir, 'flow.docs.md')
    : existsSync(join(targetDir, 'walkthrough.md'))
      ? join(targetDir, 'walkthrough.md')
      : null;
  if (docsPath) {
    const docErrors = validateMermaidStateDiagram(toRepoPath(root, docsPath), readUtf8(docsPath));
    for (const err of docErrors) {
      fail(result, err);
    }
  }

  // 2. Line counts
  const handlerPath = join(targetDir, 'flow.handler.ts');
  if (existsSync(handlerPath)) {
    const lines = countLines(handlerPath);
    if (lines > 350) {
      fail(result, `${repoFlowPath}/flow.handler.ts exceeds 350 lines (${lines})`);
    }
  }

  const servicePath = join(targetDir, 'flow.service.ts');
  if (existsSync(servicePath)) {
    const lines = countLines(servicePath);
    if (lines > 500) {
      fail(result, `${repoFlowPath}/flow.service.ts exceeds 500 lines (${lines})`);
    }
  }

  // 3. Check any prohibition in TS files
  let contractAllowAny = false;
  const contractPath = join(targetDir, 'flow.contract.json');
  if (existsSync(contractPath)) {
    try {
      const contract = JSON.parse(readUtf8(contractPath)) as { allowAny?: boolean };
      contractAllowAny = Boolean(contract.allowAny);
    } catch (error) {
      fail(result, `${repoFlowPath}/flow.contract.json is invalid JSON: ${String(error)}`);
    }
  }

  const flowTsFiles = listFilesRecursive(targetDir).filter((file) => file.endsWith('.ts'));
  for (const file of flowTsFiles) {
    result.checked += 1;
    const content = readUtf8(file);
    if (!contractAllowAny && /\bany\b/.test(content)) {
      fail(result, `${toRepoPath(root, file)} contains forbidden 'any' type`);
    }
  }

  // 4. Run tests for this flow only
  if (!options.skipTests) {
    const testsDir = join(targetDir, 'tests');
    if (existsSync(testsDir)) {
      try {
        result.checked += 1;
        const relativeTestsDir = toRepoPath(root, testsDir);
        execFileSync(
          process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
          ['vitest', 'run', relativeTestsDir],
          { cwd: root, stdio: 'pipe', encoding: 'utf8', shell: true }
        );
      } catch (error) {
        const stderr = typeof error === 'object' && error && 'stderr' in error ? String(error.stderr) : '';
        const stdout = typeof error === 'object' && error && 'stdout' in error ? String(error.stdout) : '';
        fail(result, `Tests failed for ${repoFlowPath}:\n${stderr || stdout || String(error)}`);
      }
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  const targetArg = process.argv[2];
  const startTime = Date.now();
  console.log(`🔍 [FLOW:CHECK] Starting targeted verification for: ${targetArg ?? 'Auto-detecting changed flow'}...`);
  const res = verifyFlowFast({ flowPath: targetArg });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (res.ok) {
    console.log(`\n⚡ [FLOW:CHECK] PASS in ${duration}s! All architectural, contract, and test checks passed.`);
    console.log(`Checked: ${res.checked} items`);
    process.exit(0);
  } else {
    console.error(`\n❌ [FLOW:CHECK] FAIL in ${duration}s!`);
    for (const f of res.failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}
