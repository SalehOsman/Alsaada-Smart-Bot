import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createResult, isCliEntrypoint, listFilesRecursive, printAndExit, toRepoPath, type VerificationResult } from './common.js';

export const APPROVAL_PHRASE = 'موافق على التعديل او الايقاف او الحذف';
export const GOVERNANCE_LOCK_PATH = 'governance.lock.json';

export interface GovernanceLockFileEntry {
  path: string;
  sha256: string;
}

export interface GovernanceLock {
  schemaVersion: 1;
  generatedAt: string;
  approvalPhrase: string;
  protectedPaths: {
    files: string[];
    directories: string[];
  };
  files: GovernanceLockFileEntry[];
}

export const PROTECTED_GOVERNANCE_FILES = [
  'AGENTS.md',
  'GEMINI.md',
  'package.json',
  'pnpm-workspace.yaml',
  '.gitignore',
  'docs/14-ai-agent-governance-and-file-rules.md',
  'docs/15-universal-module-and-flow-standard.md',
  'docs/21-mandatory-module-architecture-and-gates.md',
  'docs/ai-execution-evidence/README.md',
] as const;

export const PROTECTED_GOVERNANCE_DIRECTORIES = ['tools/governance', '.github/workflows'] as const;

const GOVERNANCE_FILE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml']);

function normalized(path: string): string {
  return path.replace(/\\/g, '/');
}

function hasGovernanceExtension(path: string): boolean {
  const normalizedPath = normalized(path).toLowerCase();
  for (const extension of GOVERNANCE_FILE_EXTENSIONS) {
    if (normalizedPath.endsWith(extension)) return true;
  }
  return false;
}

function isExcluded(repoPath: string): boolean {
  if (repoPath === GOVERNANCE_LOCK_PATH) return true;
  if (repoPath.startsWith('docs/ai-execution-evidence/') && repoPath !== 'docs/ai-execution-evidence/README.md') return true;
  return false;
}

export function listProtectedGovernanceFiles(root = process.cwd()): string[] {
  const files = new Set<string>();

  for (const file of PROTECTED_GOVERNANCE_FILES) {
    const fullPath = join(root, file);
    if (existsSync(fullPath) && !isExcluded(file)) files.add(file);
  }

  for (const directory of PROTECTED_GOVERNANCE_DIRECTORIES) {
    const fullDirectory = join(root, directory);
    if (!existsSync(fullDirectory)) continue;
    for (const file of listFilesRecursive(fullDirectory)) {
      const repoPath = normalized(toRepoPath(root, file));
      if (isExcluded(repoPath)) continue;
      if (!hasGovernanceExtension(repoPath)) continue;
      files.add(repoPath);
    }
  }

  return [...files].sort((left, right) => left.localeCompare(right));
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function buildGovernanceLock(root = process.cwd(), generatedAt = new Date().toISOString()): GovernanceLock {
  const protectedFiles = listProtectedGovernanceFiles(root);
  return {
    schemaVersion: 1,
    generatedAt,
    approvalPhrase: APPROVAL_PHRASE,
    protectedPaths: {
      files: [...PROTECTED_GOVERNANCE_FILES],
      directories: [...PROTECTED_GOVERNANCE_DIRECTORIES],
    },
    files: protectedFiles.map((file) => ({ path: file, sha256: sha256File(join(root, file)) })),
  };
}

export function writeGovernanceLock(root = process.cwd(), generatedAt = new Date().toISOString()): GovernanceLock {
  const lock = buildGovernanceLock(root, generatedAt);
  const outputPath = join(root, GOVERNANCE_LOCK_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return lock;
}

export function verifyGovernanceLock(root = process.cwd()): VerificationResult {
  const result = createResult();
  const lock = buildGovernanceLock(root);
  result.checked = lock.files.length;
  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  if (process.argv.includes('--write')) {
    const lock = writeGovernanceLock(process.cwd());
    console.log(`governance:lock: PASS`);
    console.log(`Protected files: ${lock.files.length}`);
    console.log(`Output: ${GOVERNANCE_LOCK_PATH}`);
  } else {
    printAndExit('governance:lock', verifyGovernanceLock(process.cwd()));
  }
}
