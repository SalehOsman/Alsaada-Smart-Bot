import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Redis } from 'ioredis';
import type { SettingsModuleContext } from '../../../shared/module.types.js';
import { NotificationPoliciesService } from '../flow.service.js';
import { NotificationPoliciesHandler } from '../flow.handler.js';

interface MockSettingsContext {
  isRealSuperAdmin: boolean;
  effectiveRole: string;
  isImpersonating: boolean;
  callbackQuery: Record<string, unknown>;
  answerCallbackQuery: ReturnType<typeof vi.fn>;
  editMessageText?: ReturnType<typeof vi.fn>;
}

describe('Flow 00.10: Notification Policies Hub', () => {
  let mockRedis: Redis;
  let service: NotificationPoliciesService;
  let handler: NotificationPoliciesHandler;

  beforeEach(() => {
    const redisStore: Record<string, string> = {};

    mockRedis = {
      get: vi.fn().mockImplementation((k: string) => Promise.resolve(redisStore[k] || null)),
      set: vi.fn().mockImplementation((k: string, v: string) => {
        redisStore[k] = v;
        return Promise.resolve('OK');
      }),
      del: vi.fn().mockImplementation((...keys: string[]) => {
        for (const k of keys) delete redisStore[k];
        return Promise.resolve(keys.length);
      }),
      keys: vi.fn().mockImplementation((pattern: string) => {
        const prefix = pattern.replace('*', '');
        return Promise.resolve(Object.keys(redisStore).filter((k) => k.startsWith(prefix)));
      }),
    } as unknown as Redis;

    service = new NotificationPoliciesService(mockRedis);
    handler = new NotificationPoliciesHandler(service);
  });

  describe('Service: Dual-Tier Policy Management', () => {
    it('returns department summaries correctly for site scope', async () => {
      const summaries = await service.getScopeDepartmentSummaries('site');
      expect(summaries.length).toBeGreaterThan(0);
      const canteenDept = summaries.find((d) => d.departmentKey === 'canteen');
      expect(canteenDept).toBeDefined();
      expect(canteenDept?.totalFeatures).toBe(3);
    });

    it('independently toggles site and hq policies without cross-contamination', async () => {
      // Default cigarettes: site=false, hq=true
      const detailSiteBefore = await service.getDepartmentDetail('site', 'canteen');
      const cigSiteBefore = detailSiteBefore.features.find((f) => f.featureKey === 'canteen:cigarettes');
      expect(cigSiteBefore?.enabled).toBe(false);

      const detailHqBefore = await service.getDepartmentDetail('hq', 'canteen');
      const cigHqBefore = detailHqBefore.features.find((f) => f.featureKey === 'canteen:cigarettes');
      expect(cigHqBefore?.enabled).toBe(true);

      // Toggle site policy ON
      const nextSite = await service.toggleFeaturePolicy('site', 'canteen:cigarettes');
      expect(nextSite).toBe(true);

      // Site is now ON, HQ remains unchanged (ON)
      const detailSiteAfter = await service.getDepartmentDetail('site', 'canteen');
      expect(detailSiteAfter.features.find((f) => f.featureKey === 'canteen:cigarettes')?.enabled).toBe(true);

      const detailHqAfter = await service.getDepartmentDetail('hq', 'canteen');
      expect(detailHqAfter.features.find((f) => f.featureKey === 'canteen:cigarettes')?.enabled).toBe(true);

      // Toggle HQ policy OFF
      const nextHq = await service.toggleFeaturePolicy('hq', 'canteen:cigarettes');
      expect(nextHq).toBe(false);

      // Site is still ON, HQ is now OFF
      const detailSiteFinal = await service.getDepartmentDetail('site', 'canteen');
      expect(detailSiteFinal.features.find((f) => f.featureKey === 'canteen:cigarettes')?.enabled).toBe(true);

      const detailHqFinal = await service.getDepartmentDetail('hq', 'canteen');
      expect(detailHqFinal.features.find((f) => f.featureKey === 'canteen:cigarettes')?.enabled).toBe(false);
    });

    it('toggles silent notification mode', async () => {
      const isSilentNow = await service.toggleFeatureSilent('advances:cash');
      expect(isSilentNow).toBe(true); // default was false

      const isSilentReverted = await service.toggleFeatureSilent('advances:cash');
      expect(isSilentReverted).toBe(false);
    });

    it('resets scope overrides to catalog defaults', async () => {
      await service.toggleFeaturePolicy('site', 'canteen:cigarettes'); // site ON
      await service.resetScopeToDefaults('site');

      const detail = await service.getDepartmentDetail('site', 'canteen');
      const cig = detail.features.find((f) => f.featureKey === 'canteen:cigarettes');
      expect(cig?.enabled).toBe(false); // returned to catalog default
    });
  });

  describe('Handler: RBAC & Toggles', () => {
    it('blocks non-super admin users', async () => {
      const mockCtx: MockSettingsContext = {
        isRealSuperAdmin: false,
        effectiveRole: 'ACCOUNTANT',
        isImpersonating: false,
        callbackQuery: {},
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
      };

      await handler.renderPoliciesHub(mockCtx as unknown as SettingsModuleContext, true);
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({ show_alert: true })
      );
    });

    it('handles toggle callback successfully for super admin', async () => {
      const mockCtx: MockSettingsContext = {
        isRealSuperAdmin: true,
        effectiveRole: 'SUPER_ADMIN',
        isImpersonating: false,
        callbackQuery: {},
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockResolvedValue(true),
      };

      await handler.handleToggleFeature(mockCtx as unknown as SettingsModuleContext, 'site', 'canteen:cigarettes');
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('تم تفعيل الإشعار') })
      );
      expect(mockCtx.editMessageText).toHaveBeenCalled();
    });
  });
});
