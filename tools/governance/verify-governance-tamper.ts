import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createResult, fail, isCliEntrypoint, listFilesRecursive, printAndExit, readUtf8, warn, type VerificationResult } from './common.js';
import { APPROVAL_PHRASE, GOVERNANCE_LOCK_PATH, PROTECTED_GOVERNANCE_DIRECTORIES, PROTECTED_GOVERNANCE_FILES, listProtectedGovernanceFiles, sha256File, type GovernanceLock } from './verify-governance-lock.js';

function parseLock(text: string): GovernanceLock | null {
  try {
    const parsed = JSON.parse(text) as Partial<GovernanceLock>;
    if (parsed.schemaVersion !== 1) return null;
    if (parsed.approvalPhrase !== APPROVAL_PHRASE) return null;
    if (!Array.isArray(parsed.files)) return null;
    return parsed as GovernanceLock;
  } catch {
    return null;
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/$/, '');
}

function gitStatusPaths(root: string): string[] | null {
  try {
    const topLevel = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
    if (normalizePath(topLevel) !== normalizePath(root)) return null;
    const output = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim();
    if (output.length === 0) return [];
    return output.split(/\r?\n/).map((line) => line.slice(3).trim().replace(/\\/g, '/'));
  } catch {
    return null;
  }
}

function hasExactApprovalEvidence(root: string): boolean {
  const evidenceRoot = join(root, 'docs', 'ai-execution-evidence');
  if (!existsSync(evidenceRoot)) return false;

  const changedPaths = gitStatusPaths(root);
  const candidateFiles = changedPaths === null
    ? listFilesRecursive(evidenceRoot)
    : changedPaths
        .filter((path) => path.startsWith('docs/ai-execution-evidence/'))
        .map((path) => join(root, path));

  for (const file of candidateFiles) {
    const normalized = file.replace(/\\/g, '/').toLowerCase();
    if (!normalized.endsWith('.md')) continue;
    if (normalized.endsWith('/readme.md')) continue;
    if (!existsSync(file)) continue;
    if (readUtf8(file).includes(APPROVAL_PHRASE)) return true;
  }
  return false;
}

function gitChangedGovernancePaths(root: string): string[] {
  const paths = gitStatusPaths(root);
  if (paths === null) return [];
  return paths.filter((path) => isProtectedGovernancePath(path));
}

function isProtectedGovernancePath(path: string): boolean {
  if (path === GOVERNANCE_LOCK_PATH) return true;
  if ((PROTECTED_GOVERNANCE_FILES as readonly string[]).includes(path)) return true;
  return PROTECTED_GOVERNANCE_DIRECTORIES.some((directory) => path === directory || path.startsWith(`${directory}/`));
}

export function verifyGovernanceTamper(root = process.cwd()): VerificationResult {
  const result = createResult();
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) {
    fail(result, `Missing ${GOVERNANCE_LOCK_PATH}. Run pnpm governance:lock after approved governance changes.`);
    return result;
  }

  const lock = parseLock(readUtf8(lockPath));
  if (!lock) {
    fail(result, `${GOVERNANCE_LOCK_PATH} is malformed or does not contain the required approval phrase metadata.`);
    return result;
  }

  const findings: string[] = [];
  const lockedFiles = new Map(lock.files.map((file) => [file.path, file.sha256]));
  const currentFiles = new Set(listProtectedGovernanceFiles(root));
  result.checked = lock.files.length + currentFiles.size;

  for (const [path, expectedHash] of lockedFiles) {
    const fullPath = join(root, path);
    if (!existsSync(fullPath)) {
      findings.push(`Protected governance file is missing: ${path}`);
      continue;
    }
    const actualHash = sha256File(fullPath);
    if (actualHash !== expectedHash) findings.push(`Protected governance file was modified: ${path}`);
  }

  for (const path of currentFiles) {
    if (!lockedFiles.has(path)) findings.push(`New protected governance file is not recorded in ${GOVERNANCE_LOCK_PATH}: ${path}`);
  }

  for (const path of gitChangedGovernancePaths(root)) {
    findings.push(`Protected governance path has uncommitted changes: ${path}`);
  }

  if (findings.length === 0) return result;

  if (hasExactApprovalEvidence(root)) {
    warn(result, `Protected governance changes allowed by explicit approval evidence containing: ${APPROVAL_PHRASE}`);
    for (const finding of findings) warn(result, finding);
    return result;
  }

  for (const finding of findings) fail(result, finding);
  fail(result, `Governance files may not be modified, disabled, deleted, or weakened without a newly changed evidence file containing the exact phrase: ${APPROVAL_PHRASE}`);
  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('governance:tamper-check', verifyGovernanceTamper(process.cwd()));
}

