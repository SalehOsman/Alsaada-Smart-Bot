import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  checkDestructiveCoreDDL,
  validateMigrations,
  computeFileSha256,
} from '../validate-migrations.js';

describe('Work Plan 89 — Migration Validation & DDL Safety (Phase P5)', () => {
  const testDir = path.resolve(process.cwd(), 'tmp-test-migration-upgrade');

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('detects forbidden DROP TABLE statements on core tables', () => {
    const dangerousSql = `
      DROP TABLE "users";
      DROP TABLE IF EXISTS "workers";
      CREATE TABLE "sample_records" (id text primary key);
    `;

    const violations = checkDestructiveCoreDDL(dangerousSql, ['sample_records']);
    expect(violations.length).toBe(2);
    expect(violations[0]).toContain("Forbidden DROP TABLE statement on table 'users'");
    expect(violations[1]).toContain("Forbidden DROP TABLE statement on table 'workers'");
  });

  it('detects forbidden ALTER TABLE DROP COLUMN statements on core tables', () => {
    const dangerousSql = `
      ALTER TABLE "workers" DROP COLUMN "phone";
      ALTER TABLE "sample_records" DROP COLUMN "temp_col";
    `;

    const violations = checkDestructiveCoreDDL(dangerousSql, ['sample_records']);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("Forbidden ALTER TABLE DROP COLUMN statement on table 'workers'");
  });

  it('validates module migration contracts and flags checksum mismatches', () => {
    const coreMigDir = path.join(testDir, 'packages', 'database', 'prisma', 'migrations', '20260101_init');
    fs.mkdirSync(coreMigDir, { recursive: true });
    fs.writeFileSync(path.join(coreMigDir, 'migration.sql'), '-- init core sql', 'utf8');

    const modMigDir = path.join(
      testDir,
      'modules',
      'sample-domain',
      'database',
      'migrations',
      '20260921120000_sample_init'
    );
    fs.mkdirSync(modMigDir, { recursive: true });
    const sqlPath = path.join(modMigDir, 'migration.sql');
    fs.writeFileSync(sqlPath, 'CREATE TABLE "sample_items" (id text);', 'utf8');

    const actualSha = computeFileSha256(sqlPath);

    // Write valid contract
    fs.writeFileSync(
      path.join(modMigDir, 'migration.contract.json'),
      JSON.stringify({
        id: '20260921120000_sample_init',
        moduleId: 'sample-domain',
        description: 'Sample domain initial schema migration',
        dependencies: [],
        compatibility: 'backward_compatible',
        rollbackStrategy: 'DROP TABLE IF EXISTS "sample_items";',
        checksum: actualSha,
      }),
      'utf8'
    );

    const result = validateMigrations(testDir);
    expect(result.valid).toBe(true);
    expect(result.coreMigrationsCount).toBe(1);
    expect(result.moduleMigrationsCount).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('rejects module migration with altered checksum drift', () => {
    const modMigDir = path.join(
      testDir,
      'modules',
      'sample-domain',
      'database',
      'migrations',
      '20260921120000_sample_init'
    );
    fs.mkdirSync(modMigDir, { recursive: true });
    fs.writeFileSync(path.join(modMigDir, 'migration.sql'), 'CREATE TABLE "sample_items" (id text);', 'utf8');

    fs.writeFileSync(
      path.join(modMigDir, 'migration.contract.json'),
      JSON.stringify({
        id: '20260921120000_sample_init',
        moduleId: 'sample-domain',
        description: 'Tampered migration',
        dependencies: [],
        compatibility: 'backward_compatible',
        rollbackStrategy: 'NONE',
        checksum: 'tampered-fake-sha256-hash',
      }),
      'utf8'
    );

    const result = validateMigrations(testDir);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Checksum mismatch');
  });
});
