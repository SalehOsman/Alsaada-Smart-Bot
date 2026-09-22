/**
 * Enterprise Database Schema & Migration Composer (Work Plan 89 - Phase P5)
 * 
 * Composes unified Prisma schema from the core database baseline and module-owned
 * fragments without directly modifying the core packages/database source files.
 * Supports AST-safe relation extensions and migration synchronization.
 */

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RelationContractEntry {
  targetModel: string;
  fieldName: string;
  fieldType: string;
  relationDirective?: string | undefined;
}

export interface DatabaseCompositionOptions {
  root?: string | undefined;
  outputPath?: string | undefined;
  migrationsOutputPath?: string | undefined;
  dryRun?: boolean | undefined;
}

export interface DatabaseCompositionResult {
  schemaPath: string;
  schemaHash: string;
  coreModelsCount: number;
  moduleModelsCount: number;
  injectedRelationsCount: number;
  totalMigrationsCount: number;
  modulesScanned: string[];
}

export class DatabaseCompositionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DatabaseCompositionError';
  }
}

/**
 * Extracts model names declared in a Prisma schema text.
 */
export function extractModelNames(schemaContent: string): string[] {
  const modelRegex = /model\s+([A-Za-z0-9_]+)\s*\{/g;
  const names: string[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    if (match[1]) {
      names.push(match[1]);
    }
  }
  return names;
}

/**
 * Extracts enum names declared in a Prisma schema text.
 */
export function extractEnumNames(schemaContent: string): string[] {
  const enumRegex = /enum\s+([A-Za-z0-9_]+)\s*\{/g;
  const names: string[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = enumRegex.exec(schemaContent)) !== null) {
    if (match[1]) {
      names.push(match[1]);
    }
  }
  return names;
}

/**
 * Injects relation fields into a target model inside a schema string safely.
 */
export function injectRelationIntoModel(
  schemaText: string,
  targetModel: string,
  fieldName: string,
  fieldType: string,
  relationDirective?: string | undefined
): string {
  const modelRegex = new RegExp(`(model\\s+${targetModel}\\s*\\{[\\s\\S]*?)(\\r?\\n\\s*@@|\\r?\\n\\s*\\})`, 'm');
  const match = modelRegex.exec(schemaText);

  if (!match || match.index === undefined) {
    throw new DatabaseCompositionError(
      `Cannot inject relation: Target model '${targetModel}' not found in schema.`,
      'TARGET_MODEL_NOT_FOUND'
    );
  }

  const modelBody = match[1] ?? '';
  // Check if fieldName already exists in modelBody
  const fieldRegex = new RegExp(`^\\s*${fieldName}\\s+`, 'm');
  if (fieldRegex.test(modelBody)) {
    throw new DatabaseCompositionError(
      `Cannot inject relation: Field '${fieldName}' already exists in model '${targetModel}'.`,
      'DUPLICATE_FIELD_NAME'
    );
  }

  const directiveStr = relationDirective ? ` ${relationDirective}` : '';
  const newFieldLine = `  ${fieldName} ${fieldType}${directiveStr}`;

  const beforeCut = match[1];
  const afterCut = match[2];

  return (
    schemaText.substring(0, match.index) +
    beforeCut +
    '\n' +
    newFieldLine +
    afterCut +
    schemaText.substring(match.index + match[0].length)
  );
}

/**
 * Main database composer function.
 */
export function composeDatabaseSchema(options: DatabaseCompositionOptions = {}): DatabaseCompositionResult {
  const root = options.root ? resolve(options.root) : process.cwd();
  const coreSchemaPath = join(root, 'packages', 'database', 'prisma', 'schema.prisma');
  const modulesDir = join(root, 'modules');
  const outputPath = options.outputPath ? resolve(options.outputPath) : join(root, '.generated', 'database', 'schema.prisma');
  const migrationsOutputDir = options.migrationsOutputPath
    ? resolve(options.migrationsOutputPath)
    : join(root, '.generated', 'database', 'migrations');

  if (!existsSync(coreSchemaPath)) {
    throw new DatabaseCompositionError(
      `Core database schema not found at: ${coreSchemaPath}`,
      'CORE_SCHEMA_NOT_FOUND'
    );
  }

  let composedSchema = readFileSync(coreSchemaPath, 'utf8');
  const coreModelNames = new Set(extractModelNames(composedSchema));
  const coreEnumNames = new Set(extractEnumNames(composedSchema));

  const knownModels = new Map<string, string>(); // modelName -> source (core / moduleName)
  for (const m of coreModelNames) {
    knownModels.set(m, 'core');
  }

  const knownEnums = new Map<string, string>();
  for (const e of coreEnumNames) {
    knownEnums.set(e, 'core');
  }

  let moduleModelsCount = 0;
  let injectedRelationsCount = 0;
  const modulesScanned: string[] = [];

  const moduleFragments: Array<{ moduleId: string; fragmentContent: string }> = [];

  if (existsSync(modulesDir)) {
    const entries = readdirSync(modulesDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const modName = entry.name;
      const modDbDir = join(modulesDir, modName, 'database');
      const modSchemaFile = join(modDbDir, 'schema.prisma');
      const modRelationsFile = join(modDbDir, 'relations.contract.json');

      if (!existsSync(modSchemaFile) && !existsSync(modRelationsFile)) {
        continue;
      }

      modulesScanned.push(modName);

      // 1. Handle relations.contract.json
      if (existsSync(modRelationsFile)) {
        try {
          const raw = JSON.parse(readFileSync(modRelationsFile, 'utf8')) as RelationContractEntry[];
          if (Array.isArray(raw)) {
            for (const rel of raw) {
              composedSchema = injectRelationIntoModel(
                composedSchema,
                rel.targetModel,
                rel.fieldName,
                rel.fieldType,
                rel.relationDirective
              );
              injectedRelationsCount++;
            }
          }
        } catch (err: unknown) {
          if (err instanceof DatabaseCompositionError) throw err;
          throw new DatabaseCompositionError(
            `Failed to parse relations contract in module '${modName}': ${err instanceof Error ? err.message : String(err)}`,
            'INVALID_RELATIONS_CONTRACT'
          );
        }
      }

      // 2. Handle schema.prisma fragment
      if (existsSync(modSchemaFile)) {
        const fragmentContent = readFileSync(modSchemaFile, 'utf8');
        const fragmentModels = extractModelNames(fragmentContent);
        const fragmentEnums = extractEnumNames(fragmentContent);

        for (const model of fragmentModels) {
          if (knownModels.has(model)) {
            const owner = knownModels.get(model);
            throw new DatabaseCompositionError(
              `Model name collision: Model '${model}' declared in module '${modName}' conflicts with '${owner}'.`,
              'MODEL_NAME_COLLISION'
            );
          }
          knownModels.set(model, modName);
          moduleModelsCount++;
        }

        for (const enumName of fragmentEnums) {
          if (knownEnums.has(enumName)) {
            const owner = knownEnums.get(enumName);
            throw new DatabaseCompositionError(
              `Enum name collision: Enum '${enumName}' declared in module '${modName}' conflicts with '${owner}'.`,
              'ENUM_NAME_COLLISION'
            );
          }
          knownEnums.set(enumName, modName);
        }

        moduleFragments.push({ moduleId: modName, fragmentContent });
      }
    }
  }

  // Append module fragments with headers
  for (const frag of moduleFragments) {
    composedSchema += `\n\n// =============================================================\n`;
    composedSchema += `// Module Extension: ${frag.moduleId}\n`;
    composedSchema += `// =============================================================\n\n`;
    composedSchema += frag.fragmentContent.trim() + '\n';
  }

  // Calculate deterministic SHA-256
  const schemaHash = createHash('sha256').update(composedSchema, 'utf8').digest('hex');

  if (!options.dryRun) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, composedSchema, 'utf8');

    // Synchronize migrations
    mkdirSync(migrationsOutputDir, { recursive: true });

    // 1. Copy core migrations
    const coreMigrationsDir = join(root, 'packages', 'database', 'prisma', 'migrations');
    let totalMigrationsCount = 0;
    if (existsSync(coreMigrationsDir)) {
      const coreMigEntries = readdirSync(coreMigrationsDir, { withFileTypes: true });
      for (const ent of coreMigEntries) {
        if (!ent.isDirectory()) continue;
        const srcDir = join(coreMigrationsDir, ent.name);
        const dstDir = join(migrationsOutputDir, ent.name);
        cpSync(srcDir, dstDir, { recursive: true });
        totalMigrationsCount++;
      }
    }

    // 2. Copy module migrations
    if (existsSync(modulesDir)) {
      for (const modName of modulesScanned) {
        const modMigDir = join(modulesDir, modName, 'database', 'migrations');
        if (!existsSync(modMigDir)) continue;

        const migEntries = readdirSync(modMigDir, { withFileTypes: true });
        for (const ent of migEntries) {
          if (!ent.isDirectory()) continue;
          const dstDir = join(migrationsOutputDir, ent.name);
          if (existsSync(dstDir)) {
            // Collision detected!
            throw new DatabaseCompositionError(
              `Migration collision detected: '${ent.name}' already exists in migrations catalog.`,
              'MIGRATION_COLLISION'
            );
          }
          const srcDir = join(modMigDir, ent.name);
          cpSync(srcDir, dstDir, { recursive: true });
          totalMigrationsCount++;
        }
      }
    }

    return {
      schemaPath: outputPath,
      schemaHash,
      coreModelsCount: coreModelNames.size,
      moduleModelsCount,
      injectedRelationsCount,
      totalMigrationsCount,
      modulesScanned,
    };
  }

  return {
    schemaPath: outputPath,
    schemaHash,
    coreModelsCount: coreModelNames.size,
    moduleModelsCount,
    injectedRelationsCount,
    totalMigrationsCount: 0,
    modulesScanned,
  };
}

// CLI execution check
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log('🔄 Composing database schema and migrations...');
    const res = composeDatabaseSchema();
    console.log('✅ Database composed successfully:');
    console.log(`   Schema:             ${res.schemaPath}`);
    console.log(`   Schema Hash:        ${res.schemaHash}`);
    console.log(`   Core Models:        ${res.coreModelsCount}`);
    console.log(`   Module Models:      ${res.moduleModelsCount}`);
    console.log(`   Injected Relations: ${res.injectedRelationsCount}`);
    console.log(`   Total Migrations:   ${res.totalMigrationsCount}`);
  } catch (err: unknown) {
    console.error('❌ Database composition failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
