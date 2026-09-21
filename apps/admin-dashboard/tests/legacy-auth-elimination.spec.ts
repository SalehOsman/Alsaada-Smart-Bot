import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';
import nextConfig from '../next.config';

describe('Task 7: Physical Elimination of Legacy Auth & Single-Sovereign Bot Entry', () => {
  const appDir = path.resolve(__dirname, '../src/app');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('confirms legacy /login page is physically eliminated from codebase without trace', () => {
    // Arrange
    const loginDir = path.join(appDir, 'login');

    // Act
    const exists = fs.existsSync(loginDir);
    const parentExists = fs.existsSync(appDir);

    // Assert
    expect(exists).toBe(false);
    expect(exists).not.toBe(true);
    expect(parentExists).toBe(true);
  });

  it('confirms legacy /api/auth/telegram route is physically eliminated from route handlers', () => {
    // Arrange
    const telegramRoute = path.join(appDir, 'api/auth/telegram');

    // Act
    const exists = fs.existsSync(telegramRoute);
    const parentExists = fs.existsSync(path.join(appDir, 'api/auth'));

    // Assert
    expect(exists).toBe(false);
    expect(exists).not.toBe(true);
    expect(parentExists).toBe(true);
  });

  it('confirms legacy /api/auth/twa route is physically eliminated from route handlers', () => {
    // Arrange
    const twaRoute = path.join(appDir, 'api/auth/twa');

    // Act
    const exists = fs.existsSync(twaRoute);
    const parentExists = fs.existsSync(path.join(appDir, 'api/auth'));

    // Assert
    expect(exists).toBe(false);
    expect(exists).not.toBe(true);
    expect(parentExists).toBe(true);
  });

  it('confirms legacy /api/auth/otp route is physically eliminated from route handlers', () => {
    // Arrange
    const otpRoute = path.join(appDir, 'api/auth/otp');

    // Act
    const exists = fs.existsSync(otpRoute);
    const parentExists = fs.existsSync(path.join(appDir, 'api/auth'));

    // Assert
    expect(exists).toBe(false);
    expect(exists).not.toBe(true);
    expect(parentExists).toBe(true);
  });

  it('confirms legacy /api/auth/magic route is physically eliminated in favor of claim route', () => {
    // Arrange
    const magicRoute = path.join(appDir, 'api/auth/magic');
    const claimRoute = path.join(appDir, 'api/auth/claim/route.ts');

    // Act
    const magicExists = fs.existsSync(magicRoute);
    const claimExists = fs.existsSync(claimRoute);

    // Assert
    expect(magicExists).toBe(false);
    expect(magicExists).not.toBe(true);
    expect(claimExists).toBe(true);
  });

  it('redirects /login at Next.js configuration level directly to sovereign bot deep-link', async () => {
    // Arrange
    expect(nextConfig.redirects).toBeDefined();
    expect(typeof nextConfig.redirects).toBe('function');

    // Act
    const redirectsFn = nextConfig.redirects as () => Promise<Array<{ source: string; destination: string; permanent: boolean }>>;
    const redirects = await redirectsFn();
    const loginRedirect = redirects.find((r) => r.source === '/login');

    // Assert
    expect(loginRedirect).toBeDefined();
    expect(loginRedirect?.source).toBe('/login');
    expect(loginRedirect?.destination).toContain('start=dashboard_access');
    expect(loginRedirect?.destination).not.toContain('/login');
    expect(loginRedirect?.permanent).toBe(false);
  });
});
