import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = process.cwd();

describe('Work Plan 110: Documentation Reality Parity & Anti-Hallucination Sentinel', () => {
  it('asserts every script target in package.json physically exists on disk', () => {
    const pkgJsonPath = join(ROOT_DIR, 'package.json');
    expect(existsSync(pkgJsonPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
      scripts: Record<string, string>;
    };

    const missingTargets: string[] = [];
    for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts)) {
      const match = scriptCmd.match(/\b(?:tsx|ts-node|node)\s+([a-zA-Z0-9_./-]+\.(?:ts|js))\b/);
      if (match && match[1]) {
        const relPath = match[1];
        const fullPath = join(ROOT_DIR, relPath);
        if (!existsSync(fullPath)) {
          missingTargets.push(`${scriptName} -> ${relPath}`);
        }
      }
    }

    expect(missingTargets).toEqual([]);
  });

  it('asserts README.md contains zero SQLite references or badges', () => {
    const readmePath = join(ROOT_DIR, 'README.md');
    expect(existsSync(readmePath)).toBe(true);

    const readme = readFileSync(readmePath, 'utf8');
    expect(readme).not.toMatch(/logo=sqlite/i);
    expect(readme).not.toMatch(/\bSQLite\b/i);
  });

  it('asserts README.md references Prisma 7.x and not Prisma 6.x', () => {
    const readmePath = join(ROOT_DIR, 'README.md');
    const readme = readFileSync(readmePath, 'utf8');

    expect(readme).not.toMatch(/Prisma\s+6\./i);
    expect(readme).toMatch(/Prisma\s+7\./i);
  });

  it('asserts README.md accurately documents @grammyjs/runner polling and not Hono Webhook', () => {
    const readmePath = join(ROOT_DIR, 'README.md');
    const readme = readFileSync(readmePath, 'utf8');

    expect(readme).not.toMatch(/Hono\s+Webhook\s+Server/i);
    expect(readme).toMatch(/grammY\s+Polling\s+Engine/i);
  });

  it('asserts README.md architecture tree documents the full monorepo reality', () => {
    const readmePath = join(ROOT_DIR, 'README.md');
    const readme = readFileSync(readmePath, 'utf8');

    expect(readme).toContain('admin-dashboard');
    expect(readme).toContain('telemetry');
    expect(readme).toContain('rbac');
    expect(readme).toContain('sandbox');
    expect(readme).toContain('google-engine');
  });

  it('asserts docs/06 aligns with Single-Company Architecture and pnpm system:provision', () => {
    const doc06Path = join(ROOT_DIR, 'docs', '06-tenant-onboarding-and-provisioning-wizard.md');
    expect(existsSync(doc06Path)).toBe(true);

    const content = readFileSync(doc06Path, 'utf8');
    expect(content).toContain('Single-Company');
    expect(content).toContain('pnpm system:provision');
    expect(content).not.toContain('tenant:init');
  });
});
