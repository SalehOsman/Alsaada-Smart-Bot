import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createResult, fail, isCliEntrypoint, listFilesRecursive, printAndExit, readUtf8, warn, type VerificationResult } from './common.js';
import {
  APPROVAL_PHRASE,
  GOVERNANCE_LOCK_PATH,
  PROTECTED_GOVERNANCE_DIRECTORIES,
  PROTECTED_GOVERNANCE_FILES,
  hashDirectoryFiles,
  listDockerFiles,
  listProtectedGovernanceFiles,
  sha256File,
  type GovernanceLock,
} from './verify-governance-lock.js';

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

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function gitStatusPaths(root: string): string[] | null {
  try {
    const resolvedRoot = normalizePath(resolve(root));
    const topLevelRaw = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
    const topLevel = normalizePath(topLevelRaw);
    const isWindows = process.platform === 'win32';
    const matches = isWindows
      ? topLevel.toLowerCase() === resolvedRoot.toLowerCase()
      : topLevel === resolvedRoot;
    if (!matches) return null;
    const output = execFileSync('git', ['-c', 'core.quotepath=false', 'status', '--porcelain'], { cwd: root, encoding: 'utf8' });
    if (output.trim().length === 0) return [];
    return output
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const rest = line.slice(3).trim();
        if (rest.includes(' -> ')) {
          return rest.split(' -> ')[1]?.replace(/^"|"$/g, '').replace(/\\/g, '/') ?? '';
        }
        return rest.replace(/^"|"$/g, '').replace(/\\/g, '/');
      })
      .filter((path) => path.length > 0);
  } catch {
    return null;
  }
}

export const AUTHORIZED_APPROVAL_PHRASES = [
  APPROVAL_PHRASE,
  'نعم موافق على التعديل',
  'موافق على الفتح',
] as const;

