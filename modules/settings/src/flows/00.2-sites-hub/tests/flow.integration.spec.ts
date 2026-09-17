import { describe, it, expect, vi } from 'vitest';
import { SitesHubHandler } from '../flow.handler.js';
import type { SitesHubService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

describe('Flow 00.2 Integration Tests — مصفوفة المشاريع والمواقع الميدانية', () => {
  it('should coordinate handler execution with service', async () => {
    const mockService = {
      clearPendingEdit: vi.fn().mockResolvedValue(undefined),
      clearWizardState: vi.fn().mockResolvedValue(undefined),
      clearEditState: vi.fn().mockResolvedValue(undefined),
      getProfile: vi.fn().mockResolvedValue(null),
      listSites: vi.fn().mockResolvedValue([]),
      listDepartments: vi.fn().mockResolvedValue([]),
      listAdminUsers: vi.fn().mockResolvedValue([]),
      getApmSummary: vi.fn().mockResolvedValue({ totalOps24h: 0, avgLatencyMs: 0, greenPct: 100, yellowPct: 0, redPct: 0 }),
      getMaintenanceStatus: vi.fn().mockResolvedValue({ isMaintenanceActive: false }),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    await handler.renderSitesHub(ctx);
    expect(replyMock).toHaveBeenCalledTimes(1);
  });

  it('should navigate governorate pages in-place during site creation', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'SELECT_GOV',
        name: 'موقع العاشر من رمضان',
        code: 'STE-05',
        timestamp: Date.now(),
      }),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:add_gov_page:2' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.handleGovPageChange(ctx, 2);

    expect(answerCallbackMock).toHaveBeenCalledTimes(1);
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    const callArgs = editMessageTextMock.mock.calls[0]!;
    expect(callArgs[0]).toContain('موقع العاشر من رمضان');
    expect(callArgs[1]?.reply_markup?.inline_keyboard[3]?.[1]?.text).toBe('📄 صفحة 2 من 3');
  });

  it('should navigate governorate pages in-place during site edit', async () => {
    const mockService = {} as unknown as SitesHubService;
    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:edit_gov_page:STE-01:3' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.handleGovPageChange(ctx, 3, 'STE-01');

    expect(answerCallbackMock).toHaveBeenCalledTimes(1);
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    const callArgs = editMessageTextMock.mock.calls[0]!;
    expect(callArgs[0]).toBe('اختر المحافظة الجديدة:');
    expect(callArgs[1]?.reply_markup?.inline_keyboard[3]?.[0]?.text).toBe('📄 صفحة 3 من 3');
  });

  it('should navigate back to name step when handleBackToName is triggered', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'CONFIRM_CODE',
        name: 'موقع السويس',
        promptMessageId: 100,
        timestamp: Date.now(),
      }),
      setWizardState: vi.fn().mockResolvedValue(undefined),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:add:back_to_name' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.handleBackToName(ctx);

    expect(mockService.setWizardState).toHaveBeenCalledWith(
      BigInt(7594239391),
      expect.objectContaining({ step: 'AWAIT_NAME' })
    );
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    expect(editMessageTextMock.mock.calls[0]![0]).toContain('الخطوة 1 من 5');
  });

  it('should accept custom site code via text and advance to SELECT_GOV', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'CONFIRM_CODE',
        name: 'فرع القاهرة',
        code: 'STE-01',
        promptMessageId: 100,
        timestamp: Date.now(),
      }),
      getSiteByCode: vi.fn().mockResolvedValue(null),
      setWizardState: vi.fn().mockResolvedValue(undefined),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const deleteMessageMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      message: { message_id: 201, text: 'CAI-01' },
      editMessageText: editMessageTextMock,
      deleteMessage: deleteMessageMock,
    } as unknown as SettingsModuleContext;

    const handled = await handler.handleTextInput(ctx);

    expect(handled).toBe(true);
    expect(mockService.setWizardState).toHaveBeenCalledWith(
      BigInt(7594239391),
      expect.objectContaining({ step: 'SELECT_GOV', code: 'CAI-01' })
    );
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    expect(editMessageTextMock.mock.calls[0]![0]).toContain('تحديد المحافظة');
  });

  it('should warn and re-prompt when custom site code already exists', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'CONFIRM_CODE',
        name: 'فرع القاهرة',
        code: 'STE-01',
        promptMessageId: 100,
        timestamp: Date.now(),
      }),
      getSiteByCode: vi.fn().mockResolvedValue({ id: 's-existing', code: 'CAI-01' }),
      setWizardState: vi.fn().mockResolvedValue(undefined),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const deleteMessageMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      message: { message_id: 202, text: 'CAI-01' },
      editMessageText: editMessageTextMock,
      deleteMessage: deleteMessageMock,
    } as unknown as SettingsModuleContext;

    const handled = await handler.handleTextInput(ctx);

    expect(handled).toBe(true);
    expect(mockService.setWizardState).not.toHaveBeenCalled();
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    expect(editMessageTextMock.mock.calls[0]![0]).toContain('مستخدم مسبقاً');
  });

  it('should parse text coordinates in handleTextInput when at AWAIT_LOCATION', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'AWAIT_LOCATION',
        name: 'موقع السويس',
        code: 'STE-01',
        promptMessageId: 100,
        timestamp: Date.now(),
      }),
      setWizardState: vi.fn().mockResolvedValue(undefined),
      getEditState: vi.fn().mockResolvedValue(null),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const deleteMessageMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      message: { message_id: 203, text: '29.9668, 32.5498' },
      editMessageText: editMessageTextMock,
      deleteMessage: deleteMessageMock,
    } as unknown as SettingsModuleContext;

    const handled = await handler.handleTextInput(ctx);

    expect(handled).toBe(true);
    expect(mockService.setWizardState).toHaveBeenCalledWith(
      BigInt(7594239391),
      expect.objectContaining({
        step: 'SELECT_GEOFENCE',
        latitude: expect.closeTo(29.9668),
        longitude: expect.closeTo(32.5498),
      })
    );
  });

  it('should parse Telegram venue in handleLocationInput', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'AWAIT_LOCATION',
        name: 'موقع السويس',
        code: 'STE-01',
        promptMessageId: 100,
        timestamp: Date.now(),
      }),
      setWizardState: vi.fn().mockResolvedValue(undefined),
      getEditState: vi.fn().mockResolvedValue(null),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const deleteMessageMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      message: {
        message_id: 204,
        venue: {
          location: { latitude: 29.9668, longitude: 32.5498 },
          title: 'Suez Site',
          address: 'Suez, Egypt',
        },
      },
      editMessageText: editMessageTextMock,
      deleteMessage: deleteMessageMock,
    } as unknown as SettingsModuleContext;

    const handled = await handler.handleLocationInput(ctx);

    expect(handled).toBe(true);
    expect(mockService.setWizardState).toHaveBeenCalledWith(
      BigInt(7594239391),
      expect.objectContaining({
        step: 'SELECT_GEOFENCE',
        latitude: expect.closeTo(29.9668),
        longitude: expect.closeTo(32.5498),
      })
    );
  });

  it('should navigate back to code step when handleBackToCode is triggered', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'SELECT_GOV',
        name: 'موقع السويس',
        code: 'STE-01',
        timestamp: Date.now(),
      }),
      setWizardState: vi.fn().mockResolvedValue(undefined),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:add:back_to_code' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.handleBackToCode(ctx);

    expect(mockService.setWizardState).toHaveBeenCalledWith(
      BigInt(7594239391),
      expect.objectContaining({ step: 'CONFIRM_CODE', code: 'STE-01' })
    );
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    expect(editMessageTextMock.mock.calls[0]![0]).toContain('تأكيد كود الموقع');
  });

  it('should navigate back to governorate step when handleBackToGov is triggered', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'SELECT_GEOFENCE',
        name: 'موقع السويس',
        code: 'STE-01',
        gov: 'السويس',
        timestamp: Date.now(),
      }),
      setWizardState: vi.fn().mockResolvedValue(undefined),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:add:back_to_gov' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.handleBackToGov(ctx);

    expect(mockService.setWizardState).toHaveBeenCalledWith(
      BigInt(7594239391),
      expect.objectContaining({ step: 'SELECT_GOV' })
    );
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    expect(editMessageTextMock.mock.calls[0]![0]).toContain('تحديد المحافظة');
  });

  it('should advance to AWAIT_LOCATION when governorate is selected in site creation', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'SELECT_GOV',
        name: 'موقع السويس',
        code: 'STE-01',
        promptMessageId: 100,
        timestamp: Date.now(),
      }),
      setWizardState: vi.fn().mockResolvedValue(undefined),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:add:gov:السويس' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.handleSelectGov(ctx, 'السويس');

    expect(mockService.setWizardState).toHaveBeenCalledWith(
      BigInt(7594239391),
      expect.objectContaining({ step: 'AWAIT_LOCATION', gov: 'السويس' })
    );
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    expect(editMessageTextMock.mock.calls[0]![0]).toContain('تحديد الموقع الجغرافي');
    expect(editMessageTextMock.mock.calls[0]![0]).toContain('الخطوة 4 من 5');
  });

  it('should capture GPS location and advance to SELECT_GEOFENCE', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'AWAIT_LOCATION',
        name: 'موقع السويس',
        code: 'STE-01',
        gov: 'السويس',
        promptMessageId: 100,
        timestamp: Date.now(),
      }),
      setWizardState: vi.fn().mockResolvedValue(undefined),
      getEditState: vi.fn().mockResolvedValue(null),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const deleteMessageMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      message: {
        message_id: 200,
        location: { latitude: 29.9668, longitude: 32.5498 },
      },
      editMessageText: editMessageTextMock,
      deleteMessage: deleteMessageMock,
    } as unknown as SettingsModuleContext;

    const handled = await handler.handleLocationInput(ctx);

    expect(handled).toBe(true);
    expect(mockService.setWizardState).toHaveBeenCalledWith(
      BigInt(7594239391),
      expect.objectContaining({
        step: 'SELECT_GEOFENCE',
        latitude: expect.closeTo(29.9668),
        longitude: expect.closeTo(32.5498),
      })
    );
  });

  it('should advance to SELECT_GEOFENCE on skip location', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'AWAIT_LOCATION',
        name: 'موقع السويس',
        code: 'STE-01',
        gov: 'السويس',
        promptMessageId: 100,
        timestamp: Date.now(),
      }),
      setWizardState: vi.fn().mockResolvedValue(undefined),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:add:skip_location' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.handleSkipLocation(ctx);

    expect(mockService.setWizardState).toHaveBeenCalledWith(
      BigInt(7594239391),
      expect.objectContaining({
        step: 'SELECT_GEOFENCE',
        latitude: undefined,
        longitude: undefined,
      })
    );
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    expect(editMessageTextMock.mock.calls[0]![0]).toContain('تحديد السياج الجغرافي');
    expect(editMessageTextMock.mock.calls[0]![0]).toContain('الخطوة 5 من 5');
  });

  it('should navigate back to location step when handleBackToLocation is triggered', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'SELECT_GEOFENCE',
        name: 'موقع السويس',
        code: 'STE-01',
        gov: 'السويس',
        promptMessageId: 100,
        timestamp: Date.now(),
      }),
      setWizardState: vi.fn().mockResolvedValue(undefined),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:add:back_to_location' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.handleBackToLocation(ctx);

    expect(mockService.setWizardState).toHaveBeenCalledWith(
      BigInt(7594239391),
      expect.objectContaining({ step: 'AWAIT_LOCATION' })
    );
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    expect(editMessageTextMock.mock.calls[0]![0]).toContain('تحديد الموقع الجغرافي');
  });

  it('should create site with coordinates and render completion keyboard', async () => {
    const mockCreatedSite = {
      id: 's-new',
      code: 'STE-09',
      name: 'موقع السويس للإنشاءات',
      status: 'ACTIVE' as const,
      governorate: 'السويس',
      projectId: null,
      geofenceRadiusMeters: 250,
      latitude: 29.9668,
      longitude: 32.5498,
      workerCount: 0,
    };

    const mockService = {
      getWizardState: vi.fn().mockResolvedValue({
        step: 'SELECT_GEOFENCE',
        name: 'موقع السويس للإنشاءات',
        code: 'STE-09',
        gov: 'السويس',
        latitude: 29.9668,
        longitude: 32.5498,
        promptMessageId: 100,
        timestamp: Date.now(),
      }),
      createSite: vi.fn().mockResolvedValue({ success: true, site: mockCreatedSite }),
      clearWizardState: vi.fn().mockResolvedValue(undefined),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:site:add:geofence:250' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.handleSelectGeofence(ctx, 250);

    expect(mockService.createSite).toHaveBeenCalledWith({
      name: 'موقع السويس للإنشاءات',
      code: 'STE-09',
      governorate: 'السويس',
      geofenceRadiusMeters: 250,
      projectId: undefined,
      latitude: 29.9668,
      longitude: 32.5498,
    });
    expect(mockService.clearWizardState).toHaveBeenCalledWith(BigInt(7594239391));
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);

    const callArgs = editMessageTextMock.mock.calls[0]!;
    expect(callArgs[0]).toContain('تم تسجيل وإنشاء الموقع بنجاح');
    expect(callArgs[0]).toContain('29.9668, 32.5498');

    // Section 5.2 Universal Post-Action Completion Keyboard buttons
    const keyboardRows = (callArgs[1] as { reply_markup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } }).reply_markup.inline_keyboard;
    expect(keyboardRows[0]![0]!.text).toBe('➕ إضافة موقع آخر');
    expect(keyboardRows[0]![0]!.callback_data).toBe('action:site:add_new');
    expect(keyboardRows[1]![0]!.text).toBe('🔙 العودة لقائمة المواقع');
    expect(keyboardRows[1]![0]!.callback_data).toBe('action:settings:sites_hub');
    expect(keyboardRows[2]![0]!.text).toBe('🏠 القائمة الرئيسية');
    expect(keyboardRows[2]![0]!.callback_data).toBe('action:main_menu');
  });

  it('should transform prompt message in-place and disable link preview when editing GPS location', async () => {
    const mockSite = {
      id: 's-1',
      code: 'STE-01',
      name: 'موقع السويس للإنشاءات',
      status: 'ACTIVE' as const,
      governorate: 'السويس',
      projectId: null,
      geofenceRadiusMeters: 250,
      latitude: 30.0444,
      longitude: 31.2357,
      workerCount: 5,
    };

    const mockService = {
      getWizardState: vi.fn().mockResolvedValue(null),
      getEditState: vi.fn().mockResolvedValue({
        siteCode: 'STE-01',
        fieldKey: 'location',
        promptMessageId: 777,
        timestamp: Date.now(),
      }),
      clearEditState: vi.fn().mockResolvedValue(undefined),
      updateField: vi.fn().mockResolvedValue({ success: true }),
      getSiteByCode: vi.fn().mockResolvedValue(mockSite),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextApiMock = vi.fn().mockResolvedValue({ message_id: 777 });
    const deleteMessageMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      chat: { id: -1001928374 },
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      message: {
        message_id: 888,
        location: { latitude: 30.0444, longitude: 31.2357 },
      },
      deleteMessage: deleteMessageMock,
      api: {
        editMessageText: editMessageTextApiMock,
      },
    } as unknown as SettingsModuleContext;

    const handled = await handler.handleLocationInput(ctx);

    expect(handled).toBe(true);
    expect(mockService.clearEditState).toHaveBeenCalledWith(BigInt(7594239391));
    expect(mockService.updateField).toHaveBeenCalledWith('STE-01', 'location', '30.0444,31.2357');
    expect(deleteMessageMock).toHaveBeenCalled();
    expect(editMessageTextApiMock).toHaveBeenCalledTimes(1);

    const [targetChatId, targetMsgId, promptText, extra] = editMessageTextApiMock.mock.calls[0] as [
      number,
      number,
      string,
      { link_preview_options?: { is_disabled: boolean }; reply_markup?: { inline_keyboard: unknown[][] } }
    ];

    expect(targetChatId).toBe(-1001928374);
    expect(targetMsgId).toBe(777);
    expect(promptText).toContain('بطاقة الموقع الميداني');
    expect(promptText).toContain('30.0444, 31.2357');
    expect(promptText).toContain('تم تحديث الموقع الجغرافي بنجاح');
    expect(extra?.link_preview_options?.is_disabled).toBe(true);
  });

  it('should transform prompt message in-place when editing text field', async () => {
    const mockSite = {
      id: 's-1',
      code: 'STE-01',
      name: 'موقع السويس الجديد',
      status: 'ACTIVE' as const,
      governorate: 'السويس',
      projectId: null,
      geofenceRadiusMeters: 250,
      latitude: null,
      longitude: null,
      workerCount: 5,
    };

    const mockService = {
      getWizardState: vi.fn().mockResolvedValue(null),
      getEditState: vi.fn().mockResolvedValue({
        siteCode: 'STE-01',
        fieldKey: 'name',
        promptMessageId: 666,
        timestamp: Date.now(),
      }),
      clearEditState: vi.fn().mockResolvedValue(undefined),
      updateField: vi.fn().mockResolvedValue({ success: true }),
      getSiteByCode: vi.fn().mockResolvedValue(mockSite),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextApiMock = vi.fn().mockResolvedValue({ message_id: 666 });
    const deleteMessageMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      chat: { id: -1001928374 },
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      message: {
        message_id: 889,
        text: 'موقع السويس الجديد',
      },
      deleteMessage: deleteMessageMock,
      api: {
        editMessageText: editMessageTextApiMock,
      },
    } as unknown as SettingsModuleContext;

    const handled = await handler.handleTextInput(ctx);

    expect(handled).toBe(true);
    expect(mockService.clearEditState).toHaveBeenCalledWith(BigInt(7594239391));
    expect(mockService.updateField).toHaveBeenCalledWith('STE-01', 'name', 'موقع السويس الجديد');
    expect(deleteMessageMock).toHaveBeenCalled();
    expect(editMessageTextApiMock).toHaveBeenCalledTimes(1);

    const [targetChatId, targetMsgId, promptText] = editMessageTextApiMock.mock.calls[0] as [
      number,
      number,
      string,
    ];
    expect(targetChatId).toBe(-1001928374);
    expect(targetMsgId).toBe(666);
    expect(promptText).toContain('موقع السويس الجديد');
    expect(promptText).toContain('تم تحديث [name] بنجاح.');
  });

  it('should display in-place warning when unparseable text is submitted during location edit', async () => {
    const mockService = {
      getWizardState: vi.fn().mockResolvedValue(null),
      getEditState: vi.fn().mockResolvedValue({
        siteCode: 'STE-01',
        fieldKey: 'location',
        promptMessageId: 777,
        timestamp: Date.now(),
      }),
      clearEditState: vi.fn().mockResolvedValue(undefined),
      updateField: vi.fn(),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextApiMock = vi.fn().mockResolvedValue({ message_id: 777 });
    const deleteMessageMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      chat: { id: -1001928374 },
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      message: {
        message_id: 990,
        text: 'شارع التحرير بدون إحداثيات',
      },
      deleteMessage: deleteMessageMock,
      api: {
        editMessageText: editMessageTextApiMock,
      },
    } as unknown as SettingsModuleContext;

    const handled = await handler.handleTextInput(ctx);

    expect(handled).toBe(true);
    expect(deleteMessageMock).toHaveBeenCalled();
    expect(mockService.updateField).not.toHaveBeenCalled();
    expect(editMessageTextApiMock).toHaveBeenCalledTimes(1);

    const [, targetMsgId, promptText] = editMessageTextApiMock.mock.calls[0] as [number, number, string];
    expect(targetMsgId).toBe(777);
    expect(promptText).toContain('تعذر قراءة الإحداثيات');
    expect(promptText).toContain('STE-01');
  });

  it('should render in-place failure notice when location update fails in handleLocationInput', async () => {
    const mockSite = {
      id: 's-1',
      code: 'STE-01',
      name: 'موقع السويس للإنشاءات',
      status: 'ACTIVE' as const,
      governorate: 'السويس',
      projectId: null,
      geofenceRadiusMeters: 250,
      latitude: null,
      longitude: null,
      workerCount: 5,
    };

    const mockService = {
      getWizardState: vi.fn().mockResolvedValue(null),
      getEditState: vi.fn().mockResolvedValue({
        siteCode: 'STE-01',
        fieldKey: 'location',
        promptMessageId: 777,
        timestamp: Date.now(),
      }),
      clearEditState: vi.fn().mockResolvedValue(undefined),
      updateField: vi.fn().mockResolvedValue({ success: false, error: 'Database locked' }),
      getSiteByCode: vi.fn().mockResolvedValue(mockSite),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextApiMock = vi.fn().mockResolvedValue({ message_id: 777 });
    const deleteMessageMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      chat: { id: -1001928374 },
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      message: {
        message_id: 888,
        location: { latitude: 30.0444, longitude: 31.2357 },
      },
      deleteMessage: deleteMessageMock,
      api: {
        editMessageText: editMessageTextApiMock,
      },
    } as unknown as SettingsModuleContext;

    const handled = await handler.handleLocationInput(ctx);

    expect(handled).toBe(true);
    expect(mockService.updateField).toHaveBeenCalledWith('STE-01', 'location', '30.0444,31.2357');
    expect(editMessageTextApiMock).toHaveBeenCalledTimes(1);

    const [, , promptText] = editMessageTextApiMock.mock.calls[0] as [number, number, string];
    expect(promptText).toContain('❌ فشل تحديث الموقع الجغرافي: Database locked');
  });

  it('should render in-place failure notice when text update fails in handleTextInput without raw reply', async () => {
    const mockSite = {
      id: 's-1',
      code: 'STE-01',
      name: 'موقع السويس',
      status: 'ACTIVE' as const,
      governorate: 'السويس',
      projectId: null,
      geofenceRadiusMeters: 250,
      latitude: null,
      longitude: null,
      workerCount: 5,
    };

    const mockService = {
      getWizardState: vi.fn().mockResolvedValue(null),
      getEditState: vi.fn().mockResolvedValue({
        siteCode: 'STE-01',
        fieldKey: 'name',
        promptMessageId: 666,
        timestamp: Date.now(),
      }),
      clearEditState: vi.fn().mockResolvedValue(undefined),
      updateField: vi.fn().mockResolvedValue({ success: false, error: 'Name already taken' }),
      getSiteByCode: vi.fn().mockResolvedValue(mockSite),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextApiMock = vi.fn().mockResolvedValue({ message_id: 666 });
    const deleteMessageMock = vi.fn().mockResolvedValue(true);
    const rawReplyMock = vi.fn();

    const ctx = {
      from: { id: 7594239391 },
      chat: { id: -1001928374 },
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: rawReplyMock,
      message: {
        message_id: 889,
        text: 'موقع مكرر',
      },
      deleteMessage: deleteMessageMock,
      api: {
        editMessageText: editMessageTextApiMock,
      },
    } as unknown as SettingsModuleContext;

    const handled = await handler.handleTextInput(ctx);

    expect(handled).toBe(true);
    expect(rawReplyMock).not.toHaveBeenCalled();
    expect(editMessageTextApiMock).toHaveBeenCalledTimes(1);

    const [, , promptText] = editMessageTextApiMock.mock.calls[0] as [number, number, string];
    expect(promptText).toContain('❌ فشل التحديث: Name already taken');
  });

  it('should clear editState when renderSiteDetail is invoked to prevent state leakage', async () => {
    const mockSite = {
      id: 's-1',
      code: 'STE-01',
      name: 'موقع السويس',
      status: 'ACTIVE' as const,
      governorate: 'السويس',
      projectId: null,
      geofenceRadiusMeters: 250,
      latitude: null,
      longitude: null,
      workerCount: 5,
    };

    const mockService = {
      clearEditState: vi.fn().mockResolvedValue(undefined),
      getSiteByCode: vi.fn().mockResolvedValue(mockSite),
    } as unknown as SitesHubService;

    const handler = new SitesHubHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue({});
    const answerCallbackMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      from: { id: 7594239391 },
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: { data: 'action:site:view:STE-01' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackMock,
    } as unknown as SettingsModuleContext;

    await handler.renderSiteDetail(ctx, 'STE-01', true);

    expect(mockService.clearEditState).toHaveBeenCalledWith(BigInt(7594239391));
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
  });
});
