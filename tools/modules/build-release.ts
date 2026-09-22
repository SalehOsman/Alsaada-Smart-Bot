/**
 * Sovereign Module Release Builder (Work Plan 89 — Phase P7)
 * 
 * Discovers and builds release manifests for all monorepo modules dynamically
 * using the Monorepo Catalog. Zero hardcoded module names.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanMonorepoCatalog,
  hashDirectoryFiles,
  sha256String,
  type MonorepoCatalog,
} from './catalog.js';
import { validateModuleCapabilities } from '../../packages/core-components/src/index.js';

export interface ReleaseManifestModule {
  id: string;
  version: string;
  status: string;
  titleArabic: string;
  moduleHash: string;
  flowsCount: number;
  isV1Compatible: boolean;
  requiredCapabilities: readonly string[] | string[];
}

export interface ReleaseManifest {
  schemaVersion: '2.0.0';
  generatedAt: string;
  gitCommitSha: string;
  environment: 'production' | 'staging' | 'development';
  coreHash: string;
  catalogHash: string;
  totalModules: number;
  totalFlows: number;
  modules: ReleaseManifestModule[];
  checksum: string;
}

export interface BuildReleaseOptions {
  root?: string | undefined;
  outDir?: string | undefined;
  environment?: 'production' | 'staging' | 'development' | undefined;
  isProduction?: boolean | undefined;
  gitCommitSha?: string | undefined;
}

export interface BuildReleaseResult {
  ok: boolean;
  manifestPath: string;
  manifest?: ReleaseManifest | undefined;
  modulesCount: number;
  flowsCount: number;
  error?: string | undefined;
}

export function computeCoreHash(root: string): string {
  const parts: string[] = [];
  const coreDirs = [
    join(root, 'packages', 'core-components', 'src'),
    join(root, 'packages', 'rbac', 'src'),
    join(root, 'packages', 'database', 'prisma'),
  ];

  for (const dir of coreDirs) {
    if (existsSync(dir)) {
      parts.push(hashDirectoryFiles(dir));
    }
  }

  return sha256String(parts.join('::'));
}

export function buildRelease(options: BuildReleaseOptions = {}): BuildReleaseResult {
  const root = options.root ? resolve(options.root) : process.cwd();
  const environment = options.isProduction ? 'production' : (options.environment ?? 'development');
  const outDir = options.outDir ? resolve(options.outDir) : join(root, '.generated', 'release');
  const gitCommitSha = options.gitCommitSha ?? process.env.GIT_COMMIT_SHA ?? 'HEAD-LOCAL';

  // 1. Scan monorepo catalog dynamically
  const catalog = scanMonorepoCatalog(root);

  // 2. Validate modules against environment policies
  const manifestModules: ReleaseManifestModule[] = [];
  const validationErrors: string[] = [];

  for (const mod of catalog.modules) {
    if (environment === 'production' && mod.status === 'draft') {
      validationErrors.push(`Production release rejects draft module '${mod.id}'. Must be certified 'ready'.`);
    }

    const capValidation = validateModuleCapabilities(mod.requiredCapabilities);
    if (!capValidation.valid) {
      validationErrors.push(`Module '${mod.id}' missing required capabilities: ${capValidation.missing.join(', ')}`);
    }

    manifestModules.push({
      id: mod.id,
      version: mod.version,
      status: mod.status,
      titleArabic: mod.titleArabic,
      moduleHash: mod.moduleHash,
      flowsCount: mod.flows.length,
      isV1Compatible: mod.isV1Compatible,
      requiredCapabilities: mod.requiredCapabilities,
    });
  }

  if (validationErrors.length > 0) {
    return {
      ok: false,
      manifestPath: '',
      modulesCount: catalog.modules.length,
      flowsCount: catalog.flows.length,
      error: validationErrors.join(' | '),
    };
  }

  // 3. Compute core and release checksums
  const coreHash = computeCoreHash(root);
  const catalogHash = catalog.catalogHash;

  const manifestPayload = {
    schemaVersion: '2.0.0' as const,
    generatedAt: new Date().toISOString(),
    gitCommitSha,
    environment,
    coreHash,
    catalogHash,
    totalModules: manifestModules.length,
    totalFlows: catalog.flows.length,
    modules: manifestModules,
  };

  const checksum = sha256String(JSON.stringify(manifestPayload));
  const manifest: ReleaseManifest = {
    ...manifestPayload,
    checksum,
  };

  // 4. Write manifest artifact
  mkdirSync(outDir, { recursive: true });
  const manifestPath = join(outDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  return {
    ok: true,
    manifestPath,
    manifest,
    modulesCount: manifestModules.length,
    flowsCount: catalog.flows.length,
  };
}

// CLI Entrypoint
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const isProduction = process.argv.includes('--production');
  const res = buildRelease({ isProduction });

  if (!res.ok) {
    console.error(`❌ Release build failed: ${res.error}`);
    process.exit(1);
  }

  console.log(`✅ Release build artifact generated: ${res.manifestPath}`);
  console.log(`📦 Discovered ${res.modulesCount} modules and ${res.flowsCount} flows dynamically.`);
  console.log(`🔒 Checksum: ${res.manifest?.checksum}`);
}
