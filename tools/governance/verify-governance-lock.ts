import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createResult, fail, isCliEntrypoint, listFilesRecursive, printAndExit, toRepoPath, type VerificationResult } from './common.js';
import { listEntityFiles, sha256NormalizedFile } from './unified-lock-engine.js';
import {
  isPathAuthorizedByActiveUnlock,
  consumeActiveGovernanceUnlockForPath,
} from './governance-unlock-session.js';

export const APPROVAL_PHRASE = 'موافق على التعديل او الايقاف او الحذف';
export const GOVERNANCE_LOCK_PATH = 'governance.lock.json';

export interface GovernanceLockFileEntry {
  path: string;
  sha256: string;
}

export interface LockedFlowEntry {
  flowKey: string;
  flowSlug?: string | undefined;
  titleArabic?: string | undefined;
  directory: string;
  lockedAt: string;
  files: GovernanceLockFileEntry[];
}

export interface LockedDashboardFeatureEntry {
  featureId: string;
  title: string;
  directory: string;
  lockedAt: string;
  files: GovernanceLockFileEntry[];
}

export interface LockedSpeedEngineEntry {
  engineId: string;
  title: string;
  lockedAt: string;
  files: GovernanceLockFileEntry[];
}

export interface LockedModuleEntry {
  moduleName: string;
  titleArabic?: string | undefined;
  directory: string;
  lockedAt: string;
  files: GovernanceLockFileEntry[];
}

export interface LockedDockerEntry {
  directory: string;
  lockedAt: string;
  files: GovernanceLockFileEntry[];
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
  lockedFlows?: Record<string, LockedFlowEntry> | undefined;
  lockedDashboardFeatures?: Record<string, LockedDashboardFeatureEntry> | undefined;
  lockedModules?: Record<string, LockedModuleEntry> | undefined;
  lockedSpeedEngine?: LockedSpeedEngineEntry | undefined;
  lockedDocker?: LockedDockerEntry | undefined;
  lockedEntities?: Record<string, import('./unified-lock-engine.js').LockedEntity> | undefined;
}

export const PROTECTED_GOVERNANCE_FILES = [
  'AGENTS.md',
  'GEMINI.md',
  'package.json',
  'pnpm-workspace.yaml',
  '.gitignore',
  'docs/00-baseline-and-ssot-charter.md',
  'docs/14-ai-agent-governance-and-file-rules.md',
  'docs/15-universal-module-and-flow-standard.md',
  'docs/21-mandatory-module-architecture-and-gates.md',
  'docs/23-autonomous-agent-roster-and-rag.md',
  'docs/27-enterprise-ai-governance-and-quality-gates-constitution.md',
  'docs/ai-execution-evidence/README.md',
  '.cursorrules',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
] as const;

export const PROTECTED_GOVERNANCE_DIRECTORIES = [
  'tools/governance',
  '.github/workflows',
  'tools/scaffold',
  '.githooks',
  '.agents/rules',
  '.agents/skills',
  '.agents/subagents',
] as const;

export const DOCKER_INFRASTRUCTURE_FILES = [
  'docker-compose.yml',
  'docker-compose.yaml',
  '.dockerignore',
] as const;

export const DOCKER_INFRASTRUCTURE_DIRECTORIES = [
  'docker',
] as const;

export function listDockerFiles(root = process.cwd()): string[] {
  const files = new Set<string>();

  for (const file of DOCKER_INFRASTRUCTURE_FILES) {
    const fullPath = join(root, file);
    if (existsSync(fullPath)) files.add(file);
  }

  for (const dir of DOCKER_INFRASTRUCTURE_DIRECTORIES) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    for (const file of listFilesRecursive(fullDir)) {
      const repoPath = normalized(toRepoPath(root, file));
      if (
        repoPath.includes('/data/') ||
        repoPath.includes('/node_modules/') ||
        repoPath.endsWith('.log') ||
        repoPath.endsWith('.tmp')
      ) {
        continue;
      }
      files.add(repoPath);
    }
  }

  return [...files].sort((left, right) => left.localeCompare(right));
}

const GOVERNANCE_FILE_EXTENSIONS = new Set([
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.sh',
  '.cmd',
]);

function normalized(path: string): string {
  return path.replace(/\\/g, '/');
}

