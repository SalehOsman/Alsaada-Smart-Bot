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
      findFirst: vi.fn().mockResolvedValue({ id: 'prj-1', name: 'المشروع العام' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'prj-1', name: 'المشروع العام' }),
      findMany: vi.fn().mockResolvedValue([{ id: 'prj-1', name: 'المشروع العام' }]),
      create: vi.fn().mockResolvedValue({ id: 'prj-1', name: 'المشروع العام' }),
    },
  },
}));

import {
  SITE_FIELD_LABELS,
  getNextSiteCode,
  renderSitesHub,
  renderSiteDetail,
  renderSiteEditMenu,
  handleSelectSiteProject,
  handleSiteTextInput,
  handleSiteLocationInput,
} from '../src/handlers/sites-hub.handler.js';
import { prisma } from '../src/db.js';
import { MyContext } from '../src/types/context.js';
import { getPendingSiteAction } from '../src/redis.js';

describe('Sites & Projects Hub Handler', () => {
  it('should define site field labels correctly', () => {
    expect(SITE_FIELD_LABELS.name).toBe('اسم الموقع');
    expect(SITE_FIELD_LABELS.project).toBe('المشروع التابع له');
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

  it('should render site detail with GPS coordinates, Google Maps link, and grouped edit menu button', async () => {
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

    const options = editMock.mock.calls[0][1] as any;
    const buttons = options.reply_markup.inline_keyboard.flat();
    expect(buttons.some((b: any) => b.callback_data === 'action:site:edit_menu:STE-01')).toBe(true);
  });

  it('should render site edit sub-menu with all editing options and back button', async () => {
    const editMock = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:edit_menu:STE-01' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: editMock,
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as MyContext;

    await renderSiteEditMenu(mockCtx, 'STE-01', true);

    expect(editMock).toHaveBeenCalled();
    const renderedText = editMock.mock.calls[0][0] as string;
    expect(renderedText).toContain('لوحة تعديل بيانات الموقع الميداني');

    const options = editMock.mock.calls[0][1] as any;
    const buttons = options.reply_markup.inline_keyboard.flat();
    expect(buttons.some((b: any) => b.callback_data === 'action:site:edit:name:STE-01')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:site:edit:project:STE-01')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:site:edit:gov:STE-01')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:site:edit:geofence:STE-01')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:site:edit:location:STE-01')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:site:view:STE-01')).toBe(true);
  });

  it('should update site project via handleSelectSiteProject', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce({
      id: 'prj-phosphate',
      name: 'مشروع مجمع فوسفات أبو طرطور',
    } as any);

    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:sp:STE-01:prj-phosphate' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as MyContext;

    await handleSelectSiteProject(mockCtx, 'STE-01', 'prj-phosphate');

    expect(prisma.site.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'STE-01' },
        data: { projectId: 'prj-phosphate' },
      })
    );
  });

  it('should provide interactive retry and back buttons on input error (Zero Orphan Errors)', async () => {
    vi.mocked(getPendingSiteAction).mockResolvedValueOnce({
      action: 'edit_location',
      siteCode: 'STE-01',
      messageId: 123,
    });

    const replyMock = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      message: { text: 'invalid_coordinates_text' },
      reply: replyMock,
    } as unknown as MyContext;

    const handled = await handleSiteTextInput(mockCtx);
    expect(handled).toBe(true);
    expect(replyMock).toHaveBeenCalled();

    const options = replyMock.mock.calls[0][1] as any;
    expect(options).toBeDefined();
    expect(options.reply_markup).toBeDefined();
    const buttons = options.reply_markup.inline_keyboard.flat();
    expect(buttons.some((b: any) => b.text.includes('إعادة المحاولة'))).toBe(true);
    expect(buttons.some((b: any) => b.text.includes('رجوع'))).toBe(true);
  });
});
