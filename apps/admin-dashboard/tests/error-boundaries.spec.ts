import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GlobalError from '../src/app/global-error';
import ErrorBoundary from '../src/app/error';
import NotFound from '../src/app/not-found';
import { deriveIncidentCode } from '@alsaada/telemetry';
import fs from 'node:fs';
import path from 'node:path';

describe('Admin Dashboard Error Boundaries & Telemetry Integration (Milestone 2 - Phase 2)', () => {
  describe('GlobalError (Root Layout Error Boundary)', () => {
    it('renders root html and body with RTL and Arabic metadata', () => {
      const mockReset = vi.fn();
      const mockError = new Error('Test Root Layout Crash');
      const html = renderToStaticMarkup(
        React.createElement(GlobalError, { error: mockError, reset: mockReset })
      );

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('lang="ar"');
      expect(html).toContain('<html');
      expect(html).toContain('<body');
      expect(html).toContain('عطل غير متوقع في النظام');
    });

    it('derives and displays a standard TRC- incident code from error.digest', () => {
      const mockReset = vi.fn();
      const mockError = Object.assign(new Error('Digest Crash'), { digest: 'B91DEB4D9999' });
      const html = renderToStaticMarkup(
        React.createElement(GlobalError, { error: mockError, reset: mockReset })
      );

      const expectedCode = deriveIncidentCode('B91DEB4D9999');
      expect(expectedCode).toBe('TRC-B91DEB4D');
      expect(html).toContain(expectedCode);
      expect(html).toContain('رمز البلاغ المرجعي الموحد');
    });

    it('derives a fallback incident code when error.digest is undefined', () => {
      const mockReset = vi.fn();
      const mockError = new Error('No Digest Error');
      const html = renderToStaticMarkup(
        React.createElement(GlobalError, { error: mockError, reset: mockReset })
      );

      expect(html).toMatch(/TRC-[A-Z0-9]{8}/);
    });

    it('renders retry button and home link', () => {
      const mockReset = vi.fn();
      const mockError = new Error('Action Check');
      const html = renderToStaticMarkup(
        React.createElement(GlobalError, { error: mockError, reset: mockReset })
      );

      expect(html).toContain('إعادة المحاولة');
      expect(html).toContain('الرئيسية');
      expect(html).toContain('href="/"');
      expect(html).toContain('data-testid="retry-button"');
    });
  });

  describe('ErrorBoundary (App Router Route Error Boundary)', () => {
    it('renders route-level styled Arabic error alert', () => {
      const mockReset = vi.fn();
      const mockError = new Error('Database Fetch Timeout');
      const html = renderToStaticMarkup(
        React.createElement(ErrorBoundary, { error: mockError, reset: mockReset })
      );

      expect(html).toContain('عطل غير متوقع في لوحة التحكم');
      expect(html).toContain('تعذر إتمام طلبك الحالي');
      expect(html).toContain('رمز البلاغ المرجعي الموحد');
      expect(html).toContain('إعادة المحاولة');
      expect(html).toContain('href="/"');
    });

    it('derives standard incident code from trace / digest', () => {
      const mockReset = vi.fn();
      const mockError = Object.assign(new Error('Route Failure'), { digest: 'TRACE_ROUTE_555' });
      const html = renderToStaticMarkup(
        React.createElement(ErrorBoundary, { error: mockError, reset: mockReset })
      );

      const expectedCode = deriveIncidentCode('TRACE_ROUTE_555');
      expect(html).toContain(expectedCode);
      expect(expectedCode.startsWith('TRC-')).toBe(true);
    });

    it('renders retry trigger button and testid in markup', () => {
      const mockReset = vi.fn();
      const mockError = new Error('Reset Test');
      const html = renderToStaticMarkup(
        React.createElement(ErrorBoundary, { error: mockError, reset: mockReset })
      );

      expect(html).toContain('data-testid="retry-button"');
      expect(html).toContain('إعادة المحاولة');
    });
  });

  describe('NotFound (404 Page)', () => {
    it('renders clean Arabic 404 UI with home navigation', () => {
      const html = renderToStaticMarkup(React.createElement(NotFound, {}));

      expect(html).toContain('404');
      expect(html).toContain('الصفحة المطلوبة غير موجودة');
      expect(html).toContain('عذراً، لم نتمكن من العثور على المسار المطلوب');
      expect(html).toContain('العودة للرئيسية');
      expect(html).toContain('href="/"');
      expect(html).toContain('data-testid="return-home-button"');
    });
  });

  describe('Next.js Cache Collision & Isolation Configuration', () => {
    it('verifies next.config.ts distDir isolation logic and transpilePackages', async () => {
      const configPath = path.resolve(__dirname, '../next.config.ts');
      const content = fs.readFileSync(configPath, 'utf8');

      // Check distDir conditional logic
      expect(content).toContain("distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next'");
      // Check @alsaada/telemetry in transpilePackages
      expect(content).toContain("'@alsaada/telemetry'");
    });

    it('verifies package.json scripts clean, predev, and prebuild', () => {
      const pkgPath = path.resolve(__dirname, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      expect(pkg.scripts.clean).toBe('rimraf .next .next-dev');
      expect(pkg.scripts.predev).toBe('pnpm clean');
      expect(pkg.scripts.prebuild).toBe('pnpm clean');
      expect(pkg.devDependencies.rimraf).toBeDefined();
      expect(pkg.dependencies['@alsaada/telemetry']).toBeDefined();
    });
  });
});
