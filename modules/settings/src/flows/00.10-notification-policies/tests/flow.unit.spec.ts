import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Redis } from 'ioredis';
import type { SettingsModuleContext } from '../../../shared/module.types.js';
import { NotificationPoliciesService } from '../flow.service.js';
import { NotificationPoliciesHandler } from '../flow.handler.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

interface MockSettingsContext {
  isRealSuperAdmin: boolean;
  effectiveRole: string;
  isImpersonating: boolean;
  callbackQuery: Record<string, unknown>;
  answerCallbackQuery: ReturnType<typeof vi.fn>;
  editMessageText?: ReturnType<typeof vi.fn>;
}

describe('Flow 00.10 Unit Spec — Notification Policies Hub', () => {
  let mockRedis: Redis;
  let service: NotificationPoliciesService;
  let handler: NotificationPoliciesHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

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

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Service: Dual-Tier Policy Management', () => {
    it('returns department summaries correctly for site scope', async () => {
      // Arrange
      const scope = 'site';

      // Act
      const summaries = await service.getScopeDepartmentSummaries(scope);

      // Assert
      expect(summaries.length).toBeGreaterThan(0);
      const canteenDept = summaries.find((d) => d.departmentKey === 'canteen');
      expect(canteenDept).toBeDefined();
      expect(canteenDept?.totalFeatures).toBe(3);
    });

    it('independently toggles site and hq policies without cross-contamination', async () => {
      // Arrange
      const detailSiteBefore = await service.getDepartmentDetail('site', 'canteen');
      const cigSiteBefore = detailSiteBefore.features.find((f) => f.featureKey === 'canteen:cigarettes');
      expect(cigSiteBefore?.enabled).toBe(false);

      // Act
      const nextSite = await service.toggleFeaturePolicy('site', 'canteen:cigarettes');
      const detailSiteAfter = await service.getDepartmentDetail('site', 'canteen');
      const detailHqAfter = await service.getDepartmentDetail('hq', 'canteen');

      // Assert
      expect(nextSite).toBe(true);
      expect(detailSiteAfter.features.find((f) => f.featureKey === 'canteen:cigarettes')?.enabled).toBe(true);
      expect(detailHqAfter.features.find((f) => f.featureKey === 'canteen:cigarettes')?.enabled).toBe(true);
    });

    it('toggles silent notification mode back and forth', async () => {
      // Arrange
      const featureKey = 'advances:cash';

      // Act
      const isSilentNow = await service.toggleFeatureSilent(featureKey);
      const isSilentReverted = await service.toggleFeatureSilent(featureKey);

      // Assert
      expect(isSilentNow).toBe(true);
      expect(isSilentReverted).toBe(false);
    });

    it('resets scope overrides to catalog defaults', async () => {
      // Arrange
      await service.toggleFeaturePolicy('site', 'canteen:cigarettes');

      // Act
      await service.resetScopeToDefaults('site');
      const detail = await service.getDepartmentDetail('site', 'canteen');
      const cig = detail.features.find((f) => f.featureKey === 'canteen:cigarettes');

      // Assert
      expect(cig?.enabled).toBe(false);
    });
  });

  describe('Handler: RBAC & Toggles', () => {
    it('blocks non-super admin users from viewing policies hub', async () => {
      // Arrange
      const mockCtx: MockSettingsContext = {
        isRealSuperAdmin: false,
        effectiveRole: 'ACCOUNTANT',
        isImpersonating: false,
        callbackQuery: {},
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
      };

      // Act
      await handler.renderPoliciesHub(mockCtx as unknown as SettingsModuleContext, true);

      // Assert
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({ show_alert: true })
      );
    });

    it('handles toggle callback successfully for super admin', async () => {
      // Arrange
      const mockCtx: MockSettingsContext = {
        isRealSuperAdmin: true,
        effectiveRole: 'SUPER_ADMIN',
        isImpersonating: false,
        callbackQuery: {},
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockResolvedValue(true),
      };

      // Act
      await handler.handleToggleFeature(mockCtx as unknown as SettingsModuleContext, 'site', 'canteen:cigarettes');

      // Assert
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('تم تفعيل الإشعار') })
      );
      expect(mockCtx.editMessageText).toHaveBeenCalled();
    });
  });
});
