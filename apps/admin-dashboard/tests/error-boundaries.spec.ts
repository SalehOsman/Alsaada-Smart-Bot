import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';
import GlobalError from '../src/app/global-error';
import ErrorBoundary from '../src/app/error';
import NotFound from '../src/app/not-found';
import { deriveIncidentCode } from '@alsaada/telemetry';
import fs from 'node:fs';
import path from 'node:path';

describe('Admin Dashboard Error Boundaries & Telemetry Integration (Milestone 2 - Phase 2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GlobalError (Root Layout Error Boundary)', () => {
    it('renders root html and body with RTL and Arabic metadata upon fatal root crash', () => {
      // Arrange
      const mockReset = vi.fn();
      const mockError = new Error('Test Root Layout Crash');

      // Act
      const html = renderToStaticMarkup(
        React.createElement(GlobalError, { error: mockError, reset: mockReset })
      );

      // Assert
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('lang="ar"');
      expect(html).toContain('<html');
      expect(html).toContain('<body');
      expect(html).toContain('عطل غير متوقع في النظام');
      expect(html).not.toContain('dir="ltr"');
      expect(html).not.toContain('500 Internal Server Error');
    });

    it('derives and displays a standard TRC- incident code from error.digest when provided', () => {
      // Arrange
      const mockReset = vi.fn();
      const mockError = Object.assign(new Error('Digest Crash'), { digest: 'B91DEB4D9999' });

      // Act
      const html = renderToStaticMarkup(
        React.createElement(GlobalError, { error: mockError, reset: mockReset })
      );
      const expectedCode = deriveIncidentCode('B91DEB4D9999');

      // Assert
      expect(expectedCode).toBe('TRC-B91DEB4D');
      expect(expectedCode).not.toBe('');
      expect(html).toContain(expectedCode);
      expect(html).toContain('رمز البلاغ المرجعي الموحد');
    });

    it('derives a fallback incident code when error.digest is undefined', () => {
      // Arrange
      const mockReset = vi.fn();
      const mockError = new Error('No Digest Error');

      // Act
      const html = renderToStaticMarkup(
        React.createElement(GlobalError, { error: mockError, reset: mockReset })
      );

      // Assert
      expect(html).toMatch(/TRC-[A-Z0-9]{8}/);
      expect(html).toContain('TRC-');
      expect(html).toContain('رمز البلاغ المرجعي الموحد');
      expect(html).not.toContain('undefined');
    });

    it('renders retry button and home link in the root error UI', () => {
      // Arrange
      const mockReset = vi.fn();
      const mockError = new Error('Action Check');

      // Act
      const html = renderToStaticMarkup(
        React.createElement(GlobalError, { error: mockError, reset: mockReset })
      );

      // Assert
      expect(html).toContain('إعادة المحاولة');
      expect(html).toContain('الرئيسية');
      expect(html).toContain('href="/"');
      expect(html).toContain('data-testid="retry-button"');
      expect(html).not.toContain('href="/admin/crash"');
    });
  });

  describe('ErrorBoundary (App Router Route Error Boundary)', () => {
    it('renders route-level styled Arabic error alert on unexpected route exceptions', () => {
      // Arrange
      const mockReset = vi.fn();
      const mockError = new Error('Database Fetch Timeout');

      // Act
      const html = renderToStaticMarkup(
        React.createElement(ErrorBoundary, { error: mockError, reset: mockReset })
      );

      // Assert
      expect(html).toContain('عطل غير متوقع في لوحة التحكم');
      expect(html).toContain('تعذر إتمام طلبك الحالي');
      expect(html).toContain('رمز البلاغ المرجعي الموحد');
      expect(html).toContain('إعادة المحاولة');
      expect(html).toContain('href="/"');
      expect(html).not.toContain('Unhandled Exception: Database Fetch Timeout');
    });

    it('derives standard incident code from trace / digest on route failure', () => {
      // Arrange
      const mockReset = vi.fn();
      const mockError = Object.assign(new Error('Route Failure'), { digest: 'TRACE_ROUTE_555' });

      // Act
      const html = renderToStaticMarkup(
        React.createElement(ErrorBoundary, { error: mockError, reset: mockReset })
      );
      const expectedCode = deriveIncidentCode('TRACE_ROUTE_555');

      // Assert
      expect(html).toContain(expectedCode);
      expect(expectedCode.startsWith('TRC-')).toBe(true);
      expect(expectedCode.startsWith('ERR-')).toBe(false);
    });

    it('renders retry trigger button and testid in markup for user recovery', () => {
      // Arrange
      const mockReset = vi.fn();
      const mockError = new Error('Reset Test');

      // Act
      const html = renderToStaticMarkup(
        React.createElement(ErrorBoundary, { error: mockError, reset: mockReset })
      );

      // Assert
      expect(html).toContain('data-testid="retry-button"');
      expect(html).toContain('إعادة المحاولة');
      expect(html).not.toContain('disabled="true"');
    });
  });

  describe('NotFound (404 Page)', () => {
    it('renders clean Arabic 404 UI with home navigation button', () => {
      // Arrange
      const element = React.createElement(NotFound, {});

      // Act
      const html = renderToStaticMarkup(element);

      // Assert
      expect(html).toContain('404');
      expect(html).toContain('الصفحة المطلوبة غير موجودة');
      expect(html).toContain('عذراً، لم نتمكن من العثور على المسار المطلوب');
      expect(html).toContain('العودة للرئيسية');
      expect(html).toContain('href="/"');
      expect(html).toContain('data-testid="return-home-button"');
      expect(html).not.toContain('Cannot GET');
    });
  });

  describe('Next.js Cache Collision & Isolation Configuration', () => {
    it('verifies next.config.ts distDir isolation logic and transpilePackages configuration', async () => {
      // Arrange
      const configPath = path.resolve(__dirname, '../next.config.ts');

      // Act
      const content = fs.readFileSync(configPath, 'utf8');

      // Assert: Check distDir conditional logic
      expect(content).toContain("distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next'");
      // Check @alsaada/telemetry in transpilePackages
      expect(content).toContain("'@alsaada/telemetry'");
      expect(content).not.toContain("distDir: '.next'");
    });

    it('verifies package.json scripts clean, predev, and prebuild for cache isolation', () => {
      // Arrange
      const pkgPath = path.resolve(__dirname, '../package.json');

      // Act
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      // Assert
      expect(pkg.scripts.clean).toBe('rimraf .next .next-dev');
      expect(pkg.scripts.predev).toBe('pnpm clean');
      expect(pkg.scripts.prebuild).toBe('pnpm clean');
      expect(pkg.devDependencies.rimraf).toBeDefined();
      expect(pkg.dependencies['@alsaada/telemetry']).toBeDefined();
      expect(pkg.scripts.clean).not.toBe('rm -rf .next');
    });
  });
});
