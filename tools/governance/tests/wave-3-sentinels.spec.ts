import { describe, it, expect } from 'vitest';
import { verifySingleTenantInvariants } from '../verify-single-tenant-invariants.js';
import { verifyBotServerPurity } from '../verify-bot-server-purity.js';
import { verifyDocRealityParity } from '../verify-doc-reality-parity.js';
import { resolvePayrollAccountingMonth } from '../../../modules/workforce/src/hub/worker-self-service.handler.js';

describe('Wave 3 Permanent Anti-Drift Governance Sentinels (WP 113)', () => {
  it('verifySingleTenantInvariants passes across all monorepo schemas and code', () => {
    const res = verifySingleTenantInvariants();
    expect(res.ok).toBe(true);
    expect(res.violations).toEqual([]);
    expect(res.checkedFiles).toBeGreaterThan(100);
  });

  it('verifyBotServerPurity passes on actual apps/bot-server/src/bot.ts', () => {
    const res = verifyBotServerPurity();
    expect(res.ok).toBe(true);
    expect(res.violations).toEqual([]);
  });

  it('verifyBotServerPurity catches forbidden prisma imports, domain queries, and raw string replies', () => {
    const dirtySource = `
      import { prisma } from './db.js';
      export async function badHandler(ctx: any) {
        const w = await prisma.worker.findUnique({ where: { id: '1' } });
        await ctx.reply('Raw unvalidated string');
      }
    `;
    const res = verifyBotServerPurity(process.cwd(), dirtySource);
    expect(res.ok).toBe(false);
    expect(res.violations.length).toBe(3);
    expect(res.violations[0]).toContain('Direct import of "prisma"');
    expect(res.violations[1]).toContain('prisma.worker');
    expect(res.violations[2]).toContain('Raw inline string literal in "ctx.reply(...)"');
  });

  it('verifyDocRealityParity passes across all package.json scripts and documentation', () => {
    const res = verifyDocRealityParity();
    expect(res.ok).toBe(true);
    expect(res.violations).toEqual([]);
    expect(res.checkedScripts).toBeGreaterThan(50);
  });

  it('resolvePayrollAccountingMonth enforces Egyptian 26th-to-25th payroll boundaries', () => {
    // 25th of September stays in 2026-09
    expect(resolvePayrollAccountingMonth(new Date('2026-09-25T12:00:00Z'))).toBe('2026-09');
    // 26th of September rolls into 2026-10 cycle
    expect(resolvePayrollAccountingMonth(new Date('2026-09-26T12:00:00Z'))).toBe('2026-10');
    // 26th of December rolls into next year January 2027-01
    expect(resolvePayrollAccountingMonth(new Date('2026-12-26T12:00:00Z'))).toBe('2027-01');
  });
});
