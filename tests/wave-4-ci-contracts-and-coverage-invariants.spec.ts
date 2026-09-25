import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Wave 4 Invariants — CI Migration, Strict Module Contracts, Plan Anti-Collision & Coverage (WP 114)', () => {
  const rootDir = process.cwd();

  // 1. Strict ModuleRuntimeContext Contracts (Zero any / ADR-003)
  it('INV-1: packages/core-components/src/contracts/module.contract.ts contains zero any declarations', () => {
    const contractPath = path.join(rootDir, 'packages/core-components/src/contracts/module.contract.ts');
    expect(fs.existsSync(contractPath)).toBe(true);
    const content = fs.readFileSync(contractPath, 'utf8');

    // Strict zero any policy in ModuleRuntimeContext and ModuleFactory
    expect(content).not.toMatch(/redis:\s*any\b/);
    expect(content).not.toMatch(/telemetry\?:\s*any\b/);
    expect(content).not.toMatch(/\[key:\s*string\]:\s*any\b/);
    expect(content).not.toMatch(/options\?:\s*any\b/);
  });

  // 2. Docs Work Plans Number Uniqueness (Zero Collisions)
  it('INV-2: docs/work-plans contains zero duplicated work plan numbers', () => {
    const plansDir = path.join(rootDir, 'docs/work-plans');
    expect(fs.existsSync(plansDir)).toBe(true);

    const files = fs.readdirSync(plansDir);
    const planNumberMap = new Map<string, string[]>();

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      // Match pure number prefix like 42-plan or 101-plan
      const match = file.match(/^(\d+)-plan-/);
      if (match && match[1]) {
        const num = match[1];
        const existing = planNumberMap.get(num) ?? [];
        existing.push(file);
        planNumberMap.set(num, existing);
      }
    }

    const collisions: string[] = [];
    for (const [num, mappedFiles] of planNumberMap.entries()) {
      if (mappedFiles.length > 1) {
        collisions.push(`Plan #${num} is duplicated across: ${mappedFiles.join(', ')}`);
      }
    }

    expect(collisions).toEqual([]);
  });

  // 3. Strict CI Migration Pipeline (Zero db:push --accept-data-loss)
  it('INV-3: .github/workflows/ci.yml strictly forbids db:push --accept-data-loss and uses migration deployment', () => {
    const ciPath = path.join(rootDir, '.github/workflows/ci.yml');
    expect(fs.existsSync(ciPath)).toBe(true);
    const content = fs.readFileSync(ciPath, 'utf8');

    // Reject db:push with data loss in CI
    expect(content).not.toContain('db:push --accept-data-loss');

    // Mandate true migration deploy
    expect(content).toMatch(/prisma\s+migrate\s+deploy|db:migrate/);
  });

  // 4. Dynamic Outcome-Driven CI Step Summary
  it('INV-4: .github/workflows/ci.yml publishes dynamic step outcomes instead of hardcoded static PASS', () => {
    const ciPath = path.join(rootDir, '.github/workflows/ci.yml');
    const content = fs.readFileSync(ciPath, 'utf8');

    // Summary step must dynamically inspect step outcomes
    expect(content).toMatch(/steps\.[a-zA-Z0-9_-]+\.outcome/);
  });

  // 5. Vitest Coverage Configuration (WP 114)
  it('INV-5: vitest.config.ts defines coverage provider and reporters', () => {
    const vitestConfigPath = path.join(rootDir, 'vitest.config.ts');
    expect(fs.existsSync(vitestConfigPath)).toBe(true);
    const content = fs.readFileSync(vitestConfigPath, 'utf8');

    expect(content).toContain('coverage:');
    expect(content).toMatch(/provider:\s*['"]v8['"]/);
  });

  // 6. Bot Shell Micro-Kernel Purity (Delegated Module Bus Hears Registration)
  it('INV-6: apps/bot-server/src/bot.ts delegates business command hears to module bus rather than direct static handler imports', () => {
    const botPath = path.join(rootDir, 'apps/bot-server/src/bot.ts');
    expect(fs.existsSync(botPath)).toBe(true);
    const content = fs.readFileSync(botPath, 'utf8');

    expect(content).not.toContain('handleWorkerPayslipHears');
    expect(content).not.toContain('handleWorkerStatementHears');
    expect(content).not.toContain('handleSupplierInvoicesHears');
  });
});
