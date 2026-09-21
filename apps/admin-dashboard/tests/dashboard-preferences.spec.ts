import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';
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
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Default Preferences & Invariants', () => {
    it('enforces enterprise default preferences matching requirements with strictly valid keys', () => {
      // Arrange
      const expectedTheme = 'light';

      // Act
      const prefs = DEFAULT_PREFERENCES;

      // Assert
      expect(prefs.theme).toBe(expectedTheme);
      expect(prefs.theme).not.toBe('dark');
      expect(prefs.timezone).toBe('Africa/Cairo');
      expect(prefs.timezone).not.toBe('UTC');
      expect(prefs.tableDensity).toBe('comfortable');
      expect(prefs.sidebarCollapsed).toBe(false);
      expect(prefs.timeFormat).toBe('12h');
      expect(prefs.dateFormat).toBe('DD/MM/YYYY');
      expect(prefs.weekStart).toBe('saturday');
      expect(prefs.numberFormat).toBe('western');
      expect(prefs.currencyCode).toBe('EGP');
      expect(prefs.currencySymbol).toBe('ج.م');
      expect(prefs.decimalPlaces).toBe(2);
      expect(prefs.refreshInterval).toBe(30);
      expect(prefs.tableRowsPerPage).toBe(25);
      expect(prefs.soundNotifications).toBe(true);
    });

    it('verifies supported operational timezones catalog with flags, labels, and 5 discrete zones', () => {
      // Arrange
      const expectedCount = 5;

      // Act
      const zones = SUPPORTED_TIMEZONES;

      // Assert
      expect(zones.length).toBe(expectedCount);
      expect(zones.length).not.toBeLessThan(expectedCount);

      const cairo = zones.find((t) => t.id === 'Africa/Cairo');
      expect(cairo).toBeDefined();
      expect(cairo?.flag).toBe('🇪🇬');
      expect(cairo?.city).toBe('القاهرة');

      const riyadh = zones.find((t) => t.id === 'Asia/Riyadh');
      expect(riyadh).toBeDefined();
      expect(riyadh?.flag).toBe('🇸🇦');
      expect(riyadh?.city).toBe('الرياض');

      const dubai = zones.find((t) => t.id === 'Asia/Dubai');
      expect(dubai).toBeDefined();
      expect(dubai?.flag).toBe('🇦🇪');

      const london = zones.find((t) => t.id === 'Europe/London');
      expect(london).toBeDefined();
      expect(london?.flag).toBe('🇬🇧');

      const utc = zones.find((t) => t.id === 'UTC');
      expect(utc).toBeDefined();
      expect(utc?.flag).toBe('🌐');
      expect(utc?.id).not.toBe('GMT');
    });
  });

  describe('2. Numeral Systems & Regional Digits Conversion', () => {
    it('accurately transforms Western digits into Eastern Arabic digits', () => {
      // Arrange
      const rawNumeric = '0123456789';
      const formattedCurrency = '1,500.00 ج.م';

      // Act
      const convertedDigits = toEasternDigits(rawNumeric);
      const convertedCurrency = toEasternDigits(formattedCurrency);
      const emptyResult = toEasternDigits('');

      // Assert
      expect(convertedDigits).toBe('٠١٢٣٤٥٦٧٨٩');
      expect(convertedDigits).not.toContain('0');
      expect(convertedCurrency).toBe('١,٥٠٠.٠٠ ج.م');
      expect(emptyResult).toBe('');
      expect(emptyResult).toHaveLength(0);
    });

    it('accurately normalizes Eastern Arabic digits back to Western digits', () => {
      // Arrange
      const easternNumeric = '٠١٢٣٤٥٦٧٨٩';
      const easternShort = '١٥٠٠';

      // Act
      const normalizedDigits = normalizeDigits(easternNumeric);
      const normalizedShort = normalizeDigits(easternShort);

      // Assert
      expect(normalizedDigits).toBe('0123456789');
      expect(normalizedDigits).not.toContain('٠');
      expect(normalizedShort).toBe('1500');
      expect(normalizedShort).not.toBe('١٥٠٠');
    });

    it('safely parses multiple date formats without runtime exceptions returning valid Date objects', () => {
      // Arrange
      const sampleIso = '2026-09-16T12:00:00Z';
      const sampleTimestamp = 1789560000000;
      const invalidDateString = 'not-a-valid-date-string';

      // Act
      const parsedNow = parseDateSafe();
      const parsedIso = parseDateSafe(sampleIso);
      const parsedTimestamp = parseDateSafe(sampleTimestamp);
      const parsedInvalid = parseDateSafe(invalidDateString);
      const parsedNull = parseDateSafe(null);
      const parsedEmpty = parseDateSafe('');

      // Assert
      expect(parsedNow).toBeInstanceOf(Date);
      expect(parsedIso).toBeInstanceOf(Date);
      expect(parsedIso?.toISOString()).toBe('2026-09-16T12:00:00.000Z');
      expect(parsedTimestamp).toBeInstanceOf(Date);
      expect(parsedInvalid).toBeNull();
      expect(parsedInvalid).not.toBeInstanceOf(Date);
      expect(parsedNull).toBeInstanceOf(Date);
      expect(parsedEmpty).toBeInstanceOf(Date);
    });
  });

  describe('3. Manifest Feature Registration & RBAC Access Matrix', () => {
    const settingsSection = DASHBOARD_SECTIONS_MANIFEST.find(
      (sec) => sec.href === '/admin/settings'
    );

    it('registers settings/preferences under the governance section in manifest with Implemented status', () => {
      // Arrange
      expect(settingsSection).toBeDefined();

      // Act
      const prefFeature = settingsSection!.features?.find(
        (f) => f.id === 'settings/preferences'
      );

      // Assert
      expect(prefFeature).toBeDefined();
      expect(prefFeature?.title).toBe('تفضيلات ومظهر الداشبورد');
      expect(prefFeature?.href).toBe('/admin/settings/preferences');
      expect(prefFeature?.status).toBe('Implemented');
      expect(prefFeature?.status).not.toBe('Planned');
    });

    it('grants preferences access to administrative roles and strictly denies WORKER role', () => {
      // Arrange
      const prefFeature = settingsSection!.features?.find(
        (f) => f.id === 'settings/preferences'
      );
      expect(prefFeature).toBeDefined();

      // Act
      const superAdminAccess = hasAccess('SUPER_ADMIN', prefFeature!.allowedRoles);
      const generalAdminAccess = hasAccess('GENERAL_ADMIN', prefFeature!.allowedRoles);
      const fieldAdminAccess = hasAccess('FIELD_ADMIN', prefFeature!.allowedRoles);
      const workerAccess = hasAccess('WORKER', prefFeature!.allowedRoles);

      // Assert
      expect(prefFeature!.allowedRoles).toContain('SUPER_ADMIN');
      expect(prefFeature!.allowedRoles).toContain('GENERAL_ADMIN');
      expect(prefFeature!.allowedRoles).toContain('FIELD_ADMIN');
      expect(prefFeature!.allowedRoles).not.toContain('WORKER');

      expect(superAdminAccess).toBe(true);
      expect(generalAdminAccess).toBe(true);
      expect(fieldAdminAccess).toBe(true);
      expect(workerAccess).toBe(false);
    });
  });

  describe('4. Preferences Cloud API Route (/api/user/preferences)', () => {
    it('returns default preferences and authenticated false on GET when user is unauthenticated', async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(response.status).not.toBe(401);
      expect(data.authenticated).toBe(false);
      expect(data.preferences.timezone).toBe('Africa/Cairo');
      expect(data.preferences.theme).toBe('light');
      expect(data.preferences.theme).not.toBe('dark');
    });

    it('returns user saved draft preferences on GET when session is authenticated', async () => {
      // Arrange
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
        expiresAt: PINNED_BASE_TIME,
        updatedAt: PINNED_BASE_TIME,
      });

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(response.status).not.toBe(401);
      expect(data.authenticated).toBe(true);
      expect(data.preferences.theme).toBe('dark');
      expect(data.preferences.timezone).toBe('Asia/Riyadh');
      expect(data.preferences.tableDensity).toBe('compact');
      expect(data.preferences.theme).not.toBe('light');
    });

    it('strictly rejects unauthenticated preference updates on POST with 401 Unauthorized', async () => {
      // Arrange
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

      const request = new Request('http://localtest.me:3002/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'dark' }),
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(response.status).not.toBe(200);
      expect(data.error).toContain('غير مصرح');
      expect(data.error).not.toBeUndefined();
    });

    it('sanitizes inputs, updates draft, and sets cookies on POST when authenticated', async () => {
      // Arrange
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
        expiresAt: PINNED_BASE_TIME,
        updatedAt: PINNED_BASE_TIME,
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

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(response.status).not.toBe(400);
      expect(data.success).toBe(true);
      expect(data.preferences.theme).toBe('dark');
      expect(data.preferences.timezone).toBe('Asia/Dubai');
      expect(data.preferences.tableDensity).toBe('compact');
      expect(data.preferences.tableRowsPerPage).toBe(50);
      expect(data.preferences.soundNotifications).toBe(false);
      expect(data.preferences.unknownMaliciousField).toBeUndefined();
      expect(data.preferences.unknownMaliciousField).not.toBe('exploit');

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

    it('verifies layout.tsx contains inline anti-FOUC script and DashboardPreferencesProvider', () => {
      // Arrange
      const targetPath = 'src/app/layout.tsx';

      // Act
      const layoutSrc = readCode(targetPath);

      // Assert
      expect(layoutSrc).toContain('DashboardPreferencesProvider');
      expect(layoutSrc).toContain("localStorage.getItem('alsaada_dashboard_preferences')");
      expect(layoutSrc).toContain("document.documentElement.classList.add('dark')");
      expect(layoutSrc).toContain('suppressHydrationWarning');
      expect(layoutSrc).not.toContain('dangerouslySetInnerHTML={{ __html: "alert(1)" }}');
    });

    it('verifies header.tsx contains operational clock, theme toggle, preferences shortcut, and hydration guard', () => {
      // Arrange
      const targetPath = 'src/components/layout/header.tsx';

      // Act
      const headerSrc = readCode(targetPath);

      // Assert
      expect(headerSrc).toContain('useDashboardPreferences');
      expect(headerSrc).toContain('currentTimezoneInfo');
      expect(headerSrc).toContain('toggleTheme');
      expect(headerSrc).toContain('/admin/settings/preferences');
      expect(headerSrc).toContain('clockTime');
      expect(headerSrc).toContain('setMounted(true)');
      expect(headerSrc).not.toContain('window.location.reload()');
    });

    it('verifies provider contains cross-tab storage listener and audio context cleanup', () => {
      // Arrange
      const targetPath = 'src/components/providers/dashboard-preferences-provider.tsx';

      // Act
      const providerSrc = readCode(targetPath);

      // Assert
      expect(providerSrc).toContain("window.addEventListener('storage'");
      expect(providerSrc).toContain('parseDateSafe');
      expect(providerSrc).toContain('ctx.close()');
      expect(providerSrc).not.toContain('document.write(');
    });

    it('verifies preferences page.tsx renders all 4 preference cards and action footer', () => {
      // Arrange
      const targetPath = 'src/app/admin/settings/preferences/page.tsx';

      // Act
      const pageSrc = readCode(targetPath);

      // Assert
      expect(pageSrc).toContain('المظهر والسمة البصرية');
      expect(pageSrc).toContain('التوقيت والمنطقة الزمنية');
      expect(pageSrc).toContain('الأرقام والعملة الإقليمية');
      expect(pageSrc).toContain('سلوك البيانات والتنبيهات');
      expect(pageSrc).toContain('resetPreferences');
      expect(pageSrc).toContain('playNotificationSound');
      expect(pageSrc).toContain('تم الحفظ تلقائياً');
      expect(pageSrc).not.toContain('delete window');
    });

    it('verifies settings hub page.tsx has preferences card linking to /admin/settings/preferences', () => {
      // Arrange
      const targetPath = 'src/app/admin/settings/page.tsx';

      // Act
      const hubSrc = readCode(targetPath);

      // Assert
      expect(hubSrc).toContain('/admin/settings/preferences');
      expect(hubSrc).toContain('تفضيلات ومظهر الداشبورد');
      expect(hubSrc).not.toContain('/admin/settings/legacy-preferences');
    });

    it('verifies dashboard-shell.tsx applies dark mode root surface and text styles', () => {
      // Arrange
      const targetPath = 'src/components/layout/dashboard-shell.tsx';

      // Act
      const shellSrc = readCode(targetPath);

      // Assert
      expect(shellSrc).toContain('dark:bg-slate-950');
      expect(shellSrc).toContain('dark:text-slate-100');
      expect(shellSrc).not.toContain('dark:bg-white');
    });

    it('verifies super-admin-overview.tsx implements comprehensive dark mode styling on cards and tables', () => {
      // Arrange
      const targetPath = 'src/components/dashboard/super-admin-overview.tsx';

      // Act
      const overviewSrc = readCode(targetPath);

      // Assert
      expect(overviewSrc).toContain('dark:bg-slate-900');
      expect(overviewSrc).toContain('dark:border-slate-800');
      expect(overviewSrc).toContain('dark:text-slate-100');
      expect(overviewSrc).not.toContain('dark:border-red-900');
    });

    it('verifies command-palette.tsx implements dark mode dialog, inputs, and list styles', () => {
      // Arrange
      const targetPath = 'src/components/layout/command-palette.tsx';

      // Act
      const paletteSrc = readCode(targetPath);

      // Assert
      expect(paletteSrc).toContain('dark:bg-slate-900');
      expect(paletteSrc).toContain('dark:border-slate-800');
      expect(paletteSrc).toContain('dark:text-slate-100');
      expect(paletteSrc).not.toContain('dark:border-yellow-500');
    });
  });
});
