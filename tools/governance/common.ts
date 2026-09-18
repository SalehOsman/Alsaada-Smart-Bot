import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export interface VerificationResult {
  ok: boolean;
  failures: string[];
  warnings: string[];
  checked: number;
}

export function createResult(): VerificationResult {
  return { ok: true, failures: [], warnings: [], checked: 0 };
}

export function fail(result: VerificationResult, message: string): void {
  result.ok = false;
  result.failures.push(message);
}

export function warn(result: VerificationResult, message: string): void {
  result.warnings.push(message);
}

export function pathExists(path: string): boolean {
  return existsSync(path);
}

export function readUtf8(path: string): string {
  return readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
}

export function fileIsNonEmpty(path: string): boolean {
  return existsSync(path) && statSync(path).isFile() && statSync(path).size > 0;
}

export function listFilesRecursive(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        visit(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  };
  visit(root);
  return files;
}

export function listFlowDirs(root: string): string[] {
  const modulesRoot = join(root, 'modules');
  if (!existsSync(modulesRoot)) return [];
  const flowDirs: string[] = [];
  for (const moduleEntry of readdirSync(modulesRoot, { withFileTypes: true })) {
    if (!moduleEntry.isDirectory()) continue;
    const flowsRoot = join(modulesRoot, moduleEntry.name, 'src', 'flows');
    if (!existsSync(flowsRoot)) continue;
    for (const flowEntry of readdirSync(flowsRoot, { withFileTypes: true })) {
      if (flowEntry.isDirectory()) flowDirs.push(join(flowsRoot, flowEntry.name));
    }
  }
  return flowDirs;
}

export function normalized(path: string): string {
  return path.replace(/\\/g, '/');
}

export function toRepoPath(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}

export function countLines(path: string): number {
  if (!existsSync(path)) return 0;
  const text = readUtf8(path);
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

export function isCliEntrypoint(metaUrl: string): boolean {
  if (!process.argv[1]) return false;
  return fileURLToPath(metaUrl).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/');
}

export function printAndExit(name: string, result: VerificationResult): void {
  const status = result.ok ? 'PASS' : 'FAIL';
  console.log(`${name}: ${status}`);
  console.log(`Checked: ${result.checked}`);
  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const message of result.warnings) console.log(`- ${message}`);
  }
  if (result.failures.length > 0) {
    console.log('\nFailures:');
    for (const message of result.failures) console.log(`- ${message}`);
  }
  process.exit(result.ok ? 0 : 1);
}

export function gitStatusShort(root: string): string {
  try {
    return execFileSync('git', ['status', '--short'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    return `git status failed: ${String(error)}`;
  }
}