function hasGovernanceExtension(path: string): boolean {
  const normalizedPath = normalized(path).toLowerCase();
  if (normalizedPath.startsWith('.githooks/') || normalizedPath.includes('/.githooks/')) return true;
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

export function listProtectedGovernanceFiles(
  root = process.cwd(),
  customPaths?: { files?: readonly string[]; directories?: readonly string[] }
): string[] {
  const files = new Set<string>();
  const fileList = customPaths?.files ?? PROTECTED_GOVERNANCE_FILES;
  const dirList = customPaths?.directories ?? PROTECTED_GOVERNANCE_DIRECTORIES;

  for (const file of fileList) {
    const fullPath = join(root, file);
    if (existsSync(fullPath) && !isExcluded(file)) files.add(file);
  }

  for (const directory of dirList) {
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

export function isProtectedGovernancePath(filePath: string): boolean {
  const norm = normalized(filePath).replace(/^\.\//, '').replace(/\/$/, '');
  if ((PROTECTED_GOVERNANCE_FILES as readonly string[]).includes(norm)) {
    return true;
  }
  for (const dir of PROTECTED_GOVERNANCE_DIRECTORIES) {
    if (norm === dir || norm.startsWith(`${dir}/`)) {
      return true;
    }
  }
  return false;
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function fileHashMatches(path: string, expectedHash: string): boolean {
  try {
    const raw = readFileSync(path);
    const actualHash = createHash('sha256').update(raw).digest('hex');
    if (actualHash === expectedHash) return true;

    const normalizedHash = sha256NormalizedFile(path);
    if (normalizedHash === expectedHash) return true;

    const text = raw.toString('utf8');
    const lfHash = createHash('sha256').update(Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8')).digest('hex');
    if (lfHash === expectedHash) return true;

    const crlfHash = createHash('sha256').update(Buffer.from(text.replace(/\r?\n/g, '\r\n'), 'utf8')).digest('hex');
    if (crlfHash === expectedHash) return true;
  } catch {
    return false;
  }
  return false;
}

export function hashDirectoryFiles(dir: string, root = process.cwd()): GovernanceLockFileEntry[] {
  if (!existsSync(dir)) return [];
  const files = listFilesRecursive(dir)
    .map((filePath) => normalized(toRepoPath(root, filePath)))
    .filter(
      (repoPath) =>
        !repoPath.includes('/node_modules/') &&
        !repoPath.includes('/dist/') &&
        !repoPath.includes('/attachments/') &&
        !repoPath.startsWith('attachments/') &&
        !repoPath.endsWith('.tsbuildinfo')
    )
    .sort((a, b) => a.localeCompare(b));

  return files.map((file) => ({
    path: file,
    sha256: sha256NormalizedFile(join(root, file)),
  }));
}

export interface BuildGovernanceLockOptions {
  allowProtectedModifications?: boolean;
}

export function buildGovernanceLock(
  root = process.cwd(),
  generatedAt = new Date().toISOString(),
  existingLock?: GovernanceLock | null,
  options?: BuildGovernanceLockOptions
): GovernanceLock {
  let effectiveExisting = existingLock;
  if (!effectiveExisting) {
    const lockPath = join(root, GOVERNANCE_LOCK_PATH);
    if (existsSync(lockPath)) {
      try {
        effectiveExisting = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
      } catch {
        effectiveExisting = null;
      }
    }
  }

  const protectedFiles = listProtectedGovernanceFiles(root, effectiveExisting?.protectedPaths);

  let lockedFlows: Record<string, LockedFlowEntry> | undefined = effectiveExisting?.lockedFlows;
  let lockedDashboardFeatures: Record<string, LockedDashboardFeatureEntry> | undefined = effectiveExisting?.lockedDashboardFeatures;
  let lockedModules: Record<string, LockedModuleEntry> | undefined = effectiveExisting?.lockedModules;
  let lockedSpeedEngine: LockedSpeedEngineEntry | undefined = effectiveExisting?.lockedSpeedEngine;
  let lockedDocker: LockedDockerEntry | undefined = effectiveExisting?.lockedDocker;
  let lockedEntities: Record<string, import('./unified-lock-engine.js').LockedEntity> | undefined = effectiveExisting?.lockedEntities;

  // Physical Armor: Check for unauthorized on-disk modifications to protected governance files
  if (effectiveExisting && Array.isArray(effectiveExisting.files) && effectiveExisting.files.length > 0) {
    const existingFileMap = new Map(effectiveExisting.files.map((f) => [f.path, f.sha256]));
    const unauthorizedModifications: Array<{ path: string; expected: string; actual: string }> = [];

    for (const file of protectedFiles) {
      const fullPath = join(root, file);
      const currentHash = sha256NormalizedFile(fullPath);
      const expectedHash = existingFileMap.get(file);

      if (expectedHash && currentHash !== expectedHash) {
        const isAuthorized =
          options?.allowProtectedModifications === true ||
          isPathAuthorizedByActiveUnlock(file, root);

        if (!isAuthorized) {
          unauthorizedModifications.push({
            path: file,
            expected: expectedHash,
            actual: currentHash,
          });
        }
      } else if (!expectedHash) {
        // Newly added file to a protected directory
        const isAuthorized =
          options?.allowProtectedModifications === true ||
          isPathAuthorizedByActiveUnlock(file, root);

        if (!isAuthorized) {
          unauthorizedModifications.push({
            path: file,
            expected: 'UNRECORDED_PROTECTED_FILE',
            actual: currentHash,
          });
        }
      }
    }

    if (unauthorizedModifications.length > 0) {
      const details = unauthorizedModifications
        .map((m) => `  - ${m.path} (expected: ${m.expected}, actual: ${m.actual})`)
        .join('\n');
      throw new Error(
        `🚨 [CRITICAL GOVERNANCE BREACH: UNAUTHORIZED PROTECTED ENTITY MODIFICATION]\n` +
        `   The following protected governance file(s) were modified on disk without an active authorized OTP unlock session:\n` +
        `${details}\n` +
        `   Sealing unauthorized changes into governance.lock.json is strictly forbidden.\n` +
        `   Mandatory Dynamic OTP Challenge-Response Workflow (Work Plan 90):\n` +
        `   1. Request OTP challenge: pnpm unlock:request <target> --reason="<justification>"\n` +
        `   2. Obtain Saleh's untranslated approval in chat: «موافق على الفتح <UNLOCK-XXXXXX>»\n` +
        `   3. Confirm unlock: pnpm unlock:confirm <target>\n`
      );
    }
  }

  const lock: GovernanceLock = {
    schemaVersion: 1,
    generatedAt,
    approvalPhrase: APPROVAL_PHRASE,
    protectedPaths: {
      files: [...PROTECTED_GOVERNANCE_FILES],
      directories: [...PROTECTED_GOVERNANCE_DIRECTORIES],
    },
    files: protectedFiles.map((file) => ({ path: file, sha256: sha256NormalizedFile(join(root, file)) })),
  };

  if (lockedFlows && Object.keys(lockedFlows).length > 0) {
    lock.lockedFlows = lockedFlows;
  }
  if (lockedDashboardFeatures && Object.keys(lockedDashboardFeatures).length > 0) {
    lock.lockedDashboardFeatures = lockedDashboardFeatures;
  }
  if (lockedModules && Object.keys(lockedModules).length > 0) {
    lock.lockedModules = lockedModules;
  }
  if (lockedSpeedEngine) {
    lock.lockedSpeedEngine = lockedSpeedEngine;
  }
  if (lockedDocker) {
    const dockerFiles = listDockerFiles(root);
    lockedDocker.files = dockerFiles.map((file) => ({
      path: file,
      sha256: sha256NormalizedFile(join(root, file)),
    }));
    lockedDocker.lockedAt = generatedAt;
    lock.lockedDocker = lockedDocker;
  }
  if (lockedEntities && Object.keys(lockedEntities).length > 0) {
    if (lockedEntities['infra:docker']) {
      const dockerFiles = listDockerFiles(root);
      lockedEntities['infra:docker'].files = dockerFiles.map((file) => ({
        path: file,
        sha256: sha256NormalizedFile(join(root, file)),
      }));
      lockedEntities['infra:docker'].lockedAt = generatedAt;
    }
    if (lockedEntities['package:telemetry']) {
      const telemetryFiles = listEntityFiles(root, 'packages/telemetry', 'package');
      lockedEntities['package:telemetry'].files = telemetryFiles.map((file) => ({
        path: file,
        sha256: sha256NormalizedFile(join(root, file)),
      }));
      lockedEntities['package:telemetry'].lockedAt = generatedAt;
    }
    lock.lockedEntities = lockedEntities;
  }

  return lock;
}

export function writeGovernanceLock(
  root = process.cwd(),
  generatedAt = new Date().toISOString(),
  existingLock?: GovernanceLock | null,
  options?: BuildGovernanceLockOptions
): GovernanceLock {
  const lock = buildGovernanceLock(root, generatedAt, existingLock, options);
  const outputPath = join(root, GOVERNANCE_LOCK_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return lock;
}

export function lockFlowEntry(
  root: string,
  flowKey: string,
  flowDir: string,
  metadata?: { titleArabic?: string; flowSlug?: string }
): GovernanceLock {
  const existingLockPath = join(root, GOVERNANCE_LOCK_PATH);
  let existingLock: GovernanceLock | null = null;
  if (existsSync(existingLockPath)) {
    try {
      existingLock = JSON.parse(readFileSync(existingLockPath, 'utf8')) as GovernanceLock;
    } catch {
      existingLock = null;
    }
  }

  const files = hashDirectoryFiles(flowDir, root);
  const repoDir = normalized(toRepoPath(root, flowDir));
  const entry: LockedFlowEntry = {
    flowKey,
    flowSlug: metadata?.flowSlug,
    titleArabic: metadata?.titleArabic,
    directory: repoDir,
    lockedAt: new Date().toISOString(),
    files,
  };

  const lockedFlows = { ...(existingLock?.lockedFlows || {}), [flowKey]: entry };
  const updatedLock = buildGovernanceLock(root, new Date().toISOString(), {
    ...existingLock,
    lockedFlows,
  } as GovernanceLock);

  const outputPath = join(root, GOVERNANCE_LOCK_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(updatedLock, null, 2)}\n`, 'utf8');
  return updatedLock;
}

export function lockDashboardFeatureEntry(
  root: string,
  featureId: string,
  featureDir: string,
  title: string
): GovernanceLock {
  const existingLockPath = join(root, GOVERNANCE_LOCK_PATH);
  let existingLock: GovernanceLock | null = null;
  if (existsSync(existingLockPath)) {
    try {
      existingLock = JSON.parse(readFileSync(existingLockPath, 'utf8')) as GovernanceLock;
    } catch {
      existingLock = null;
    }
  }

  const files = hashDirectoryFiles(featureDir, root);
  const repoDir = normalized(toRepoPath(root, featureDir));
  const entry: LockedDashboardFeatureEntry = {
    featureId,
    title,
    directory: repoDir,
    lockedAt: new Date().toISOString(),
    files,
  };

  const lockedDashboardFeatures = { ...(existingLock?.lockedDashboardFeatures || {}), [featureId]: entry };
  const updatedLock = buildGovernanceLock(root, new Date().toISOString(), {
    ...existingLock,
    lockedDashboardFeatures,
  } as GovernanceLock);

  const outputPath = join(root, GOVERNANCE_LOCK_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(updatedLock, null, 2)}\n`, 'utf8');
  return updatedLock;
}

export function unlockFlowEntry(root: string, flowKey: string): { ok: boolean; error?: string } {
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) return { ok: false, error: 'governance.lock.json not found' };
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
    if (!lock.lockedFlows || !lock.lockedFlows[flowKey]) {
      return { ok: false, error: `Flow '${flowKey}' is not locked in governance.lock.json` };
    }
    delete lock.lockedFlows[flowKey];
    const updated = buildGovernanceLock(root, new Date().toISOString(), lock);
    writeFileSync(lockPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function unlockDashboardFeatureEntry(root: string, featureId: string): { ok: boolean; error?: string } {
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) return { ok: false, error: 'governance.lock.json not found' };
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
    if (!lock.lockedDashboardFeatures || !lock.lockedDashboardFeatures[featureId]) {
      return { ok: false, error: `Dashboard feature '${featureId}' is not locked in governance.lock.json` };
    }
    delete lock.lockedDashboardFeatures[featureId];
    const updated = buildGovernanceLock(root, new Date().toISOString(), lock);
    writeFileSync(lockPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function lockModuleEntry(
  root: string,
  moduleName: string,
  moduleDir: string,
  titleArabic?: string
): GovernanceLock {
  const existingLockPath = join(root, GOVERNANCE_LOCK_PATH);
  let existingLock: GovernanceLock | null = null;
  if (existsSync(existingLockPath)) {
    try {
      existingLock = JSON.parse(readFileSync(existingLockPath, 'utf8')) as GovernanceLock;
    } catch {
      existingLock = null;
    }
  }

  const files = hashDirectoryFiles(moduleDir, root);
  const repoDir = normalized(toRepoPath(root, moduleDir));
  const entry: LockedModuleEntry = {
    moduleName,
    titleArabic,
    directory: repoDir,
    lockedAt: new Date().toISOString(),
    files,
  };

  const lockedModules = { ...(existingLock?.lockedModules || {}), [moduleName]: entry };
  const updatedLock = buildGovernanceLock(root, new Date().toISOString(), {
    ...existingLock,
    lockedModules,
  } as GovernanceLock);

  const outputPath = join(root, GOVERNANCE_LOCK_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(updatedLock, null, 2)}\n`, 'utf8');
  return updatedLock;
}

export function unlockModuleEntry(root: string, moduleName: string): { ok: boolean; error?: string } {
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) return { ok: false, error: 'governance.lock.json not found' };
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
    if (!lock.lockedModules || !lock.lockedModules[moduleName]) {
      return { ok: false, error: `Module '${moduleName}' is not locked in governance.lock.json` };
    }
    delete lock.lockedModules[moduleName];
    const updated = buildGovernanceLock(root, new Date().toISOString(), lock);
    writeFileSync(lockPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function lockSpeedEngineEntry(
  root: string,
  speedFiles: string[],
  title = 'Enterprise Permanent Speed Engine'
): GovernanceLock {
  const existingLockPath = join(root, GOVERNANCE_LOCK_PATH);
  let existingLock: GovernanceLock | null = null;
  if (existsSync(existingLockPath)) {
    try {
      existingLock = JSON.parse(readFileSync(existingLockPath, 'utf8')) as GovernanceLock;
    } catch {
      existingLock = null;
    }
  }

  const files: GovernanceLockFileEntry[] = speedFiles.map((file) => {
    const repoPath = normalized(toRepoPath(root, file));
    return {
      path: repoPath,
      sha256: sha256File(join(root, repoPath)),
    };
  });

  const entry: LockedSpeedEngineEntry = {
    engineId: 'speed-engine',
    title,
    lockedAt: new Date().toISOString(),
    files,
  };

  const updatedLock = buildGovernanceLock(root, new Date().toISOString(), {
    ...existingLock,
    lockedSpeedEngine: entry,
  } as GovernanceLock);

  const outputPath = join(root, GOVERNANCE_LOCK_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(updatedLock, null, 2)}\n`, 'utf8');
  return updatedLock;
}

export function unlockSpeedEngineEntry(root: string): { ok: boolean; error?: string } {
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) return { ok: false, error: 'governance.lock.json not found' };
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
    if (!lock.lockedSpeedEngine) {
      return { ok: false, error: 'Speed engine is not locked in governance.lock.json' };
    }
    delete lock.lockedSpeedEngine;
    const updated = buildGovernanceLock(root, new Date().toISOString(), lock);
    writeFileSync(lockPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function lockDockerEntry(root = process.cwd()): GovernanceLock {
  const existingLockPath = join(root, GOVERNANCE_LOCK_PATH);
  let existingLock: GovernanceLock | null = null;
  if (existsSync(existingLockPath)) {
    try {
      existingLock = JSON.parse(readFileSync(existingLockPath, 'utf8')) as GovernanceLock;
    } catch {
      existingLock = null;
    }
  }

  const dockerFiles = listDockerFiles(root);
  const files: GovernanceLockFileEntry[] = dockerFiles.map((file) => ({
    path: file,
    sha256: sha256File(join(root, file)),
  }));

  const entry: LockedDockerEntry = {
    directory: 'docker',
    lockedAt: new Date().toISOString(),
    files,
  };

  const updatedLock = buildGovernanceLock(root, new Date().toISOString(), {
    ...existingLock,
    lockedDocker: entry,
  } as GovernanceLock);

  const outputPath = join(root, GOVERNANCE_LOCK_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(updatedLock, null, 2)}\n`, 'utf8');
  return updatedLock;
}

export function unlockDockerEntry(root = process.cwd()): { ok: boolean; error?: string } {
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) return { ok: false, error: 'governance.lock.json not found' };
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
    if (!lock.lockedDocker) {
      return { ok: false, error: 'Docker infrastructure is not locked in governance.lock.json' };
    }
    delete lock.lockedDocker;
    const updated = buildGovernanceLock(root, new Date().toISOString(), lock);
    writeFileSync(lockPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function verifyGovernanceLock(root = process.cwd()): VerificationResult {
  const result = createResult();
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) {
    fail(result, `Missing ${GOVERNANCE_LOCK_PATH}.`);
    return result;
  }

  let lock: GovernanceLock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
  } catch (err) {
    fail(result, `Failed to parse ${GOVERNANCE_LOCK_PATH}: ${err}`);
    return result;
  }

  let count = lock.files.length;

  for (const entry of lock.files) {
    const fullPath = join(root, entry.path);
    if (!existsSync(fullPath)) {
      fail(result, `Protected file missing: ${entry.path}`);
      continue;
    }
    if (!fileHashMatches(fullPath, entry.sha256)) {
      fail(result, `Protected file sha256 mismatch: ${entry.path}`);
    }
  }

  if (lock.lockedFlows) {
    for (const [flowKey, flow] of Object.entries(lock.lockedFlows)) {
      count += flow.files.length;
      const flowDir = join(root, flow.directory);
      if (!existsSync(flowDir)) {
        fail(result, `Locked flow '${flowKey}' directory is missing: ${flow.directory}`);
        continue;
      }
      const expectedPaths = new Set(flow.files.map((f) => f.path));
      for (const entry of flow.files) {
        const fullPath = join(root, entry.path);
        if (!existsSync(fullPath)) {
          fail(result, `Locked flow '${flowKey}' file is missing: ${entry.path}`);
          continue;
        }
        if (!fileHashMatches(fullPath, entry.sha256)) {
          fail(result, `Locked flow '${flowKey}' cryptographic integrity violated! Modified: ${entry.path}`);
        }
      }
      const actualFiles = hashDirectoryFiles(flowDir, root);
      for (const actual of actualFiles) {
        if (!expectedPaths.has(actual.path)) {
          fail(result, `Locked flow '${flowKey}' contains unrecorded file: ${actual.path}`);
        }
      }
    }
  }

  if (lock.lockedDashboardFeatures) {
    for (const [featureId, feature] of Object.entries(lock.lockedDashboardFeatures)) {
      count += feature.files.length;
      const featureDir = join(root, feature.directory);
      if (!existsSync(featureDir)) {
        fail(result, `Locked dashboard feature '${featureId}' directory is missing: ${feature.directory}`);
        continue;
      }
      const expectedPaths = new Set(feature.files.map((f) => f.path));
      for (const entry of feature.files) {
        const fullPath = join(root, entry.path);
        if (!existsSync(fullPath)) {
          fail(result, `Locked dashboard feature '${featureId}' file is missing: ${entry.path}`);
          continue;
        }
        if (!fileHashMatches(fullPath, entry.sha256)) {
          fail(result, `Locked dashboard feature '${featureId}' cryptographic integrity violated! Modified: ${entry.path}`);
        }
      }
      const actualFiles = hashDirectoryFiles(featureDir, root);
      for (const actual of actualFiles) {
        if (!expectedPaths.has(actual.path)) {
          fail(result, `Locked dashboard feature '${featureId}' contains unrecorded file: ${actual.path}`);
        }
      }
    }
  }

  if (lock.lockedModules) {
    for (const [moduleName, mod] of Object.entries(lock.lockedModules)) {
      count += mod.files.length;
      const modDir = join(root, mod.directory);
      if (!existsSync(modDir)) {
        fail(result, `Locked module '${moduleName}' directory is missing: ${mod.directory}`);
        continue;
      }
      const expectedPaths = new Set(mod.files.map((f) => f.path));
      for (const entry of mod.files) {
        const fullPath = join(root, entry.path);
        if (!existsSync(fullPath)) {
          fail(result, `Locked module '${moduleName}' file is missing: ${entry.path}`);
          continue;
        }
        if (!fileHashMatches(fullPath, entry.sha256)) {
          fail(result, `Locked module '${moduleName}' cryptographic integrity violated! Modified: ${entry.path}`);
        }
      }
      const actualFiles = hashDirectoryFiles(modDir, root);
      for (const actual of actualFiles) {
        if (!expectedPaths.has(actual.path)) {
          fail(result, `Locked module '${moduleName}' contains unrecorded file: ${actual.path}`);
        }
      }
    }
  }

  if (lock.lockedSpeedEngine) {
    count += lock.lockedSpeedEngine.files.length;
    for (const entry of lock.lockedSpeedEngine.files) {
      const fullPath = join(root, entry.path);
      if (!existsSync(fullPath)) {
        fail(result, `Locked speed engine file is missing: ${entry.path}`);
        continue;
      }
      if (!fileHashMatches(fullPath, entry.sha256)) {
        fail(result, `Locked speed engine cryptographic integrity violated! Modified: ${entry.path}`);
      }
    }
  }

  if (lock.lockedDocker) {
    count += lock.lockedDocker.files.length;
    const expectedPaths = new Set(lock.lockedDocker.files.map((f) => f.path));
    for (const entry of lock.lockedDocker.files) {
      const fullPath = join(root, entry.path);
      if (!existsSync(fullPath)) {
        fail(result, `Locked Docker infrastructure file is missing: ${entry.path}`);
        continue;
      }
      if (!fileHashMatches(fullPath, entry.sha256)) {
        fail(result, `Locked Docker infrastructure cryptographic integrity violated! Modified: ${entry.path}`);
      }
    }
    const actualDockerFiles = listDockerFiles(root);
    for (const actualPath of actualDockerFiles) {
      if (!expectedPaths.has(actualPath)) {
        fail(result, `Locked Docker infrastructure contains unrecorded file: ${actualPath}`);
      }
    }
  }

  if (lock.lockedEntities) {
    for (const [entityId, entity] of Object.entries(lock.lockedEntities)) {
      count += entity.files.length;
      const fullDirOrFile = join(root, entity.directory);
      if (!existsSync(fullDirOrFile)) {
        fail(result, `Locked entity '${entityId}' target is missing: ${entity.directory}`);
        continue;
      }
      for (const entry of entity.files) {
        const fullPath = join(root, entry.path);
        if (!existsSync(fullPath)) {
          fail(result, `Locked entity '${entityId}' file is missing: ${entry.path}`);
          continue;
        }
        if (!fileHashMatches(fullPath, entry.sha256)) {
          fail(result, `Locked entity '${entityId}' cryptographic integrity violated! Modified: ${entry.path}`);
        }
      }
      // Check for unrecorded / injected files
      const expectedPaths = new Set(entity.files.map((f) => f.path));
      let actualFiles: string[] = [];
      if (entity.id === 'infra:docker') {
        actualFiles = listDockerFiles(root);
      } else if (entity.id === 'infra:speed-engine') {
        actualFiles = [
          'apps/bot-server/src/services/fast-cache.service.ts',
          'apps/bot-server/src/services/telemetry.service.ts',
          'apps/bot-server/src/services/screen-flow.service.ts',
          'tools/governance/verify-latency-anti-patterns.ts',
        ].filter((p) => existsSync(join(root, p)));
      } else {
        actualFiles = listEntityFiles(root, entity.directory, entity.type);
      }

      for (const actualPath of actualFiles) {
        if (!expectedPaths.has(actualPath)) {
          fail(result, `Locked entity '${entityId}' contains unrecorded file: ${actualPath}`);
        }
      }
    }
  }

  result.checked = count;
  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  if (process.argv.includes('--write')) {
    const lock = writeGovernanceLock(process.cwd());
    console.log(`governance:lock: PASS`);
    console.log(`Protected files: ${lock.files.length}`);
    if (lock.lockedFlows) console.log(`Locked flows: ${Object.keys(lock.lockedFlows).length}`);
    if (lock.lockedDashboardFeatures) console.log(`Locked dashboard features: ${Object.keys(lock.lockedDashboardFeatures).length}`);
    if (lock.lockedModules) console.log(`Locked modules: ${Object.keys(lock.lockedModules).length}`);
    if (lock.lockedSpeedEngine) console.log(`Locked speed engine files: ${lock.lockedSpeedEngine.files.length}`);
    if (lock.lockedDocker) console.log(`Locked Docker infrastructure files: ${lock.lockedDocker.files.length}`);
    if (lock.lockedEntities) console.log(`Locked unified entities: ${Object.keys(lock.lockedEntities).length}`);
    console.log(`Output: ${GOVERNANCE_LOCK_PATH}`);
  } else {
    printAndExit('governance:lock', verifyGovernanceLock(process.cwd()));
  }
}
