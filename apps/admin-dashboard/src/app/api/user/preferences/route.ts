import { NextResponse } from 'next/server';
import { prisma } from '@alsaada/database';
import { getCurrentUser } from '../../../../lib/auth';
import {
  DEFAULT_PREFERENCES,
  type DashboardPreferences,
} from '../../../../components/providers/dashboard-preferences-provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser({ nullable: true });
    if (!user || !user.telegramId) {
      return NextResponse.json({
        preferences: DEFAULT_PREFERENCES,
        authenticated: Boolean(user),
      });
    }

    try {
      const draft = await prisma.userWizardDraft.findUnique({
        where: { telegramId: BigInt(user.telegramId) },
      });

      if (draft && draft.wizardName === 'dashboard_preferences' && draft.draftData) {
        return NextResponse.json({
          preferences: draft.draftData as unknown as DashboardPreferences,
          authenticated: true,
        });
      }
    } catch {
      // Database read error - fallback safely to defaults
    }

    return NextResponse.json({
      preferences: DEFAULT_PREFERENCES,
      authenticated: true,
    });
  } catch {
    return NextResponse.json({
      preferences: DEFAULT_PREFERENCES,
      authenticated: false,
    });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser({ nullable: true });
    if (!user) {
      return NextResponse.json(
        { error: 'غير مصرح - يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Partial<DashboardPreferences>;

    // Sanitize and validate fields
    const sanitized: DashboardPreferences = {
      theme: ['light', 'dark', 'system'].includes(body.theme as string)
        ? (body.theme as DashboardPreferences['theme'])
        : DEFAULT_PREFERENCES.theme,
      tableDensity: ['comfortable', 'compact'].includes(body.tableDensity as string)
        ? (body.tableDensity as DashboardPreferences['tableDensity'])
        : DEFAULT_PREFERENCES.tableDensity,
      sidebarCollapsed: Boolean(body.sidebarCollapsed),
      timezone: body.timezone && typeof body.timezone === 'string'
        ? body.timezone
        : DEFAULT_PREFERENCES.timezone,
      timeFormat: ['12h', '24h'].includes(body.timeFormat as string)
        ? (body.timeFormat as DashboardPreferences['timeFormat'])
        : DEFAULT_PREFERENCES.timeFormat,
      dateFormat: ['DD/MM/YYYY', 'YYYY-MM-DD'].includes(body.dateFormat as string)
        ? (body.dateFormat as DashboardPreferences['dateFormat'])
        : DEFAULT_PREFERENCES.dateFormat,
      weekStart: ['saturday', 'sunday', 'monday'].includes(body.weekStart as string)
        ? (body.weekStart as DashboardPreferences['weekStart'])
        : DEFAULT_PREFERENCES.weekStart,
      numberFormat: ['western', 'eastern'].includes(body.numberFormat as string)
        ? (body.numberFormat as DashboardPreferences['numberFormat'])
        : DEFAULT_PREFERENCES.numberFormat,
      currencyCode: ['EGP', 'SAR', 'USD'].includes(body.currencyCode as string)
        ? (body.currencyCode as DashboardPreferences['currencyCode'])
        : DEFAULT_PREFERENCES.currencyCode,
      currencySymbol: body.currencySymbol && typeof body.currencySymbol === 'string'
        ? body.currencySymbol
        : DEFAULT_PREFERENCES.currencySymbol,
      decimalPlaces: typeof body.decimalPlaces === 'number' && [0, 2, 3].includes(body.decimalPlaces)
        ? body.decimalPlaces
        : DEFAULT_PREFERENCES.decimalPlaces,
      refreshInterval: typeof body.refreshInterval === 'number' && [0, 15, 30, 60].includes(body.refreshInterval)
        ? body.refreshInterval
        : DEFAULT_PREFERENCES.refreshInterval,
      tableRowsPerPage: typeof body.tableRowsPerPage === 'number' && [10, 25, 50, 100].includes(body.tableRowsPerPage)
        ? body.tableRowsPerPage
        : DEFAULT_PREFERENCES.tableRowsPerPage,
      soundNotifications: body.soundNotifications !== false,
    };

    if (user.telegramId) {
      try {
        const tId = BigInt(user.telegramId);
        await prisma.userWizardDraft.upsert({
          where: { telegramId: tId },
          create: {
            telegramId: tId,
            wizardName: 'dashboard_preferences',
            currentStep: 'saved',
            draftData: sanitized as unknown as object,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
          update: {
            wizardName: 'dashboard_preferences',
            currentStep: 'saved',
            draftData: sanitized as unknown as object,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        });
      } catch {
        // Fallback silently if database is unreachable or offline
      }
    }

    const response = NextResponse.json({
      success: true,
      preferences: sanitized,
    });

    // Set server-side cookies
    response.cookies.set('alsaada_theme', sanitized.theme, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });
    response.cookies.set('alsaada_tz', sanitized.timezone, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });
    response.cookies.set('alsaada_num_format', sanitized.numberFormat, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ أثناء معالجة تفضيلات المستخدم' },
      { status: 500 }
    );
  }
}
