import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/redis.js', () => ({
  redis: { on: vi.fn(), get: vi.fn().mockResolvedValue(null) },
  getPendingSiteAction: vi.fn().mockResolvedValue(null),
  setPendingSiteAction: vi.fn().mockResolvedValue(undefined),
  clearPendingSiteAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/db.js', () => ({
  prisma: {
    site: {
      findMany: vi.fn().mockResolvedValue([
        { code: 'STE-01' },
        { code: 'STE-HQ' },
      ]),
      findUnique: vi.fn().mockResolvedValue({
        id: 'site-01',
        code: 'STE-01',
        name: 'موقع ابو طرطور - الخارجة',
        governorateCode: 'الوادى الجديد',
        latitude: 25.4412,
        longitude: 30.5512,
        geofenceRadiusMeters: 1000,
        status: 'ACTIVE',
        project: { name: 'المشروع العام' },
        workers: [],
      }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    tenant: {
      findFirst: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
    },
    project: {
      findFirst: vi.fn().mockResolvedValue({ id: 'prj-1' }),
    },
  },
}));

import {
  SITE_FIELD_LABELS,
  getNextSiteCode,
  renderSitesHub,
  renderSiteDetail,
  handleSiteTextInput,
  handleSiteLocationInput,
} from '../src/handlers/sites-hub.handler.js';
import { prisma } from '../src/db.js';
import { MyContext } from '../src/types/context.js';

describe('Sites & Projects Hub Handler', () => {
  it('should define site field labels correctly', () => {
    expect(SITE_FIELD_LABELS.name).toBe('اسم الموقع');
    expect(SITE_FIELD_LABELS.gov).toBe('المحافظة / الإقليم');
    expect(SITE_FIELD_LABELS.location).toBe('الموقع الجغرافي (GPS)');
    expect(SITE_FIELD_LABELS.geofence).toBe('نطاق السياج الجغرافي');
  });

  it('should calculate next sequential site code as STE-02 when STE-01 exists', async () => {
    const nextCode = await getNextSiteCode();
    expect(nextCode).toBe('STE-02');
  });

  it('should calculate STE-01 when no existing numeric codes are present', async () => {
    vi.mocked(prisma.site.findMany).mockResolvedValueOnce([{ code: 'STE-HQ' } as any]);
    const nextCode = await getNextSiteCode();
    expect(nextCode).toBe('STE-01');
  });

  it('should reject non-super-admin user from sites hub', async () => {
    const mockAnswerCallbackQuery = vi.fn();
    const mockCtx = {
      isRealSuperAdmin: false,
      callbackQuery: { data: 'action:settings:sites_hub' },
      answerCallbackQuery: mockAnswerCallbackQuery,
    } as unknown as MyContext;

    await renderSitesHub(mockCtx, true);

    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        show_alert: true,
        text: expect.stringContaining('حصرياً للمدير العام'),
      })
    );
  });

  it('should return false if text arrives without pending site action', async () => {
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      message: { text: 'موقع تجريبي' },
    } as unknown as MyContext;

    const handled = await handleSiteTextInput(mockCtx);
    expect(handled).toBe(false);
  });

  it('should return false if location arrives without pending edit location action', async () => {
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      message: { location: { latitude: 25.44, longitude: 30.55 } },
    } as unknown as MyContext;

    const handled = await handleSiteLocationInput(mockCtx);
    expect(handled).toBe(false);
  });

  it('should render site detail with GPS coordinates and Google Maps link', async () => {
    const editMock = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:view:STE-01' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: editMock,
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as MyContext;

    await renderSiteDetail(mockCtx, 'STE-01', true);

    expect(editMock).toHaveBeenCalled();
    const renderedText = editMock.mock.calls[0][0] as string;
    expect(renderedText).toContain('25.4412, 30.5512');
    expect(renderedText).toContain('https://www.google.com/maps?q=25.4412,30.5512');
  });
});
