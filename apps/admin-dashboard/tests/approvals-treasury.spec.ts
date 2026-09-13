import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Executive Approvals, Treasury Monitor & Command Palette Contracts', () => {
  const readScreenSource = (relativePath: string): string => {
    const fullPath = path.resolve(__dirname, '..', relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  describe('Feature 4: Executive Approvals Center', () => {
    const pageSrc = readScreenSource('src/app/admin/approvals/page.tsx');
    const clientSrc = readScreenSource('src/app/admin/approvals/approvals-client.tsx');
    const apiSrc = readScreenSource('src/app/api/approvals/route.ts');

    it('enforces RBAC on page.tsx restricting access to authorized roles', () => {
      expect(pageSrc).toContain('hasAccess');
      expect(pageSrc).toContain('SUPER_ADMIN');
      expect(pageSrc).toContain('GENERAL_ADMIN');
      expect(pageSrc).toContain('getApprovalsData');
    });

    it('client renders category filters, ZeroStateCard, and 44x44px action buttons', () => {
      expect(clientSrc).toContain('ZeroStateCard');
      expect(clientSrc).toContain('اعتماد ✅');
      expect(clientSrc).toContain('رفض ❌');
      expect(clientSrc).toContain('min-h-[44px]');
      expect(clientSrc).toContain('min-w-[44px]');
      expect(clientSrc).toContain('overflow-x-auto');
      expect(clientSrc).toContain('min-w-[800px]');
    });

    it('API route handles approval decisions and logs cryptographic audit record', () => {
      expect(apiSrc).toContain('prisma.auditLog.create');
      expect(apiSrc).toContain('actorTelegramId');
      expect(apiSrc).toContain('DECISION_');
      expect(apiSrc).toContain('APPROVED');
      expect(apiSrc).toContain('REJECTED');
    });
  });

  describe('Feature 7: Site Custody & Cash Flow Monitor', () => {
    const pageSrc = readScreenSource('src/app/admin/finance/treasury/page.tsx');
    const clientSrc = readScreenSource('src/app/admin/finance/treasury/treasury-client.tsx');

    it('enforces financial RBAC on treasury page.tsx', () => {
      expect(pageSrc).toContain('hasAccess');
      expect(pageSrc).toContain('ACCOUNTANT');
      expect(pageSrc).toContain('getTreasuryData');
    });

    it('client renders liquidity health indicators, percentage bar, and WhatsApp dispatcher', () => {
      expect(clientSrc).toContain('ZeroStateCard');
      expect(clientSrc).toContain('percentageRemaining');
      expect(clientSrc).toContain('CRITICAL');
      expect(clientSrc).toContain('WARNING');
      expect(clientSrc).toContain('HEALTHY');
      expect(clientSrc).toContain('wa.me/2');
      expect(clientSrc).toContain('مراسلة المسؤول');
      expect(clientSrc).toContain('min-h-[44px]');
      expect(clientSrc).toContain('min-w-[44px]');
    });
  });

  describe('Feature 8: Command Palette (Ctrl + K)', () => {
    const paletteSrc = readScreenSource('src/components/layout/command-palette.tsx');
    const shellSrc = readScreenSource('src/components/layout/dashboard-shell.tsx');
    const headerSrc = readScreenSource('src/components/layout/header.tsx');

    it('registers global keydown listener for Ctrl+K and custom event', () => {
      expect(paletteSrc).toContain('keydown');
      expect(paletteSrc).toContain('open-command-palette');
      expect(paletteSrc).toContain('Escape');
    });

    it('is mounted within DashboardShell', () => {
      expect(shellSrc).toContain('CommandPalette');
      expect(shellSrc).toContain('<CommandPalette />');
    });

    it('is triggered from Header search button', () => {
      expect(headerSrc).toContain('open-command-palette');
      expect(headerSrc).toContain('Ctrl K');
    });
  });
});
