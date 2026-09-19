/**
 * tools/governance/verify-release-sync.ts
 * Gate 21: Release & Changelog Parity Governance Verifier
 * Enforces 100% synchronization between package.json, CHANGELOG.md,
 * and packages/telemetry/src/version.ts before any commit or merge.
 * Compliance: Plan 84 - Living Release Engine & Safe Upgrade Architecture
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(process.cwd());

export function verifyReleaseSync(): boolean {
  console.log('🛡️ [GATE 21] Verifying Release, Changelog & Runtime Telemetry Parity...');

  // 1. Read package.json version
  const pkgPath = resolve(ROOT_DIR, 'package.json');
  if (!existsSync(pkgPath)) {
    console.error('❌ [GATE 21] Root package.json not found!');
    return false;
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const pkgVersion: string = pkg.version;

  // 2. Read CHANGELOG.md latest version header
  const changelogPath = resolve(ROOT_DIR, 'CHANGELOG.md');
  if (!existsSync(changelogPath)) {
    console.error('❌ [GATE 21] CHANGELOG.md not found!');
    return false;
  }
  const changelog = readFileSync(changelogPath, 'utf-8');
  const match = changelog.match(/## \[([^\]]+)\]/);
  if (!match || !match[1]) {
    console.error('❌ [GATE 21] No version header found in CHANGELOG.md!');
    return false;
  }
  const changelogVersion = match[1];

  if (pkgVersion !== changelogVersion) {
    console.error(
      `❌ [GATE 21] Version Mismatch! package.json (${pkgVersion}) != CHANGELOG.md (${changelogVersion})`
    );
    console.error(
      '👉 Run "pnpm release:bump" to synchronize versions atomically across all files.'
    );
    return false;
  }

  // 3. Read telemetry version.ts
  const telemetryPath = resolve(ROOT_DIR, 'packages', 'telemetry', 'src', 'version.ts');
  if (existsSync(telemetryPath)) {
    const telemetryContent = readFileSync(telemetryPath, 'utf-8');
    const telMatch = telemetryContent.match(/export const PLATFORM_VERSION = ['"]([^'"]+)['"];/);
    if (!telMatch || telMatch[1] !== pkgVersion) {
      console.error(
        `❌ [GATE 21] Telemetry Mismatch! package.json (${pkgVersion}) != telemetry/version.ts (${telMatch?.[1] ?? 'missing'})`
      );
      return false;
    }
  }

  console.log(`✅ [GATE 21] Release Parity 100% Verified! Active Version: ${pkgVersion}`);
  return true;
}

if (process.argv[1]?.endsWith('verify-release-sync.ts')) {
  const ok = verifyReleaseSync();
  process.exit(ok ? 0 : 1);
}
