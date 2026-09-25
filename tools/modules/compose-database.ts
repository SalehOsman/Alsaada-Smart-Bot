/**
 * Enterprise Database Schema & Migration Composer (Work Plan 112 - Enhanced Wave 2)
 *
 * Composes unified Prisma schema from the core database baseline and module-owned
 * fragments utilizing Prisma 7 native `prismaSchemaFolder` architecture.
 * Eliminates brittle regex injection, generates deterministic `.generated/database/schema/*.prisma`,
 * produces cryptographic SHA-256 manifests, and maintains full backward compatibility.
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
  schemaFolderPath?: string | undefined;
  migrationsOutputPath?: string | undefined;
  dryRun?: boolean | undefined;
}

export interface ManifestSchemaFileEntry {
  filename: string;
  sourceModule: string;
  sha256: string;
  models: string[];
  enums: string[];
}

export interface DatabaseCompositionResult {
  schemaPath: string;
  schemaFolderPath: string;
  manifestPath: string;
  schemaHash: string;
  coreModelsCount: number;
  moduleModelsCount: number;
  injectedRelationsCount: number;
  totalMigrationsCount: number;
  modulesScanned: string[];
  generatedFiles: string[];
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
 * Strips datasource and generator blocks from module schema text to prevent duplicates.
 */
export function stripDatasourceAndGenerator(schemaText: string): string {
  let cleaned = schemaText.replace(/datasource\s+[A-Za-z0-9_]+\s*\{[\s\S]*?\r?\n\}/g, '');
  cleaned = cleaned.replace(/generator\s+[A-Za-z0-9_]+\s*\{[\s\S]*?\r?\n\}/g, '');
  return cleaned.trim();
}

/**
 * Ensures previewFeatures = ["prismaSchemaFolder"] is enabled in generator client block.
 */
export function ensurePrismaSchemaFolderFeature(coreSchemaText: string): string {
  const generatorRegex = /(generator\s+[A-Za-z0-9_]+\s*\{[\s\S]*?)(\r?\n\s*\})/;
  const match = generatorRegex.exec(coreSchemaText);

  if (!match) return coreSchemaText;

  const body = match[1] ?? '';
  if (body.includes('prismaSchemaFolder')) {
    return coreSchemaText;
  }

  // If previewFeatures is already declared, append to it; otherwise add previewFeatures line
  let newBody = body;
  if (/previewFeatures\s*=\s*\[(.*?)\]/.test(body)) {
    newBody = body.replace(
      /previewFeatures\s*=\s*\[(.*?)\]/,
      (m, current) => {
        const trimmed = current.trim();
        return trimmed.length > 0
          ? `previewFeatures = [${trimmed}, "prismaSchemaFolder"]`
          : `previewFeatures = ["prismaSchemaFolder"]`;
      }
    );
  } else {
    newBody += '\n  previewFeatures = ["prismaSchemaFolder"]';
  }

  return (
    coreSchemaText.substring(0, match.index) +
    newBody +
    match[2] +
    coreSchemaText.substring(match.index + match[0].length)
  );
}

/**
 * Adjusts the generator client output path to accurately target packages/database/src/generated/client
 * relative to wherever the schema file is written.
 */
export function adjustGeneratorClientOutput(
  schemaText: string,
  schemaFilePath: string,
  root: string
): string {
  const targetClientDir = join(root, 'packages', 'database', 'src', 'generated', 'client');
  let relPath = relative(dirname(schemaFilePath), targetClientDir).replace(/\\/g, '/');
  if (!relPath.startsWith('.')) {
    relPath = `./${relPath}`;
  }
  return schemaText.replace(/output\s*=\s*"[^"]*"/, `output   = "${relPath}"`);
}

/**
 * Injects relation fields into a target model inside a schema string safely (for backward compatibility).
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

export function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function findMonorepoRoot(start = process.cwd()): string {
  let curr = resolve(start);
  while (curr !== dirname(curr)) {
    if (existsSync(join(curr, 'pnpm-workspace.yaml'))) {
      return curr;
    }
    curr = dirname(curr);
  }
  return start;
}

/**
 * Main database composer function.
 * Composes both:
 * 1. Native Prisma 7 multi-file schema folder in `.generated/database/schema/`
 * 2. Legacy unified single-file schema in `.generated/database/schema.prisma`
 */
