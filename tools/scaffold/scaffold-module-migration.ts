/**
 * Sovereign Module Migration Scaffolder (Work Plan 89 - Phase P6)
 * 
 * Generates versioned, contract-bound database migration directories strictly
 * inside `modules/<module>/database/migrations/<YYYYMMDDHHMMSS>_<slug>/`.
 * STRICT INVARIANT: ZERO modifications outside target module migrations directory.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ScaffoldMigrationOptions {
  moduleId: string;
  slug: string;
  description: string;
  compatibility?: 'backward_compatible' | 'breaking' | undefined;
  root?: string | undefined;
  timestamp?: string | undefined;
}

export interface ScaffoldMigrationResult {
  ok: boolean;
  migrationId: string;
  migrationDir: string;
  filesCreated: string[];
  error?: string | undefined;
}

export function formatMigrationTimestamp(d = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = d.getUTCFullYear().toString();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
}

export function scaffoldModuleMigration(options: ScaffoldMigrationOptions): ScaffoldMigrationResult {
  const root = options.root ? resolve(options.root) : process.cwd();
  const moduleId = options.moduleId.trim().toLowerCase();
  const slug = options.slug.trim().toLowerCase();
  const description = options.description.trim();
  const compatibility = options.compatibility ?? 'backward_compatible';

  if (!moduleId) {
    return { ok: false, migrationId: '', migrationDir: '', filesCreated: [], error: 'Module ID is required.' };
  }

  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    return {
      ok: false,
      migrationId: '',
      migrationDir: '',
      filesCreated: [],
      error: `Invalid migration slug: '${slug}'. Must contain only alphanumeric characters, dashes, and underscores.`,
    };
  }

  if (!description) {
    return { ok: false, migrationId: '', migrationDir: '', filesCreated: [], error: 'Migration description is mandatory.' };
  }

  const moduleDir = join(root, 'modules', moduleId);
  if (!existsSync(moduleDir)) {
    return {
      ok: false,
      migrationId: '',
      migrationDir: '',
      filesCreated: [],
      error: `Target module does not exist: modules/${moduleId}`,
    };
  }

  const timestamp = options.timestamp ?? formatMigrationTimestamp();
  const migrationId = `${timestamp}_${slug}`;
  const migrationDir = join(moduleDir, 'database', 'migrations', migrationId);

  if (existsSync(migrationDir)) {
    return {
      ok: false,
      migrationId,
      migrationDir,
      filesCreated: [],
      error: `Migration directory already exists: ${migrationDir}`,
    };
  }

  mkdirSync(migrationDir, { recursive: true });
  const filesCreated: string[] = [];

  // 1. migration.sql
  const initialSql = `-- Migration for module: ${moduleId} (${slug})
-- Description: ${description}
-- Write idempotent and backward-compatible DDL statements below:

`;
  const sqlPath = join(migrationDir, 'migration.sql');
  writeFileSync(sqlPath, initialSql, 'utf8');
  filesCreated.push('migration.sql');

  // Compute checksum
  const checksum = createHash('sha256').update(initialSql, 'utf8').digest('hex');

  // 2. migration.contract.json
  const contractJson = {
    id: migrationId,
    moduleId,
    description,
    dependencies: [],
    compatibility,
    rollbackStrategy: `-- Rollback strategy for ${migrationId}\n-- Write safe reversal SQL if applicable:`,
    checksum,
  };
  const contractPath = join(migrationDir, 'migration.contract.json');
  writeFileSync(contractPath, JSON.stringify(contractJson, null, 2) + '\n', 'utf8');
  filesCreated.push('migration.contract.json');

  return {
    ok: true,
    migrationId,
    migrationDir,
    filesCreated,
  };
}

// CLI execution check
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length < 3 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: pnpm tsx tools/scaffold/scaffold-module-migration.ts <moduleId> <slug> <description>');
    console.log('Example: pnpm tsx tools/scaffold/scaffold-module-migration.ts sample-domain create_sample_table "Create sample table"');
    process.exit(args[0] === '--help' ? 0 : 1);
  }

  const moduleId = args[0]!;
  const slug = args[1]!;
  const description = args.slice(2).join(' ');

  try {
    const res = scaffoldModuleMigration({ moduleId, slug, description });
    if (!res.ok) {
      console.error(`❌ Migration scaffold failed: ${res.error}`);
      process.exit(1);
    }
    console.log(`✅ Module migration scaffolded successfully: ${res.migrationId}`);
    console.log(`📁 Directory: ${res.migrationDir}`);
    console.log(`🔒 Zero Core Modifications Invariant: ${res.filesCreated.length} files created strictly inside target module!`);
  } catch (err) {
    console.error(`❌ Fatal error:`, err);
    process.exit(1);
  }
}
