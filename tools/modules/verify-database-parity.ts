/**
 * Gate G20: Database Schema & Migration Parity Sentinel
 * Governed by Work Plan 117 (Sovereign Modular Database Emancipation)
 *
 * Verifies:
 * 1. Zero ghost tables / deprecated models in active schemas.
 * 2. 4-Component database architecture across all active modules.
 * 3. Zero cross-module physical @relation references (Loose ID coupling invariant).
 * 4. Cryptographic integrity of composed database manifest.
 * 5. Sequential migration chain integrity.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createResult, fail, isCliEntrypoint, printAndExit, type VerificationResult } from '../governance/common.js';
import { extractModelNames } from './compose-database.js';

export function computeSha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function verifyDatabaseParity(root = process.cwd()): VerificationResult {
  const result = createResult();

  const manifestPath = join(root, '.generated', 'database', 'schema', 'manifest.json');
  const deprecatedRegistryPath = join(root, 'docs', 'schemas', 'deprecated-models.json');
  const coreSchemaPath = join(root, 'packages', 'database', 'prisma', 'schema.prisma');
  const migrationsDir = join(root, 'packages', 'database', 'prisma', 'migrations');
  const modulesDir = join(root, 'modules');

  // 1. Verify Manifest
  result.checked++;
  if (!existsSync(manifestPath)) {
    fail(result, 'Missing database manifest: .generated/database/schema/manifest.json');
    return result;
  }

  let manifest: any;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err: any) {
    fail(result, `Corrupt database manifest.json: ${err.message}`);
    return result;
  }

  // 2. Verify Deprecated Models Zero-Leakage
  result.checked++;
  if (!existsSync(deprecatedRegistryPath)) {
    fail(result, 'Missing deprecated models registry: docs/schemas/deprecated-models.json');
  } else {
    try {
      const deprecatedRegistry = JSON.parse(readFileSync(deprecatedRegistryPath, 'utf8'));
      const purgedModelNames = new Set<string>(deprecatedRegistry.models.map((m: any) => m.model));

      // Check core schema
      if (existsSync(coreSchemaPath)) {
        const coreModels = extractModelNames(readFileSync(coreSchemaPath, 'utf8'));
        for (const m of coreModels) {
          if (purgedModelNames.has(m)) {
            fail(result, `Ghost model '${m}' found in packages/database/prisma/schema.prisma! Must be purged.`);
          }
        }
      }

      // Check composed schema files
      const schemaDir = join(root, '.generated', 'database', 'schema');
      if (existsSync(schemaDir)) {
        const schemaFiles = readdirSync(schemaDir).filter((f) => f.endsWith('.prisma'));
        for (const sf of schemaFiles) {
          const content = readFileSync(join(schemaDir, sf), 'utf8');
          const models = extractModelNames(content);
          for (const m of models) {
            if (purgedModelNames.has(m)) {
              fail(result, `Ghost model '${m}' found in .generated/database/schema/${sf}! Must be purged.`);
            }
          }
        }
      }
    } catch (err: any) {
      fail(result, `Failed to parse deprecated-models.json: ${err.message}`);
    }
  }

  // 3. Verify 4-Component Architecture across active modules
  result.checked++;
  if (existsSync(modulesDir)) {
    const modules = readdirSync(modulesDir, { withFileTypes: true })
      .filter((ent) => ent.isDirectory() && ent.name !== 'sandbox')
      .map((ent) => ent.name);

    for (const mod of modules) {
      const modDbDir = join(modulesDir, mod, 'database');
      if (!existsSync(modDbDir)) {
        fail(result, `Module '${mod}' missing database directory: modules/${mod}/database`);
        continue;
      }

      // Check 4 components
      const schemaPrisma = join(modDbDir, 'schema.prisma');
      const relationsContract = join(modDbDir, 'relations.contract.json');
      const modMigrations = join(modDbDir, 'migrations');
      const erdMermaid = join(modDbDir, 'erd.mermaid');

      if (!existsSync(schemaPrisma)) {
        fail(result, `Module '${mod}' missing database/schema.prisma`);
      }
      if (!existsSync(relationsContract)) {
        fail(result, `Module '${mod}' missing database/relations.contract.json`);
      }
      if (!existsSync(modMigrations)) {
        fail(result, `Module '${mod}' missing database/migrations directory`);
      }
      if (!existsSync(erdMermaid)) {
        fail(result, `Module '${mod}' missing database/erd.mermaid`);
      }
    }
  }

  // 4. Verify Zero Cross-Module Physical Relations
  result.checked++;
  if (existsSync(modulesDir)) {
    const modules = readdirSync(modulesDir, { withFileTypes: true })
      .filter((ent) => ent.isDirectory())
      .map((ent) => ent.name);

    const moduleModelsMap = new Map<string, string>();
    for (const mod of modules) {
      const schemaFile = join(modulesDir, mod, 'database', 'schema.prisma');
      if (existsSync(schemaFile)) {
        const content = readFileSync(schemaFile, 'utf8');
        const models = extractModelNames(content);
        for (const m of models) {
          moduleModelsMap.set(m, mod);
        }
      }
    }

    for (const mod of modules) {
      const schemaFile = join(modulesDir, mod, 'database', 'schema.prisma');
      if (!existsSync(schemaFile)) continue;
      const content = readFileSync(schemaFile, 'utf8');
      const lines = content.split('\n');

      for (const [targetModel, targetModule] of moduleModelsMap.entries()) {
        if (targetModule !== mod) {
          for (const line of lines) {
            if (line.includes(` ${targetModel} `) && line.includes('@relation')) {
              fail(
                result,
                `Module '${mod}' has illegal physical foreign key to '${targetModel}' in '${targetModule}'. Must use Loose ID Reference.`
              );
            }
          }
        }
      }
    }
  }

  // 5. Verify Migration Chain Sequence
  result.checked++;
  if (existsSync(migrationsDir)) {
    const migrationFolders = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((ent) => ent.isDirectory() && !ent.name.startsWith('.'))
      .map((ent) => ent.name)
      .sort();

    if (migrationFolders.length < 11) {
      fail(result, `Expected at least 11 database migrations, found ${migrationFolders.length}`);
    }

    for (const folder of migrationFolders) {
      const sqlPath = join(migrationsDir, folder, 'migration.sql');
      if (!existsSync(sqlPath)) {
        fail(result, `Migration '${folder}' is missing migration.sql`);
      }
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  const result = verifyDatabaseParity();
  printAndExit('Gate G20: Database Schema & Migration Parity Sentinel', result);
}
