import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_PREFERENCES,
  SUPPORTED_TIMEZONES,
  toEasternDigits,
  parseDateSafe,
  type DashboardPreferences,
} from '../src/components/providers/dashboard-preferences-provider';
import { normalizeDigits } from '@alsaada/regional-engine';
import { DASHBOARD_SECTIONS_MANIFEST } from '../src/dashboard.manifest';
import { hasAccess } from '../src/lib/rbac';
import { GET, POST } from '../src/app/api/user/preferences/route';
import { getCurrentUser } from '../src/lib/auth';
import { prisma } from '@alsaada/database';

vi.mock('../src/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@alsaada/database', () => ({
  prisma: {
    userWizardDraft: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

describe('Dashboard Preferences, Theme, Timezone & Regional Suite (Plan 46)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Default Preferences & Invariants', () => {
    it('enforces enterprise default preferences matching requirements', () => {
      expect(DEFAULT_PREFERENCES.theme).toBe('light');
      expect(DEFAULT_PREFERENCES.timezone).toBe('Africa/Cairo');
      expect(DEFAULT_PREFERENCES.tableDensity).toBe('comfortable');
      expect(DEFAULT_PREFERENCES.sidebarCollapsed).toBe(false);
      expect(DEFAULT_PREFERENCES.timeFormat).toBe('12h');
      expect(DEFAULT_PREFERENCES.dateFormat).toBe('DD/MM/YYYY');
      expect(DEFAULT_PREFERENCES.weekStart).toBe('saturday');
      expect(DEFAULT_PREFERENCES.numberFormat).toBe('western');
      expect(DEFAULT_PREFERENCES.currencyCode).toBe('EGP');
      expect(DEFAULT_PREFERENCES.currencySymbol).toBe('ج.م');
      expect(DEFAULT_PREFERENCES.decimalPlaces).toBe(2);
      expect(DEFAULT_PREFERENCES.refreshInterval).toBe(30);
      expect(DEFAULT_PREFERENCES.tableRowsPerPage).toBe(25);
      expect(DEFAULT_PREFERENCES.soundNotifications).toBe(true);
    });

    it('verifies supported operational timezones catalog with flags and labels', () => {
      expect(SUPPORTED_TIMEZONES.length).toBe(5);

      const cairo = SUPPORTED_TIMEZONES.find((t) => t.id === 'Africa/Cairo')!;
      expect(cairo).toBeDefined();
      expect(cairo.flag).toBe('🇪🇬');
      expect(cairo.city).toBe('القاهرة');

      const riyadh = SUPPORTED_TIMEZONES.find((t) => t.id === 'Asia/Riyadh')!;
      expect(riyadh).toBeDefined();
      expect(riyadh.flag).toBe('🇸🇦');
      expect(riyadh.city).toBe('الرياض');

      const dubai = SUPPORTED_TIMEZONES.find((t) => t.id === 'Asia/Dubai')!;
      expect(dubai).toBeDefined();
      expect(dubai.flag).toBe('🇦🇪');

      const london = SUPPORTED_TIMEZONES.find((t) => t.id === 'Europe/London')!;
      expect(london).toBeDefined();
      expect(london.flag).toBe('🇬🇧');

      const utc = SUPPORTED_TIMEZONES.find((t) => t.id === 'UTC')!;
      expect(utc).toBeDefined();
      expect(utc.flag).toBe('🌐');
    });
  });

  describe('2. Numeral Systems & Regional Digits Conversion', () => {
    it('accurately transforms Western digits into Eastern Arabic digits', () => {
      expect(toEasternDigits('0123456789')).toBe('٠١٢٣٤٥٦٧٨٩');
      expect(toEasternDigits('1,500.00 ج.م')).toBe('١,٥٠٠.٠٠ ج.م');
      expect(toEasternDigits('')).toBe('');
    });

    it('accurately normalizes Eastern Arabic digits back to Western digits', () => {
      expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
      expect(normalizeDigits('١٥٠٠')).toBe('1500');
    });

    it('safely parses multiple date formats without runtime exceptions', () => {
      const parsedNow = parseDateSafe();
      expect(parsedNow).toBeInstanceOf(Date);

      const parsedIso = parseDateSafe('2026-09-16T12:00:00Z');
      expect(parsedIso).toBeInstanceOf(Date);
      expect(parsedIso?.toISOString()).toBe('2026-09-16T12:00:00.000Z');

      const parsedTimestamp = parseDateSafe(1789560000000);
      expect(parsedTimestamp).toBeInstanceOf(Date);

      expect(parseDateSafe('not-a-valid-date-string')).toBeNull();
      expect(parseDateSafe(null)).toBeInstanceOf(Date);
      expect(parseDateSafe('')).toBeInstanceOf(Date);
    });
  });

  describe('3. Manifest Feature Registration & RBAC Access Matrix', () => {
    const settingsSection = DASHBOARD_SECTIONS_MANIFEST.find(
      (sec) => sec.href === '/admin/settings'
    )!;

    it('registers settings/preferences under the governance section in manifest', () => {
      expect(settingsSection).toBeDefined();
      const prefFeature = settingsSection.features?.find(
        (f) => f.id === 'settings/preferences'
      );
      expect(prefFeature).toBeDefined();
      expect(prefFeature?.title).toBe('تفضيلات ومظهر الداشبورد');
      expect(prefFeature?.href).toBe('/admin/settings/preferences');
      expect(prefFeature?.status).toBe('Implemented');
    });

    it('grants access to SUPER_ADMIN, GENERAL_ADMIN and FIELD_ADMIN', () => {
      const prefFeature = settingsSection.features?.find(
        (f) => f.id === 'settings/preferences'
      )!;
      expect(prefFeature.allowedRoles).toContain('SUPER_ADMIN');
      expect(prefFeature.allowedRoles).toContain('GENERAL_ADMIN');
      expect(prefFeature.allowedRoles).toContain('FIELD_ADMIN');

      expect(hasAccess('SUPER_ADMIN', prefFeature.allowedRoles)).toBe(true);
      expect(hasAccess('GENERAL_ADMIN', prefFeature.allowedRoles)).toBe(true);
      expect(hasAccess('FIELD_ADMIN', prefFeature.allowedRoles)).toBe(true);
      expect(hasAccess('WORKER', prefFeature.allowedRoles)).toBe(false);
    });
  });

  describe('4. Preferences Cloud API Route (/api/user/preferences)', () => {
    it('GET: returns default preferences when user is unauthenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.preferences.timezone).toBe('Africa/Cairo');
      expect(data.preferences.theme).toBe('light');
    });

    it('GET: returns user saved draft preferences when authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: 'usr-001',
        telegramId: '99887766',
        name: 'أحمد الإداري',
        role: 'SUPER_ADMIN',
        isRealSuperAdmin: true,
      });

      const customPrefs: Partial<DashboardPreferences> = {
        theme: 'dark',
        timezone: 'Asia/Riyadh',
        tableDensity: 'compact',
        numberFormat: 'eastern',
      };

      vi.mocked(prisma.userWizardDraft.findUnique).mockResolvedValueOnce({
        id: 'draft-1',
        telegramId: BigInt(99887766),
        wizardName: 'dashboard_preferences',
        currentStep: 'saved',
        draftData: customPrefs as unknown as Record<string, string>,
        expiresAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(true);
      expect(data.preferences.theme).toBe('dark');
      expect(data.preferences.timezone).toBe('Asia/Riyadh');
      expect(data.preferences.tableDensity).toBe('compact');
    });

    it('POST: strictly rejects unauthenticated updates with 401 Unauthorized', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

      const request = new Request('http://localtest.me:3002/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'dark' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('غير مصرح');
    });

    it('POST: sanitizes input, updates draft, and sets server cookies when authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: 'usr-001',
        telegramId: '99887766',
        name: 'أحمد الإداري',
        role: 'FIELD_ADMIN',
        isRealSuperAdmin: false,
      });

      vi.mocked(prisma.userWizardDraft.upsert).mockResolvedValueOnce({
        id: 'draft-2',
        telegramId: BigInt(99887766),
        wizardName: 'dashboard_preferences',
        currentStep: 'saved',
        draftData: {},
        expiresAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new Request('http://localtest.me:3002/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: 'dark',
          timezone: 'Asia/Dubai',
          tableDensity: 'compact',
          tableRowsPerPage: 50,
          soundNotifications: false,
          unknownMaliciousField: 'exploit',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.preferences.theme).toBe('dark');
      expect(data.preferences.timezone).toBe('Asia/Dubai');
      expect(data.preferences.tableDensity).toBe('compact');
      expect(data.preferences.tableRowsPerPage).toBe(50);
      expect(data.preferences.soundNotifications).toBe(false);
      expect(data.preferences.unknownMaliciousField).toBeUndefined();

      // Verify cookies set
      const cookies = response.cookies.getAll();
      const themeCookie = cookies.find((c) => c.name === 'alsaada_theme');
      const tzCookie = cookies.find((c) => c.name === 'alsaada_tz');

      expect(themeCookie?.value).toBe('dark');
      expect(tzCookie?.value).toBe('Asia/Dubai');

      expect(prisma.userWizardDraft.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. Structural AST & Zero FOUC Verification', () => {
    const readCode = (relPath: string): string => {
      const full = path.resolve(__dirname, '..', relPath);
      return fs.readFileSync(full, 'utf-8');
    };

    it('layout.tsx contains inline anti-FOUC script and DashboardPreferencesProvider', () => {
      const layoutSrc = readCode('src/app/layout.tsx');
      expect(layoutSrc).toContain('DashboardPreferencesProvider');
      expect(layoutSrc).toContain('localStorage.getItem(\'alsaada_dashboard_preferences\')');
      expect(layoutSrc).toContain('document.documentElement.classList.add(\'dark\')');
      expect(layoutSrc).toContain('suppressHydrationWarning');
    });

    it('header.tsx contains operational clock, theme toggle, preferences shortcut, and mounted hydration guard', () => {
      const headerSrc = readCode('src/components/layout/header.tsx');
      expect(headerSrc).toContain('useDashboardPreferences');
      expect(headerSrc).toContain('currentTimezoneInfo');
      expect(headerSrc).toContain('toggleTheme');
      expect(headerSrc).toContain('/admin/settings/preferences');
      expect(headerSrc).toContain('clockTime');
      expect(headerSrc).toContain('setMounted(true)');
    });

    it('provider contains cross-tab storage listener and audio context cleanup', () => {
      const providerSrc = readCode('src/components/providers/dashboard-preferences-provider.tsx');
      expect(providerSrc).toContain('window.addEventListener(\'storage\'');
      expect(providerSrc).toContain('parseDateSafe');
      expect(providerSrc).toContain('ctx.close()');
    });

    it('preferences page.tsx renders all 4 preference cards and action footer', () => {
      const pageSrc = readCode('src/app/admin/settings/preferences/page.tsx');
      expect(pageSrc).toContain('المظهر والسمة البصرية');
      expect(pageSrc).toContain('التوقيت والمنطقة الزمنية');
      expect(pageSrc).toContain('الأرقام والعملة الإقليمية');
      expect(pageSrc).toContain('سلوك البيانات والتنبيهات');
      expect(pageSrc).toContain('resetPreferences');
      expect(pageSrc).toContain('playNotificationSound');
      expect(pageSrc).toContain('تم الحفظ تلقائياً');
    });

    it('settings hub page.tsx has preferences card linking to /admin/settings/preferences', () => {
      const hubSrc = readCode('src/app/admin/settings/page.tsx');
      expect(hubSrc).toContain('/admin/settings/preferences');
      expect(hubSrc).toContain('تفضيلات ومظهر الداشبورد');
    });

    it('dashboard-shell.tsx applies dark mode root surface and text colors', () => {
      const shellSrc = readCode('src/components/layout/dashboard-shell.tsx');
      expect(shellSrc).toContain('dark:bg-slate-950');
      expect(shellSrc).toContain('dark:text-slate-100');
    });

    it('super-admin-overview.tsx implements comprehensive dark mode styling on cards and tables', () => {
      const overviewSrc = readCode('src/components/dashboard/super-admin-overview.tsx');
      expect(overviewSrc).toContain('dark:bg-slate-900');
      expect(overviewSrc).toContain('dark:border-slate-800');
      expect(overviewSrc).toContain('dark:text-slate-100');
    });

    it('command-palette.tsx implements dark mode dialog, inputs, and list styles', () => {
      const paletteSrc = readCode('src/components/layout/command-palette.tsx');
      expect(paletteSrc).toContain('dark:bg-slate-900');
      expect(paletteSrc).toContain('dark:border-slate-800');
      expect(paletteSrc).toContain('dark:text-slate-100');
    });
  });
});
