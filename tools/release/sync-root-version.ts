/**
 * tools/release/sync-root-version.ts
 *
 * Enterprise Monorepo Root Version & Governance Synchronizer
 * Automatically synchronizes root package.json and packages/telemetry/src/version.ts
 * with the workspace package version bumped by Changesets, and re-seals affected
 * packages and changelogs cryptographically in governance.lock.json.
 *
 * Compliance: Plan 84, Plan 87, Gate 13 (Tamper Guard), Gate 17 (Git Hygiene & Version Parity)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntrypoint } from '../governance/common.js';
import { lockAllEntities } from '../governance/unified-lock-engine.js';
import { writeGovernanceLock } from '../governance/verify-governance-lock.js';

export interface SyncRootVersionOptions {
  root?: string;
  sourcePackageRelPath?: string;
}

export interface SyncRootVersionResult {
  version: string;
  rootPackageUpdated: boolean;
  telemetryUpdated: boolean;
  reLockedCount: number;
  lockOk: boolean;
}

/**
 * Synchronizes monorepo version parity across root, telemetry, and governance locks.
 */
export function syncRootVersion(options: SyncRootVersionOptions = {}): SyncRootVersionResult {
  const root = options.root ?? process.cwd();
  const sourcePackageRelPath = options.sourcePackageRelPath ?? 'apps/bot-server/package.json';

  // 1. Read the version from workspace packages (e.g. apps/bot-server/package.json)
  const sourcePkgPath = join(root, sourcePackageRelPath);
  if (!existsSync(sourcePkgPath)) {
    throw new Error(`Source workspace package.json not found at ${sourcePkgPath}`);
  }

  const sourcePkg = JSON.parse(readFileSync(sourcePkgPath, 'utf8')) as { version?: string };
  const targetVersion = sourcePkg.version;
  if (!targetVersion) {
    throw new Error(`No version found in source workspace package at ${sourcePkgPath}`);
  }

  // 2. Update root package.json "version"
  const rootPkgPath = join(root, 'package.json');
  if (!existsSync(rootPkgPath)) {
    throw new Error(`Root package.json not found at ${rootPkgPath}`);
  }

  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8')) as Record<string, unknown>;
  const prevRootVersion = rootPkg['version'];
  rootPkg['version'] = targetVersion;
  writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 4) + '\n', 'utf8');
  const rootPackageUpdated = prevRootVersion !== targetVersion;

  // 3. Update packages/telemetry/src/version.ts PLATFORM_VERSION
  const telemetryVersionPath = join(root, 'packages', 'telemetry', 'src', 'version.ts');
  let telemetryUpdated = false;
  if (existsSync(telemetryVersionPath)) {
    let tvContent = readFileSync(telemetryVersionPath, 'utf8');
    tvContent = tvContent.replace(
      /export const PLATFORM_VERSION = ['"][^'"]+['"];/,
      `export const PLATFORM_VERSION = '${targetVersion}';`
    );
    tvContent = tvContent.replace(
      /export const PLATFORM_BUILD_TIME = ['"][^'"]+['"];/,
      `export const PLATFORM_BUILD_TIME = '${new Date().toISOString()}';`
    );
    writeFileSync(telemetryVersionPath, tvContent, 'utf8');
    telemetryUpdated = true;
  }

  // 4. Re-lock affected packages and changelogs via unified lock engine
  const lockResult = lockAllEntities(root);
  writeGovernanceLock(root);

  return {
    version: targetVersion,
    rootPackageUpdated,
    telemetryUpdated,
    reLockedCount: lockResult.successful,
    lockOk: lockResult.failed.length === 0,
  };
}

if (isCliEntrypoint(import.meta.url)) {
  console.log('🔄 [SYNC-ROOT-VERSION] Running atomic version synchronization...');
  try {
    const result = syncRootVersion();
    console.log(`✅ Root package.json synchronized to version: ${result.version}`);
    console.log(`✅ Telemetry PLATFORM_VERSION updated: ${result.telemetryUpdated}`);
    console.log(`🔒 Re-sealed ${result.reLockedCount} entities in governance.lock.json`);
  } catch (err) {
    console.error('❌ [SYNC-ROOT-VERSION] Failed to synchronize version:', err);
    process.exit(1);
  }
}
