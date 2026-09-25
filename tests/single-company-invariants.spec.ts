import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = process.cwd();

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.next' ||
        entry.name === '.turbo' ||
        entry.name === '.cache'
      ) {
        continue;
      }
      files.push(...listFilesRecursive(full));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(full);
    }
  }
  return files;
}

describe('Work Plan 110: Single-Company Architecture & Anti-Tenant Invariant Sentinel', () => {
  const schemaPath = join(ROOT_DIR, 'packages', 'database', 'prisma', 'schema.prisma');

  it('asserts packages/database/prisma/schema.prisma exists', () => {
    expect(existsSync(schemaPath)).toBe(true);
  });

  it('asserts model Tenant has been completely purged from schema.prisma', () => {
    const schemaContent = readFileSync(schemaPath, 'utf8');
    expect(schemaContent).not.toMatch(/\bmodel\s+Tenant\b/);
  });

  it('asserts tenantId column has been purged from all tables in schema.prisma', () => {
    const schemaContent = readFileSync(schemaPath, 'utf8');
    const lines = schemaContent.split(/\r?\n/);
    const tenantIdLines = lines.filter((l) => /^\s*tenantId\b/.test(l));
    expect(tenantIdLines).toEqual([]);
  });

  it('asserts tenant relation has been purged from all models in schema.prisma', () => {
    const schemaContent = readFileSync(schemaPath, 'utf8');
    const lines = schemaContent.split(/\r?\n/);
    const tenantRelationLines = lines.filter((l) => /^\s*tenant\s+Tenant\b/.test(l));
    expect(tenantRelationLines).toEqual([]);
  });

  it('asserts CompanyProfile exists as a singleton model in schema.prisma', () => {
    const schemaContent = readFileSync(schemaPath, 'utf8');
    expect(schemaContent).toMatch(/\bmodel\s+CompanyProfile\b/);
  });

  it('asserts no active code in apps/ and modules/ queries prisma.tenant or tx.tenant', () => {
    const files = [
      ...listFilesRecursive(join(ROOT_DIR, 'apps')),
      ...listFilesRecursive(join(ROOT_DIR, 'modules')),
    ];

    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/\b(prisma|tx)\.tenant\b/.test(line)) {
          violations.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('asserts no active code in apps/ and modules/ includes tenant relation', () => {
    const files = [
      ...listFilesRecursive(join(ROOT_DIR, 'apps')),
      ...listFilesRecursive(join(ROOT_DIR, 'modules')),
    ];

    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/include:\s*\{\s*tenant:\s*true\s*\}/.test(line)) {
          violations.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('asserts no active code in apps/ and modules/ references .tenantId', () => {
    const files = [
      ...listFilesRecursive(join(ROOT_DIR, 'apps')),
      ...listFilesRecursive(join(ROOT_DIR, 'modules')),
    ];

    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        const stripped = line.replace(/\/\/.*$/, '').trim();
        if (/\b(?:\w+)\.tenantId\b/.test(stripped)) {
          violations.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
