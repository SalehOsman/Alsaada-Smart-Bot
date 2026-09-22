/**
 * Sovereign Module Release Verifier (Work Plan 89 — Phase P7)
 * 
 * Verifies release manifests, cryptographic integrity checksums, and package consistency.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256String } from './catalog.js';
import type { ReleaseManifest } from './build-release.js';

export interface VerifyReleaseOptions {
  manifestPath?: string | undefined;
  root?: string | undefined;
  isProduction?: boolean | undefined;
}

export interface VerifyReleaseResult {
  ok: boolean;
  errors: string[];
  manifest?: ReleaseManifest | undefined;
}

export function verifyRelease(options: VerifyReleaseOptions = {}): VerifyReleaseResult {
  const root = options.root ? resolve(options.root) : process.cwd();
  const manifestPath = options.manifestPath
    ? resolve(options.manifestPath)
    : join(root, '.generated', 'release', 'manifest.json');

  const errors: string[] = [];

  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      errors: [`Release manifest not found at: ${manifestPath}. Run 'pnpm modules:build' first.`],
    };
  }

  let manifest: ReleaseManifest;
  try {
    const raw = readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(raw) as ReleaseManifest;
  } catch (err) {
    return {
      ok: false,
      errors: [`Failed to parse release manifest JSON: ${String(err)}`],
    };
  }

  // 1. Verify schema version
  if (manifest.schemaVersion !== '2.0.0') {
    errors.push(`Invalid schemaVersion in manifest: expected '2.0.0', got '${manifest.schemaVersion}'`);
  }

  // 2. Verify manifest cryptographic checksum
  const { checksum, ...payload } = manifest;
  const expectedChecksum = sha256String(JSON.stringify(payload));
  if (checksum !== expectedChecksum) {
    errors.push(`Manifest checksum mismatch! Recorded: ${checksum}, computed: ${expectedChecksum}`);
  }

  // 3. Verify environment invariants
  if (options.isProduction || manifest.environment === 'production') {
    for (const mod of manifest.modules) {
      if (mod.status === 'draft') {
        errors.push(`Production release contains draft module '${mod.id}'. Draft modules cannot be deployed to production.`);
      }
    }
  }

  // 4. Verify physical existence of modules
  for (const mod of manifest.modules) {
    const modDir = join(root, 'modules', mod.id);
    if (!existsSync(modDir)) {
      errors.push(`Module directory missing on disk: ${modDir}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    manifest,
  };
}

// CLI Entrypoint
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const isProduction = process.argv.includes('--production');
  const res = verifyRelease({ isProduction });

  if (!res.ok) {
    console.error('❌ Release verification failed:');
    for (const err of res.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log('✅ Release artifact verified successfully.');
  console.log(`📦 Verified ${res.manifest?.totalModules} modules and ${res.manifest?.totalFlows} flows.`);
  console.log(`🔒 Checksum OK: ${res.manifest?.checksum}`);
}