export function cleanTargetPath(raw: string): string {
  let s = raw.trim();
  // Strip markdown bold / italic
  s = s.replace(/^\*+|\*+$/g, '');
  // Strip markdown link [label](url) -> prefer label if it contains path characters, else url
  const linkMatch = s.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (linkMatch) {
    const label = linkMatch[1]?.trim().replace(/^`|`$/g, '') ?? '';
    const url = linkMatch[2]?.trim() ?? '';
    if (label.includes('.') || label.includes('/')) {
      s = label;
    } else if (url.includes('/') && !url.startsWith('http')) {
      s = url.replace(/^file:\/\/\/?/, '');
    } else {
      s = label;
    }
  }
  // Strip surrounding quotes and backticks
  s = s.replace(/^[`'"]+|[`'"]+$/g, '');
  return normalizePath(s);
}

export function pathMatchesTarget(filePath: string, target: string): boolean {
  const normFile = normalizePath(filePath).toLowerCase();
  const normTarget = normalizePath(target).toLowerCase();

  if (normTarget === '*' || normTarget === 'all' || normTarget === '/*' || normTarget === '.' || normTarget === '') {
    return false;
  }

  if (normFile === normTarget) return true;

  if (normTarget.endsWith('/*')) {
    const dirPrefix = normTarget.slice(0, -1);
    return normFile.startsWith(dirPrefix);
  }
  if (normTarget.endsWith('/')) {
    return normFile.startsWith(normTarget);
  }
  if (normFile.startsWith(`${normTarget}/`)) {
    return true;
  }

  return false;
}

export function isScaffoldAutoEvidence(filePath: string, content: string): boolean {
  const normPath = filePath.replace(/\\/g, '/').toLowerCase();
  if (normPath.includes('-closure.md')) return true;
  if (
    normPath.includes('-unlock-flow-') ||
    normPath.includes('-unlock-dashboard-') ||
    normPath.includes('-unlock-module-') ||
    normPath.includes('-unlock-speed') ||
    normPath.includes('-unlock-docker') ||
    normPath.includes('-docker-infrastructure-lock') ||
    normPath.includes('-speed-engine-lock')
  ) {
    return true;
  }
  if (
    content.includes('اكتمال واعتماد تدفق') ||
    content.includes('اكتمال واعتماد شاشة') ||
    content.includes('اكتمال واعتماد موديول')
  ) {
    return true;
  }
  if (
    content.includes('ترخيص فك قفل الحوكمة: تدفق البوت') ||
    content.includes('ترخيص فك قفل الحوكمة: شاشة لوحة التحكم') ||
    content.includes('ترخيص فك قفل الحوكمة: موديول المنظومة') ||
    content.includes('ترخيص فك قفل الحوكمة: محرك السرعة') ||
    content.includes('ترخيص فك قفل الحوكمة: البنية التحتية والدوكر') ||
    content.includes('توثيق القفل التشفيري للبنية التحتية والدوكر') ||
    content.includes('توثيق القفل التشفيري لمحرك السرعة')
  ) {
    return true;
  }
  return false;
}

export function extractTargetPathsFromEvidence(content: string): string[] {
  const targets = new Set<string>();

  // 1. Check YAML frontmatter block
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch && frontmatterMatch[1]) {
    const fm = frontmatterMatch[1];
    const lines = fm.split(/\r?\n/);
    let inTargetList = false;
    for (const line of lines) {
      const trimmed = line.trim();
      const headerMatch = trimmed.match(/^(?:target[-_]?paths?|targets)\s*:\s*(.*)$/i);
      if (headerMatch) {
        const val = headerMatch[1]?.trim() ?? '';
        if (val.startsWith('[') && val.endsWith(']')) {
          val.slice(1, -1).split(',').forEach((p) => {
            const clean = cleanTargetPath(p);
            if (clean && clean !== '*' && clean.toLowerCase() !== 'all' && clean !== '.') {
              targets.add(clean);
            }
          });
          inTargetList = false;
        } else if (val.length > 0) {
          val.split(',').forEach((p) => {
            const clean = cleanTargetPath(p);
            if (clean && clean !== '*' && clean.toLowerCase() !== 'all' && clean !== '.') {
              targets.add(clean);
            }
          });
          inTargetList = false;
        } else {
          inTargetList = true;
        }
      } else if (inTargetList) {
        if (trimmed.startsWith('-')) {
          const clean = cleanTargetPath(trimmed.slice(1));
          if (clean && clean !== '*' && clean.toLowerCase() !== 'all' && clean !== '.') {
            targets.add(clean);
          }
        } else if (trimmed.length > 0 && !trimmed.startsWith('#')) {
          inTargetList = false;
        }
      }
    }
  }

  // 2. Check markdown body headers & bullet lists
  const lines = content.split(/\r?\n/);
  let inMarkdownList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(
      /^(?:[-*]\s*)?(?:\*\*)?(?:Target[-_]?Paths?|Targets|المسارات المرخصة|المسار المرخص|المسار البرمجي|المسارات المتأثرة|نطاق التعديل المرخص|نطاق التعديل)(?:\*\*)?\s*:\s*(?:\*\*)?(.*)$/i
    );
    if (headerMatch) {
      const val = headerMatch[1]?.trim().replace(/\*\*$/, '') ?? '';
      if (val.length > 0) {
        val.split(',').forEach((p) => {
          const clean = cleanTargetPath(p);
          if (clean && clean !== '*' && clean.toLowerCase() !== 'all' && clean !== '.') {
            targets.add(clean);
          }
        });
        inMarkdownList = false;
      } else {
        inMarkdownList = true;
      }
    } else if (inMarkdownList) {
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const clean = cleanTargetPath(trimmed.replace(/^[-*]\s*/, ''));
        if (clean && clean !== '*' && clean.toLowerCase() !== 'all' && clean !== '.') {
          targets.add(clean);
        }
      } else if (trimmed.length > 0) {
        inMarkdownList = false;
      }
    }
  }

  return [...targets];
}

// checkGovernanceApprovalEvidence permanently excised per Master Work Plan 63 (Phase 3).
// governance.lock.json is the exclusive and sole SSOT for component locking and cryptographic integrity.

export function hasExactApprovalEvidence(_root: string, _targetPaths?: Iterable<string>): boolean {
  // Permanently excised per Master Work Plan 63: governance.lock.json is the exclusive SSOT
  return false;
}

