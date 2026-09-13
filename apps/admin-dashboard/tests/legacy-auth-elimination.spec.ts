import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import nextConfig from '../next.config';

describe('Task 7: Physical Elimination of Legacy Auth & Single-Sovereign Bot Entry', () => {
  const appDir = path.resolve(__dirname, '../src/app');

  it('proves legacy /login page is physically eliminated from codebase', () => {
    const loginDir = path.join(appDir, 'login');
    expect(fs.existsSync(loginDir)).toBe(false);
  });

  it('proves legacy /api/auth/telegram route is physically eliminated', () => {
    const telegramRoute = path.join(appDir, 'api/auth/telegram');
    expect(fs.existsSync(telegramRoute)).toBe(false);
  });

  it('proves legacy /api/auth/twa route is physically eliminated', () => {
    const twaRoute = path.join(appDir, 'api/auth/twa');
    expect(fs.existsSync(twaRoute)).toBe(false);
  });

  it('proves legacy /api/auth/otp route is physically eliminated', () => {
    const otpRoute = path.join(appDir, 'api/auth/otp');
    expect(fs.existsSync(otpRoute)).toBe(false);
  });

  it('proves legacy /api/auth/magic route is physically eliminated', () => {
    const magicRoute = path.join(appDir, 'api/auth/magic');
    expect(fs.existsSync(magicRoute)).toBe(false);
  });

  it('ensures /login is redirected at Next.js server level to bot deep-link', async () => {
    expect(nextConfig.redirects).toBeDefined();
    if (typeof nextConfig.redirects === 'function') {
      const redirects = await nextConfig.redirects();
      const loginRedirect = redirects.find((r) => r.source === '/login');
      expect(loginRedirect).toBeDefined();
      expect(loginRedirect?.destination).toContain('start=dashboard_access');
    }
  });
});
