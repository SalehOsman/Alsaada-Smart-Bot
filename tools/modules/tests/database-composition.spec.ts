import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  extractModelNames,
  extractEnumNames,
  injectRelationIntoModel,
  composeDatabaseSchema,
  DatabaseCompositionError,
} from '../compose-database.js';

describe('Work Plan 89 — DMMF AST Database Composition (Phase P5)', () => {
  const testDir = path.resolve(process.cwd(), 'tmp-test-db-composition');

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('extracts model and enum names accurately from prisma schema', () => {
    const sampleSchema = `
      datasource db {
        provider = "postgresql"
      }

      enum UserRole {
        ADMIN
        WORKER
      }

      model User {
        id String @id
      }

      model WorkerProfile {
        id String @id
      }
    `;

    const models = extractModelNames(sampleSchema);
    expect(models).toEqual(['User', 'WorkerProfile']);

    const enums = extractEnumNames(sampleSchema);
    expect(enums).toEqual(['UserRole']);
  });

  it('injects relation fields cleanly into target model AST without modifying original', () => {
    const originalSchema = `
      model Worker {
        id String @id
        name String

        @@map("workers")
      }
    `;

    const modified = injectRelationIntoModel(
      originalSchema,
      'Worker',
      'sampleRecords',
      'SampleRecord[]',
      '@relation("WorkerSampleRecords")'
    );

    expect(modified).toContain('sampleRecords SampleRecord[] @relation("WorkerSampleRecords")');
    expect(modified).toContain('@@map("workers")');
  });

  it('throws TARGET_MODEL_NOT_FOUND if target model is absent', () => {
    const originalSchema = `
      model Worker {
        id String @id
      }
    `;

    expect(() =>
      injectRelationIntoModel(originalSchema, 'NonExistentModel', 'field', 'String')
    ).toThrowError(DatabaseCompositionError);
  });

  it('throws DUPLICATE_FIELD_NAME if injected field already exists', () => {
    const originalSchema = `
      model Worker {
        id String @id
        name String
      }
    `;

    expect(() =>
      injectRelationIntoModel(originalSchema, 'Worker', 'name', 'String')
    ).toThrowError(DatabaseCompositionError);
  });

  it('composes core database schema with module extensions deterministically', () => {
    // Setup isolated test workspace
    const coreSchemaDir = path.join(testDir, 'packages', 'database', 'prisma');
    fs.mkdirSync(coreSchemaDir, { recursive: true });
    fs.writeFileSync(
      path.join(coreSchemaDir, 'schema.prisma'),
      `
      datasource db {
        provider = "postgresql"
      }

      model Worker {
        id String @id
        name String
      }
      `,
      'utf8'
    );

    const moduleDbDir = path.join(testDir, 'modules', 'sample-domain', 'database');
    fs.mkdirSync(moduleDbDir, { recursive: true });
    fs.writeFileSync(
      path.join(moduleDbDir, 'schema.prisma'),
      `
      model SampleRecord {
        id String @id
        workerId String
        title String
      }
      `,
      'utf8'
    );

    fs.writeFileSync(
      path.join(moduleDbDir, 'relations.contract.json'),
      JSON.stringify([
        {
          targetModel: 'Worker',
          fieldName: 'sampleRecords',
          fieldType: 'SampleRecord[]',
        },
      ]),
      'utf8'
    );

    const outSchema = path.join(testDir, '.generated', 'database', 'schema.prisma');
    const result = composeDatabaseSchema({
      root: testDir,
      outputPath: outSchema,
    });

    expect(result.coreModelsCount).toBe(1);
    expect(result.moduleModelsCount).toBe(1);
    expect(result.injectedRelationsCount).toBe(1);
    expect(result.modulesScanned).toContain('sample-domain');
    expect(result.schemaHash.length).toBe(64);

    const outputContent = fs.readFileSync(outSchema, 'utf8');
    expect(outputContent).toContain('model SampleRecord');
    expect(outputContent).toContain('sampleRecords SampleRecord[]');
  });

  it('rejects duplicate model collision between module and core', () => {
    const coreSchemaDir = path.join(testDir, 'packages', 'database', 'prisma');
    fs.mkdirSync(coreSchemaDir, { recursive: true });
    fs.writeFileSync(
      path.join(coreSchemaDir, 'schema.prisma'),
      `
      model Worker {
        id String @id
      }
      `,
      'utf8'
    );

    const moduleDbDir = path.join(testDir, 'modules', 'sample-domain', 'database');
    fs.mkdirSync(moduleDbDir, { recursive: true });
    fs.writeFileSync(
      path.join(moduleDbDir, 'schema.prisma'),
      `
      model Worker {
        id String @id
      }
      `,
      'utf8'
    );

    expect(() =>
      composeDatabaseSchema({
        root: testDir,
      })
    ).toThrowError(/Model name collision/);
  });
});