function isProtectedGovernanceDocPath(path: string): boolean {
  if (path === GOVERNANCE_LOCK_PATH) return true;
  if ((PROTECTED_GOVERNANCE_FILES as readonly string[]).includes(path)) return true;
  if (PROTECTED_GOVERNANCE_DIRECTORIES.some((directory) => path === directory || path.startsWith(`${directory}/`))) return true;
  return false;
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

  const lockedFindings: string[] = [];
  const governanceDocFindings: string[] = [];
  const modifiedGovernancePaths = new Set<string>();

  const lockedFiles = new Map(lock.files.map((file) => [file.path, file.sha256]));
  const currentFiles = new Set(listProtectedGovernanceFiles(root));
  let checkedCount = lock.files.length + currentFiles.size;

  // 1. Verify protected governance files
  for (const [path, expectedHash] of lockedFiles) {
    const fullPath = join(root, path);
    if (!existsSync(fullPath)) {
      governanceDocFindings.push(`Protected governance file is missing: ${path}`);
      modifiedGovernancePaths.add(normalizePath(path));
      continue;
    }
    const actualHash = sha256File(fullPath);
    if (actualHash !== expectedHash) {
      governanceDocFindings.push(`Protected governance file was modified: ${path}`);
      modifiedGovernancePaths.add(normalizePath(path));
    }
  }

  for (const path of currentFiles) {
    if (!lockedFiles.has(path)) {
      governanceDocFindings.push(`New protected governance file is not recorded in ${GOVERNANCE_LOCK_PATH}: ${path}`);
      modifiedGovernancePaths.add(normalizePath(path));
    }
  }

  // 2. Verify locked flows cryptographic integrity (NON-BYPASSABLE)
  if (lock.lockedFlows) {
    for (const [flowKey, flow] of Object.entries(lock.lockedFlows)) {
      checkedCount += flow.files.length;
      const flowDir = join(root, flow.directory);
      if (!existsSync(flowDir)) {
        lockedFindings.push(`Locked flow '${flowKey}' directory is missing: ${flow.directory}`);
        continue;
      }
      const expectedPaths = new Set(flow.files.map((f) => f.path));
      for (const file of flow.files) {
        const fullPath = join(root, file.path);
        if (!existsSync(fullPath)) {
          lockedFindings.push(`Locked flow '${flowKey}' file is missing: ${file.path}`);
          continue;
        }
        if (sha256File(fullPath) !== file.sha256) {
          lockedFindings.push(`Locked flow '${flowKey}' cryptographic integrity violated (modified): ${file.path}`);
        }
      }
      // Check for unrecorded / injected files
      const actualFiles = hashDirectoryFiles(flowDir, root);
      for (const actual of actualFiles) {
        if (!expectedPaths.has(actual.path)) {
          lockedFindings.push(`Locked flow '${flowKey}' contains unrecorded file: ${actual.path}`);
        }
      }
    }
  }

  // 3. Verify locked dashboard features cryptographic integrity (NON-BYPASSABLE)
  if (lock.lockedDashboardFeatures) {
    for (const [featureId, feature] of Object.entries(lock.lockedDashboardFeatures)) {
      checkedCount += feature.files.length;
      const featureDir = join(root, feature.directory);
      if (!existsSync(featureDir)) {
        lockedFindings.push(`Locked dashboard feature '${featureId}' directory is missing: ${feature.directory}`);
        continue;
      }
      const expectedPaths = new Set(feature.files.map((f) => f.path));
      for (const file of feature.files) {
        const fullPath = join(root, file.path);
        if (!existsSync(fullPath)) {
          lockedFindings.push(`Locked dashboard feature '${featureId}' file is missing: ${file.path}`);
          continue;
        }
        if (sha256File(fullPath) !== file.sha256) {
          lockedFindings.push(`Locked dashboard feature '${featureId}' cryptographic integrity violated (modified): ${file.path}`);
        }
      }
      // Check for unrecorded / injected files
      const actualFiles = hashDirectoryFiles(featureDir, root);
      for (const actual of actualFiles) {
        if (!expectedPaths.has(actual.path)) {
          lockedFindings.push(`Locked dashboard feature '${featureId}' contains unrecorded file: ${actual.path}`);
        }
      }
    }
  }

  // 3.5. Verify locked speed engine cryptographic integrity (NON-BYPASSABLE)
  if (lock.lockedSpeedEngine) {
    checkedCount += lock.lockedSpeedEngine.files.length;
    for (const file of lock.lockedSpeedEngine.files) {
      const fullPath = join(root, file.path);
      if (!existsSync(fullPath)) {
        lockedFindings.push(`Locked speed engine file is missing: ${file.path}`);
        continue;
      }
      if (sha256File(fullPath) !== file.sha256) {
        lockedFindings.push(`Locked speed engine cryptographic integrity violated (modified): ${file.path}`);
      }
    }
  }

  // 3.6. Verify locked modules cryptographic integrity (NON-BYPASSABLE)
  if (lock.lockedModules) {
    for (const [moduleName, mod] of Object.entries(lock.lockedModules)) {
      checkedCount += mod.files.length;
      const modDir = join(root, mod.directory);
      if (!existsSync(modDir)) {
        lockedFindings.push(`Locked module '${moduleName}' directory is missing: ${mod.directory}`);
        continue;
      }
      const expectedPaths = new Set(mod.files.map((f) => f.path));
      for (const file of mod.files) {
        const fullPath = join(root, file.path);
        if (!existsSync(fullPath)) {
          lockedFindings.push(`Locked module '${moduleName}' file is missing: ${file.path}`);
          continue;
        }
        if (sha256File(fullPath) !== file.sha256) {
          lockedFindings.push(`Locked module '${moduleName}' cryptographic integrity violated (modified): ${file.path}`);
        }
      }
      // Check for unrecorded / injected files
      const actualFiles = hashDirectoryFiles(modDir, root);
      for (const actual of actualFiles) {
        if (!expectedPaths.has(actual.path)) {
          lockedFindings.push(`Locked module '${moduleName}' contains unrecorded file: ${actual.path}`);
        }
      }
    }
  }

  // 3.7. Verify locked Docker infrastructure cryptographic integrity (NON-BYPASSABLE)
  if (lock.lockedDocker) {
    checkedCount += lock.lockedDocker.files.length;
    const expectedPaths = new Set(lock.lockedDocker.files.map((f) => f.path));
    for (const file of lock.lockedDocker.files) {
      const fullPath = join(root, file.path);
      if (!existsSync(fullPath)) {
        lockedFindings.push(`Locked Docker infrastructure file is missing: ${file.path}`);
        continue;
      }
      if (sha256File(fullPath) !== file.sha256) {
        lockedFindings.push(`Locked Docker infrastructure cryptographic integrity violated (modified): ${file.path}`);
      }
    }
    const actualDockerFiles = listDockerFiles(root);
    for (const actualPath of actualDockerFiles) {
      if (!expectedPaths.has(actualPath)) {
        lockedFindings.push(`Locked Docker infrastructure contains unrecorded file: ${actualPath}`);
      }
    }
  }

  result.checked = checkedCount;

  // 4. Evaluate findings
  // LOCKED COMPONENTS (Flows, Dashboard, Modules, Speed Engine, Docker)
  if (lockedFindings.length > 0) {
    for (const finding of lockedFindings) fail(result, finding);
    fail(
      result,
      'Cryptographic integrity of locked flows/dashboard features/modules/speed engine/docker was violated! Locked components cannot be modified without explicit unlock via pnpm flow:unlock, pnpm dashboard:unlock, pnpm module:unlock, pnpm speed:unlock, or pnpm docker:unlock.'
    );
    return result;
  }

  // PROTECTED GOVERNANCE FILES & DIRECTORIES
  if (governanceDocFindings.length > 0) {
    for (const finding of governanceDocFindings) fail(result, finding);
    fail(
      result,
      `Cryptographic integrity of protected governance files was violated! ${governanceDocFindings.length} violation(s) detected. Update governance lock via pnpm governance:lock after authorized changes.`
    );
    return result;
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('governance:tamper-check', verifyGovernanceTamper(process.cwd()));
}

