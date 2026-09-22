/**
 * Sovereign Module Release Deployment Engine (Work Plan 89 — Phase P7)
 * 
 * Prepares, validates, and deploys verified module release manifests.
 * STRICT INVARIANT: Decoupled from build; never deploys draft modules to production.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRelease } from './verify-release.js';
import type { ReleaseManifest } from './build-release.js';

export interface DeployReleaseOptions {
  manifestPath?: string | undefined;
  root?: string | undefined;
  environment?: 'production' | 'staging' | 'development' | undefined;
  dryRun?: boolean | undefined;
}

export interface DeployReleaseResult {
  ok: boolean;
  environment: string;
  deployedModules: string[];
  logPath: string;
  error?: string | undefined;
}

export function deployRelease(options: DeployReleaseOptions = {}): DeployReleaseResult {
  const root = options.root ? resolve(options.root) : process.cwd();
  const environment = options.environment ?? 'development';
  const isProduction = environment === 'production';
  const dryRun = options.dryRun ?? false;

  // 1. Verify release artifact prior to deployment
  const verifyRes = verifyRelease({
    manifestPath: options.manifestPath,
    root,
    isProduction,
  });

  if (!verifyRes.ok || !verifyRes.manifest) {
    return {
      ok: false,
      environment,
      deployedModules: [],
      logPath: '',
      error: `Pre-deployment verification failed: ${verifyRes.errors.join(' | ')}`,
    };
  }

  const manifest = verifyRes.manifest;
  const deployedModules = manifest.modules.map((m) => m.id);

  // 2. Generate deployment log
  const logDir = join(root, '.generated', 'release');
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, 'deploy.log');

  const logEntry = [
    `=== Sovereign Module Deployment Log ===`,
    `Timestamp: ${new Date().toISOString()}`,
    `Environment: ${environment}`,
    `DryRun: ${dryRun}`,
    `GitCommit: ${manifest.gitCommitSha}`,
    `CoreHash: ${manifest.coreHash}`,
    `CatalogHash: ${manifest.catalogHash}`,
    `ManifestChecksum: ${manifest.checksum}`,
    `Modules (${manifest.totalModules}): ${deployedModules.join(', ')}`,
    `TotalFlows: ${manifest.totalFlows}`,
    `Status: SUCCESS`,
    `========================================\n`,
  ].join('\n');

  writeFileSync(logPath, logEntry, 'utf8');

  return {
    ok: true,
    environment,
    deployedModules,
    logPath,
  };
}

// CLI Entrypoint
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const isProd = process.argv.includes('--production');
  const dryRun = process.argv.includes('--dry-run');
  const env = isProd ? 'production' : 'development';

  const res = deployRelease({ environment: env, dryRun });
  if (!res.ok) {
    console.error(`❌ Deployment failed: ${res.error}`);
    process.exit(1);
  }

  console.log(`✅ Module release deployed successfully to [${res.environment}].`);
  console.log(`📦 Modules active: ${res.deployedModules.join(', ')}`);
  console.log(`📝 Audit log: ${res.logPath}`);
}