export function composeDatabaseSchema(options: DatabaseCompositionOptions = {}): DatabaseCompositionResult {
  const root = options.root ? resolve(options.root) : findMonorepoRoot(process.cwd());
  const coreSchemaPath = join(root, 'packages', 'database', 'prisma', 'schema.prisma');
  const modulesDir = join(root, 'modules');

  const outputPath = options.outputPath
    ? resolve(options.outputPath)
    : join(root, '.generated', 'database', 'schema.prisma');

  const schemaFolderPath = options.schemaFolderPath
    ? resolve(options.schemaFolderPath)
    : join(dirname(outputPath), 'schema');

  const manifestPath = join(schemaFolderPath, 'manifest.json');

  const migrationsOutputDir = options.migrationsOutputPath
    ? resolve(options.migrationsOutputPath)
    : join(root, '.generated', 'database', 'migrations');

  if (!existsSync(coreSchemaPath)) {
    throw new DatabaseCompositionError(
      `Core database schema not found at: ${coreSchemaPath}`,
      'CORE_SCHEMA_NOT_FOUND'
    );
  }

  // Read and enhance core schema with prismaSchemaFolder
  let coreSchemaText = readFileSync(coreSchemaPath, 'utf8');
  coreSchemaText = ensurePrismaSchemaFolderFeature(coreSchemaText);

  let composedSchema = coreSchemaText;
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

  const moduleFragments: Array<{
    moduleId: string;
    targetFilename: string;
    fragmentContent: string;
    models: string[];
    enums: string[];
  }> = [];

  if (existsSync(modulesDir)) {
    const entries = readdirSync(modulesDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const modName = entry.name;
      const modDir = join(modulesDir, modName);
      const contractPath = join(modDir, 'module.contract.json');

      let declaredSchemaFiles: string[] = [];
      let declaredRelationsFile: string | undefined;

      if (existsSync(contractPath)) {
        try {
          const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
          if (contract.isTestOnly) {
            // Test-only module: skip production schema composition
            continue;
          }
          if (contract.database && typeof contract.database === 'object') {
            if (Array.isArray(contract.database.schemaFiles)) {
              declaredSchemaFiles = contract.database.schemaFiles;
            } else if (contract.database.schemaFile) {
              declaredSchemaFiles = [contract.database.schemaFile];
            }
            if (contract.database.relationsFile) {
              declaredRelationsFile = contract.database.relationsFile;
            }
          }
        } catch {
          // ignore contract parse error, fallback to filesystem check
        }
      }

      // Fallback filesystem check if no contract declared schemas
      if (declaredSchemaFiles.length === 0) {
        const fallbackSchema = join(modDir, 'database', 'schema.prisma');
        if (existsSync(fallbackSchema)) {
          declaredSchemaFiles.push('database/schema.prisma');
        }
      }

      if (!declaredRelationsFile) {
        const fallbackRel = join(modDir, 'database', 'relations.contract.json');
        if (existsSync(fallbackRel)) {
          declaredRelationsFile = 'database/relations.contract.json';
        }
      }

      if (declaredSchemaFiles.length === 0 && !declaredRelationsFile) {
        continue;
      }

      modulesScanned.push(modName);

      // 1. Handle relations contract
      if (declaredRelationsFile) {
        const fullRelPath = join(modDir, declaredRelationsFile);
        if (existsSync(fullRelPath)) {
          try {
            const raw = JSON.parse(readFileSync(fullRelPath, 'utf8')) as RelationContractEntry[];
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
      }

      // 2. Handle schema files
      let combinedModuleSchema = '';
      for (const relSchemaFile of declaredSchemaFiles) {
        const fullSchemaFile = join(modDir, relSchemaFile);
        if (!existsSync(fullSchemaFile)) continue;

        const rawContent = readFileSync(fullSchemaFile, 'utf8');
        const cleaned = stripDatasourceAndGenerator(rawContent);
        if (cleaned.length === 0) continue;

        const fragmentModels = extractModelNames(cleaned);
        const fragmentEnums = extractEnumNames(cleaned);

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

        combinedModuleSchema += `\n${cleaned}\n`;
      }

      if (combinedModuleSchema.trim().length > 0) {
        // Deterministic prefix ordering for files
        const prefix = modName === 'workforce' ? '10' : modName === 'settings' ? '20' : '30';
        const targetFilename = `${prefix}-${modName}.prisma`;

        moduleFragments.push({
          moduleId: modName,
          targetFilename,
          fragmentContent: combinedModuleSchema.trim(),
          models: extractModelNames(combinedModuleSchema),
          enums: extractEnumNames(combinedModuleSchema),
        });
      }
    }
  }

  // Append module fragments to legacy single-file schema
  for (const frag of moduleFragments) {
    composedSchema += `\n\n// =============================================================\n`;
    composedSchema += `// Module Extension: ${frag.moduleId}\n`;
    composedSchema += `// =============================================================\n\n`;
    composedSchema += frag.fragmentContent + '\n';
  }

  // Calculate composite SHA-256
  const schemaHash = computeSha256(composedSchema);
  const generatedFiles: string[] = [];

  if (!options.dryRun) {
    // 1. Write legacy single-file schema
    mkdirSync(dirname(outputPath), { recursive: true });
    const adjustedComposed = adjustGeneratorClientOutput(composedSchema, outputPath, root);
    writeFileSync(outputPath, adjustedComposed, 'utf8');
    generatedFiles.push(outputPath);

    // 2. Write multi-file schema folder
    mkdirSync(schemaFolderPath, { recursive: true });

    // 00-core.prisma
    const coreOutFile = join(schemaFolderPath, '00-core.prisma');
    const adjustedCore = adjustGeneratorClientOutput(coreSchemaText, coreOutFile, root);
    writeFileSync(coreOutFile, adjustedCore, 'utf8');
    generatedFiles.push(coreOutFile);

    const manifestFiles: ManifestSchemaFileEntry[] = [
      {
        filename: '00-core.prisma',
        sourceModule: 'core',
        sha256: computeSha256(adjustedCore),
        models: Array.from(coreModelNames),
        enums: Array.from(coreEnumNames),
      },
    ];

    // Module prisma files
    for (const frag of moduleFragments) {
      const moduleOutFile = join(schemaFolderPath, frag.targetFilename);
      const header = `// =============================================================\n// Module Extension: ${frag.moduleId}\n// Generated deterministically by compose-database.ts\n// =============================================================\n\n`;
      const fullModContent = header + frag.fragmentContent + '\n';
      writeFileSync(moduleOutFile, fullModContent, 'utf8');
      generatedFiles.push(moduleOutFile);

      manifestFiles.push({
        filename: frag.targetFilename,
        sourceModule: frag.moduleId,
        sha256: computeSha256(fullModContent),
        models: frag.models,
        enums: frag.enums,
      });
    }

    // Write manifest.json
    const manifest = {
      version: '2.0.0',
      description: 'Sovereign Multi-File Database Schema Manifest (Work Plan 112)',
      generatedAt: new Date().toISOString(),
      compositeHash: schemaHash,
      totalModels: coreModelNames.size + moduleModelsCount,
      coreModelsCount: coreModelNames.size,
      moduleModelsCount,
      files: manifestFiles,
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    generatedFiles.push(manifestPath);

    // Synchronize migrations
    mkdirSync(migrationsOutputDir, { recursive: true });

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

    if (existsSync(modulesDir)) {
      for (const modName of modulesScanned) {
        const modMigDir = join(modulesDir, modName, 'database', 'migrations');
        if (!existsSync(modMigDir)) continue;

        const migEntries = readdirSync(modMigDir, { withFileTypes: true });
        for (const ent of migEntries) {
          if (!ent.isDirectory()) continue;
          const dstDir = join(migrationsOutputDir, ent.name);
          if (existsSync(dstDir)) {
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
      schemaFolderPath,
      manifestPath,
      schemaHash,
      coreModelsCount: coreModelNames.size,
      moduleModelsCount,
      injectedRelationsCount,
      totalMigrationsCount,
      modulesScanned,
      generatedFiles,
    };
  }

  return {
    schemaPath: outputPath,
    schemaFolderPath,
    manifestPath,
    schemaHash,
    coreModelsCount: coreModelNames.size,
    moduleModelsCount,
    injectedRelationsCount,
    totalMigrationsCount: 0,
    modulesScanned,
    generatedFiles: [],
  };
}

// CLI execution check
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log('🔄 Composing database schema and migrations...');
    const res = composeDatabaseSchema();
    console.log('✅ Database composed successfully:');
    console.log(`   Schema:             ${res.schemaPath}`);
    console.log(`   Schema Folder:      ${res.schemaFolderPath}`);
    console.log(`   Manifest:           ${res.manifestPath}`);
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
