/**
 * Wave 2 Database Composition Invariants Test Suite (Work Plan 112)
 *
 * Verifies:
 * 1. Multi-file prismaSchemaFolder composition (.generated/database/schema/*.prisma)
 * 2. Deterministic cryptographic SHA-256 manifest generation
 * 3. Stripping of duplicate datasource/generator from module fragments
 * 4. Model collision rejection across modules and core
 * 5. Test-only module exclusion (zero leakage from sandbox)
 * 6. Deterministic reproducibility across repeated runs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  composeDatabaseSchema,
  stripDatasourceAndGenerator,
  ensurePrismaSchemaFolderFeature,
  DatabaseCompositionError,
  type DatabaseCompositionResult,
} from '../tools/modules/compose-database.js';

describe('Wave 2 Invariants — Modular Database Schema & prismaSchemaFolder (WP 112)', () => {
  const testRoot = path.resolve(process.cwd(), 'tmp-wave-2-composition-test');

  beforeEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    fs.mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  function setupWorkspace(options: {
    coreModels?: string[];
    workforceModels?: string[];
    settingsModels?: string[];
    sandboxModels?: string[];
  } = {}) {
    // 1. Core database schema
    const coreDir = path.join(testRoot, 'packages', 'database', 'prisma');
    fs.mkdirSync(coreDir, { recursive: true });

    const coreModelText = (options.coreModels ?? ['CompanyProfile', 'FinancialLedger'])
      .map((m) => `model ${m} {\n  id String @id\n}\n`)
      .join('\n');

    fs.writeFileSync(
      path.join(coreDir, 'schema.prisma'),
      `
generator client {
  provider = "prisma-client"
  output   = "../src/generated/client"
}

datasource db {
  provider = "postgresql"
}

${coreModelText}
      `,
      'utf8'
    );

    // 2. Workforce module
    if (options.workforceModels) {
      const wfDir = path.join(testRoot, 'modules', 'workforce');
      fs.mkdirSync(path.join(wfDir, 'database'), { recursive: true });
      fs.writeFileSync(
        path.join(wfDir, 'module.contract.json'),
        JSON.stringify({
          schemaVersion: '2.0.0',
          id: 'workforce',
          version: '2.0.0',
          titleArabic: 'شؤون العاملين',
          descriptionArabic: 'وحدة الموارد البشرية',
          category: 'operations',
          status: 'active',
          callbackPrefixes: ['workforce:'],
          database: {
            schemaFiles: ['database/schema.prisma'],
          },
        }),
        'utf8'
      );
      fs.writeFileSync(
        path.join(wfDir, 'database', 'schema.prisma'),
        options.workforceModels.map((m) => `model ${m} {\n  id String @id\n}\n`).join('\n'),
        'utf8'
      );
    }

    // 3. Settings module
    if (options.settingsModels) {
      const setDir = path.join(testRoot, 'modules', 'settings');
      fs.mkdirSync(path.join(setDir, 'database'), { recursive: true });
      fs.writeFileSync(
        path.join(setDir, 'module.contract.json'),
        JSON.stringify({
          schemaVersion: '2.0.0',
          id: 'settings',
          version: '2.0.0',
          titleArabic: 'الإعدادات السيادية',
          descriptionArabic: 'وحدة الإعدادات',
          category: 'operations',
          status: 'active',
          callbackPrefixes: ['settings:'],
          database: {
            schemaFiles: ['database/schema.prisma'],
          },
        }),
        'utf8'
      );
      fs.writeFileSync(
        path.join(setDir, 'database', 'schema.prisma'),
        options.settingsModels.map((m) => `model ${m} {\n  id String @id\n}\n`).join('\n'),
        'utf8'
      );
    }

    // 4. Sandbox test-only module
    if (options.sandboxModels) {
      const sbDir = path.join(testRoot, 'modules', 'sandbox');
      fs.mkdirSync(path.join(sbDir, 'database'), { recursive: true });
      fs.writeFileSync(
        path.join(sbDir, 'module.contract.json'),
        JSON.stringify({
          schemaVersion: '2.0.0',
          id: 'sandbox',
          version: '1.0.0',
          titleArabic: 'مختبر التجارب',
          descriptionArabic: 'وحدة تجريبية معزولة',
          category: 'operations',
          status: 'active',
          isTestOnly: true,
          callbackPrefixes: ['sandbox:'],
          database: {
            schemaFiles: [],
          },
        }),
        'utf8'
      );
      fs.writeFileSync(
        path.join(sbDir, 'database', 'schema.prisma'),
        options.sandboxModels.map((m) => `model ${m} {\n  id String @id\n}\n`).join('\n'),
        'utf8'
      );
    }
  }

  it('01: generates multi-file schema folder with 00-core, 10-workforce, and 20-settings', () => {
    setupWorkspace({
      coreModels: ['CompanyProfile', 'FinancialLedger'],
      workforceModels: ['Worker', 'Department'],
      settingsModels: ['BotMenuPermission'],
    });

    const result = composeDatabaseSchema({ root: testRoot });

    expect(result.coreModelsCount).toBe(2);
    expect(result.moduleModelsCount).toBe(3);
    expect(result.modulesScanned).toContain('workforce');
    expect(result.modulesScanned).toContain('settings');

    const schemaDir = path.join(testRoot, '.generated', 'database', 'schema');
    expect(fs.existsSync(path.join(schemaDir, '00-core.prisma'))).toBe(true);
    expect(fs.existsSync(path.join(schemaDir, '10-workforce.prisma'))).toBe(true);
    expect(fs.existsSync(path.join(schemaDir, '20-settings.prisma'))).toBe(true);
    expect(fs.existsSync(path.join(schemaDir, 'manifest.json'))).toBe(true);

    // Verify 00-core.prisma has previewFeatures = ["prismaSchemaFolder"]
    const coreContent = fs.readFileSync(path.join(schemaDir, '00-core.prisma'), 'utf8');
    expect(coreContent).toContain('prismaSchemaFolder');
  });

  it('02: generates deterministic manifest.json with SHA-256 for each file', () => {
    setupWorkspace({
      coreModels: ['CompanyProfile'],
      workforceModels: ['Worker'],
    });

    const result1 = composeDatabaseSchema({ root: testRoot });
    const manifestPath = path.join(testRoot, '.generated', 'database', 'schema', 'manifest.json');
    const manifest1 = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest1.version).toBe('2.0.0');
    expect(manifest1.compositeHash).toBe(result1.schemaHash);
    expect(manifest1.files.length).toBe(2);
    expect(manifest1.files[0].filename).toBe('00-core.prisma');
    expect(manifest1.files[1].filename).toBe('10-workforce.prisma');

    // Deterministic replay
    const result2 = composeDatabaseSchema({ root: testRoot });
    expect(result2.schemaHash).toBe(result1.schemaHash);
  });

  it('03: strips redundant datasource and generator blocks from module schemas', () => {
    const rawModuleSchema = `
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client"
}

model CustomDomainModel {
  id String @id
}
    `;

    const cleaned = stripDatasourceAndGenerator(rawModuleSchema);
    expect(cleaned).not.toContain('datasource db');
    expect(cleaned).not.toContain('generator client');
    expect(cleaned).toContain('model CustomDomainModel');
  });

  it('04: excludes test-only modules (sandbox) from production schema composition', () => {
    setupWorkspace({
      coreModels: ['CompanyProfile'],
      workforceModels: ['Worker'],
      sandboxModels: ['LeakedSandboxModel'],
    });

    const result = composeDatabaseSchema({ root: testRoot });
    expect(result.modulesScanned).not.toContain('sandbox');

    const manifestPath = path.join(testRoot, '.generated', 'database', 'schema', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const allModels = manifest.files.flatMap((f: any) => f.models);
    expect(allModels).not.toContain('LeakedSandboxModel');
  });

  it('05: rejects duplicate model name collision across modules and core', () => {
    setupWorkspace({
      coreModels: ['Worker'],
      workforceModels: ['Worker'],
    });

    expect(() => composeDatabaseSchema({ root: testRoot })).toThrowError(
      DatabaseCompositionError
    );
  });
});
