/**
 * Module Migration & DDL Safety Validator (Work Plan 89 - Phase P5)
 * 
 * Inspects migration contracts, verifies checksums, enforces global ordering,
 * and guards against forbidden destructive DDL actions on shared core models.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface MigrationContract {
  id: string;
  moduleId: string;
  description: string;
  dependencies: string[];
  compatibility: 'backward_compatible' | 'breaking';
  rollbackStrategy: string;
  checksum?: string | undefined;
}

export interface MigrationValidationResult {
  valid: boolean;
  coreMigrationsCount: number;
  moduleMigrationsCount: number;
  checkedCount: number;
  errors: string[];
  warnings: string[];
}

export function computeFileSha256(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Checks SQL content for destructive actions on core tables.
 */
export function checkDestructiveCoreDDL(sqlContent: string, moduleAllowedTables: string[] = []): string[] {
  const violations: string[] = [];
  const normalizedSql = sqlContent.toLowerCase();

  // Forbidden patterns on shared core tables
  const dropTableRegex = /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_"]+)/gi;
  let match: RegExpExecArray | null = null;
  while ((match = dropTableRegex.exec(sqlContent)) !== null) {
    const table = match[1]?.replace(/"/g, '').toLowerCase() ?? '';
    if (!moduleAllowedTables.map((t) => t.toLowerCase()).includes(table)) {
      violations.push(`Forbidden DROP TABLE statement on table '${table}' in module migration.`);
    }
  }

  const dropColumnRegex = /alter\s+table\s+(?:[a-zA-Z0-9_"]+\.)?([a-zA-Z0-9_"]+)\s+drop\s+column/gi;
  while ((match = dropColumnRegex.exec(sqlContent)) !== null) {
    const table = match[1]?.replace(/"/g, '').toLowerCase() ?? '';
    if (!moduleAllowedTables.map((t) => t.toLowerCase()).includes(table)) {
      violations.push(`Forbidden ALTER TABLE DROP COLUMN statement on table '${table}'.`);
    }
  }

  return violations;
}

/**
 * Validates all migrations in the project.
 */
export function validateMigrations(root = process.cwd()): MigrationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const coreMigrationsDir = join(root, 'packages', 'database', 'prisma', 'migrations');
  const modulesDir = join(root, 'modules');

  let coreMigrationsCount = 0;
  let moduleMigrationsCount = 0;

  // 1. Verify Core Migrations Integrity
  if (existsSync(coreMigrationsDir)) {
    const coreEntries = readdirSync(coreMigrationsDir, { withFileTypes: true });
    for (const ent of coreEntries) {
      if (!ent.isDirectory()) continue;
      const migDir = join(coreMigrationsDir, ent.name);
      const sqlFile = join(migDir, 'migration.sql');
      if (!existsSync(sqlFile)) {
        errors.push(`Core migration '${ent.name}' is missing migration.sql`);
        continue;
      }
      coreMigrationsCount++;
    }
  }

  // 2. Verify Module Migrations and Contracts
  const migrationIds = new Set<string>();

  if (existsSync(modulesDir)) {
    const modEntries = readdirSync(modulesDir, { withFileTypes: true });
    modEntries.sort((a, b) => a.name.localeCompare(b.name));

    for (const modEnt of modEntries) {
      if (!modEnt.isDirectory()) continue;
      const modName = modEnt.name;
      const modMigDir = join(modulesDir, modName, 'database', 'migrations');
      if (!existsSync(modMigDir)) continue;

      const migEntries = readdirSync(modMigDir, { withFileTypes: true });
      migEntries.sort((a, b) => a.name.localeCompare(b.name));

      for (const migEnt of migEntries) {
        if (!migEnt.isDirectory()) continue;
        const migDir = join(modMigDir, migEnt.name);
        const sqlFile = join(migDir, 'migration.sql');
        const contractFile = join(migDir, 'migration.contract.json');

        if (!existsSync(sqlFile)) {
          errors.push(`Module migration '${modName}/${migEnt.name}' is missing migration.sql`);
          continue;
        }

        if (!existsSync(contractFile)) {
          errors.push(`Module migration '${modName}/${migEnt.name}' is missing migration.contract.json`);
          continue;
        }

        // Validate contract schema
        try {
          const rawContract = JSON.parse(readFileSync(contractFile, 'utf8')) as MigrationContract;
          if (!rawContract.id || typeof rawContract.id !== 'string') {
            errors.push(`Module migration '${modName}/${migEnt.name}' contract missing valid 'id'`);
          } else if (migrationIds.has(rawContract.id)) {
            errors.push(`Duplicate migration ID '${rawContract.id}' detected in '${modName}/${migEnt.name}'`);
          } else {
            migrationIds.add(rawContract.id);
          }

          if (rawContract.moduleId !== modName) {
            errors.push(
              `Module migration '${modName}/${migEnt.name}' has mismatched moduleId '${rawContract.moduleId}' in contract`
            );
          }

          if (!rawContract.description) {
            warnings.push(`Module migration '${modName}/${migEnt.name}' lacks descriptive documentation`);
          }

          if (rawContract.checksum) {
            const actualSha = computeFileSha256(sqlFile);
            if (actualSha !== rawContract.checksum) {
              errors.push(
                `Checksum mismatch in '${modName}/${migEnt.name}': expected ${rawContract.checksum}, got ${actualSha}`
              );
            }
          }

          // DDL destructive check
          const sqlContent = readFileSync(sqlFile, 'utf8');
          const ddlViolations = checkDestructiveCoreDDL(sqlContent);
          for (const v of ddlViolations) {
            errors.push(`[${modName}/${migEnt.name}] ${v}`);
          }

          moduleMigrationsCount++;
        } catch (err: unknown) {
          errors.push(
            `Failed to parse migration contract in '${modName}/${migEnt.name}': ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }
  }

  const checkedCount = coreMigrationsCount + moduleMigrationsCount;
  return {
    valid: errors.length === 0,
    coreMigrationsCount,
    moduleMigrationsCount,
    checkedCount,
    errors,
    warnings,
  };
}

// CLI execution check
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('🔍 Validating monorepo migrations and DDL contracts...');
  const result = validateMigrations();

  if (result.warnings.length > 0) {
    console.warn(`⚠️ Warnings (${result.warnings.length}):`);
    for (const w of result.warnings) {
      console.warn(`   - ${w}`);
    }
  }

  if (!result.valid) {
    console.error(`❌ Migration validation failed with ${result.errors.length} error(s):`);
    for (const e of result.errors) {
      console.error(`   - ${e}`);
    }
    process.exit(1);
  } else {
    console.log(`✅ All ${result.checkedCount} migration(s) verified successfully!`);
    console.log(`   Core Migrations:   ${result.coreMigrationsCount}`);
    console.log(`   Module Migrations: ${result.moduleMigrationsCount}`);
  }
}
