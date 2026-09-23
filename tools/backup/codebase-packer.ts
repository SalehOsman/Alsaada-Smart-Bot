import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const MAX_CODEBASE_BUNDLE_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB budget

export interface CodebasePackResult {
  success: boolean;
  bundlePath: string;
  sizeBytes: number;
  sha256: string;
  commitSha: string;
  branch: string;
  createdAt: string;
  error?: string | undefined;
}

export interface CodebasePackerOptions {
  root?: string | undefined;
  outputDir?: string | undefined;
  fileNamePrefix?: string | undefined;
}

export function calculateSha256(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Packs the repository codebase into a self-contained Git bundle.
 * Strict Zero-Bloat Invariant: Git bundle natively packages only repository git objects,
 * completely excluding node_modules, .pnpm-store, dist, .next, .astro, build, .turbo,
 * coverage, backups, logs, and uncommitted ephemeral files.
 */
export async function packCodebase(options: CodebasePackerOptions = {}): Promise<CodebasePackResult> {
  const root = resolve(options.root ?? process.cwd());
  const outputDir = resolve(options.outputDir ?? join(root, 'backups', 'codebase'));
  const prefix = options.fileNamePrefix ?? 'code-bundle';

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  let commitSha = 'unknown';
  let branch = 'unknown';

  try {
    commitSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    commitSha = '0000000000000000000000000000000000000000';
    branch = 'main';
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bundleFileName = `${prefix}-${timestamp}.bundle`;
  const bundlePath = join(outputDir, bundleFileName);

  try {
    // Generate git bundle for HEAD
    execSync(`git bundle create "${bundlePath}" HEAD`, {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stat = statSync(bundlePath);
    const sizeBytes = stat.size;
    const sha256 = calculateSha256(bundlePath);

    if (sizeBytes > MAX_CODEBASE_BUNDLE_SIZE_BYTES) {
      return {
        success: false,
        bundlePath,
        sizeBytes,
        sha256,
        commitSha,
        branch,
        createdAt: new Date().toISOString(),
        error: `Codebase bundle exceeds maximum zero-bloat budget of 30MB (actual: ${(sizeBytes / (1024 * 1024)).toFixed(2)}MB).`,
      };
    }

    return {
      success: true,
      bundlePath,
      sizeBytes,
      sha256,
      commitSha,
      branch,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      bundlePath,
      sizeBytes: 0,
      sha256: '',
      commitSha,
      branch,
      createdAt: new Date().toISOString(),
      error: `Failed to create git bundle: ${String(err)}`,
    };
  }
}

/**
 * Verifies the integrity of a git bundle using git bundle verify.
 */
export async function verifyCodebaseBundle(bundlePath: string, root = process.cwd()): Promise<boolean> {
  if (!existsSync(bundlePath)) {
    return false;
  }

  try {
    execSync(`git bundle verify "${bundlePath}"`, {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
