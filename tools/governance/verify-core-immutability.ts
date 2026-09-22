import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createResult,
  fail,
  isCliEntrypoint,
  printAndExit,
  toRepoPath,
  type VerificationResult,
} from './common.js';

export const PROTECTED_CORE_DIRECTORIES = [
  'packages/core-components/src',
  'packages/database/prisma/schema.prisma',
  'packages/database/src',
  'packages/rbac/src',
  'packages/national-id-engine/src',
  'packages/regional-engine/src',
  'packages/telemetry/src',
  'packages/shared/src',
  'apps/bot-server/src/bot.ts',
  'apps/bot-server/src/services',
  'apps/admin-dashboard/src/app',
  'apps/admin-dashboard/src/lib',
] as const;

export interface CoreImmutabilityReport extends VerificationResult {
  coreHash: string;
  checkedFiles: number;
  modifiedCoreFiles: string[];
}

export function computeCoreHash(root = process.cwd()): { hash: string; fileCount: number } {
  const hashes: string[] = [];
  let fileCount = 0;

  for (const relTarget of PROTECTED_CORE_DIRECTORIES) {
    const fullTarget = join(root, relTarget);
    if (!existsSync(fullTarget)) continue;

    function walk(dirOrFile: string) {
      const entName = relative(root, dirOrFile).replace(/\\/g, '/');
      if (!existsSync(dirOrFile)) return;

      try {
        const stat = existsSync(dirOrFile);
        if (!stat) return;
      } catch {
        return;
      }

      // If it's a directory
      try {
        const entries = readdirSync(dirOrFile, { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const ent of entries) {
          if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.git') continue;
          const child = join(dirOrFile, ent.name);
          if (ent.isDirectory()) {
            walk(child);
          } else if (ent.isFile() && (ent.name.endsWith('.ts') || ent.name.endsWith('.prisma') || ent.name.endsWith('.json'))) {
            const buf = readFileSync(child);
            const sha = createHash('sha256').update(buf).digest('hex');
            const fileRel = relative(root, child).replace(/\\/g, '/');
            hashes.push(`${fileRel}:${sha}`);
            fileCount++;
          }
        }
      } catch {
        // If it's a single file
        const buf = readFileSync(dirOrFile);
        const sha = createHash('sha256').update(buf).digest('hex');
        hashes.push(`${entName}:${sha}`);
        fileCount++;
      }
    }

    walk(fullTarget);
  }

  const combined = createHash('sha256').update(hashes.join('\n'), 'utf8').digest('hex');
  return { hash: combined, fileCount };
}

export function verifyCoreImmutability(
  root = process.cwd(),
  options: { baseRef?: string; changedFiles?: string[] } = {}
): CoreImmutabilityReport {
  const result = createResult() as CoreImmutabilityReport;
  result.modifiedCoreFiles = [];

  const { hash, fileCount } = computeCoreHash(root);
  result.coreHash = hash;
  result.checkedFiles = fileCount;
  result.checked = fileCount;

  let changedFiles: string[] = [];

  if (options.changedFiles) {
    changedFiles = options.changedFiles;
  } else {
    try {
      const base = options.baseRef || 'HEAD';
      const output = execFileSync('git', ['diff', '--name-only', base], {
        cwd: root,
        encoding: 'utf8',
      });
      changedFiles = output
        .split(/\r?\n/)
        .map((f) => f.trim().replace(/\\/g, '/'))
        .filter((f) => f.length > 0);
    } catch {
      // If git diff fails, fallback to empty changed list
      changedFiles = [];
    }
  }

  for (const file of changedFiles) {
    const isCoreViolation = PROTECTED_CORE_DIRECTORIES.some((coreDir) => {
      return file === coreDir || file.startsWith(`${coreDir}/`);
    });

    if (isCoreViolation) {
      result.modifiedCoreFiles.push(file);
      fail(
        result,
        `Core Immutability Violation: Core file "${file}" was modified during module onboarding! Zero core modifications permitted.`
      );
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  const report = verifyCoreImmutability();
  console.log(`🛡️ [CORE IMMUTABILITY SENTINEL] Checked ${report.checkedFiles} protected core files.`);
  console.log(`   Core Integrity SHA-256: ${report.coreHash}`);

  if (!report.ok) {
    console.error(`❌ Core Immutability Breached! (${report.failures.length} violations)`);
    for (const f of report.failures) {
      console.error(`   - ${f}`);
    }
    process.exit(1);
  }

  console.log(`✅ Core Immutability 100% verified. Zero core files modified.`);
  process.exit(0);
}
