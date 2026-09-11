import { describe, it, expect, vi } from 'vitest';
import {
  NotificationPolicyEngine,
  FEATURE_POLICIES_CATALOG,
  type PolicyStorageAdapter,
  UnifiedNotificationDispatcher,
  formatWhatsAppErrorReportText,
  buildWhatsAppErrorUrl,
} from '../src/index.js';

describe('NotificationPolicyEngine & Dispatcher', () => {
  class MockStorage implements PolicyStorageAdapter {
    private store = new Map<string, string>();
    async get(key: string): Promise<string | null> {
      return this.store.get(key) ?? null;
    }
    async set(key: string, value: string): Promise<unknown> {
      this.store.set(key, value);
      return 'OK';
    }
  }

  it('provides default policy from catalog when storage is empty', async () => {
    const engine = new NotificationPolicyEngine();
    const siteCigarettes = await engine.isSiteNotificationEnabled('canteen:cigarettes');
    const hqCigarettes = await engine.isHqNotificationEnabled('canteen:cigarettes');
    const silentCigarettes = await engine.isSilentNotification('canteen:cigarettes');

    // Canteen cigarettes defaults: disabled in site group, enabled in HQ, silent
    expect(siteCigarettes).toBe(false);
    expect(hqCigarettes).toBe(true);
    expect(silentCigarettes).toBe(true);

    // Advances cash defaults: enabled in site group, enabled in HQ, loud
    expect(await engine.isSiteNotificationEnabled('advances:cash')).toBe(true);
    expect(await engine.isHqNotificationEnabled('advances:cash')).toBe(true);
    expect(await engine.isSilentNotification('advances:cash')).toBe(false);
  });

  it('allows independent toggling of site and hq policies', async () => {
    const storage = new MockStorage();
    const engine = new NotificationPolicyEngine(storage);

    // Toggle site policy for cigarettes ON
    const nextSite = await engine.toggleSitePolicy('canteen:cigarettes');
    expect(nextSite).toBe(true);
    expect(await engine.isSiteNotificationEnabled('canteen:cigarettes')).toBe(true);

    // HQ policy remains independent
    expect(await engine.isHqNotificationEnabled('canteen:cigarettes')).toBe(true);

    // Toggle HQ policy for cigarettes OFF
    const nextHq = await engine.toggleHqPolicy('canteen:cigarettes');
    expect(nextHq).toBe(false);
    expect(await engine.isHqNotificationEnabled('canteen:cigarettes')).toBe(false);

    // Site policy is still ON! Complete independence!
    expect(await engine.isSiteNotificationEnabled('canteen:cigarettes')).toBe(true);
  });

  it('returns full policy matrix', async () => {
    const engine = new NotificationPolicyEngine();
    const matrix = await engine.getFullPolicyMatrix();
    expect(matrix.length).toBe(FEATURE_POLICIES_CATALOG.length);
    expect(matrix[0]).toHaveProperty('siteGroupEnabled');
    expect(matrix[0]).toHaveProperty('hqGroupEnabled');
    expect(matrix[0]).toHaveProperty('isSilent');
  });

  describe('UnifiedNotificationDispatcher', () => {
    it('dispatches to site group without inline buttons and to HQ topic independently', async () => {
      const storage = new MockStorage();
      const engine = new NotificationPolicyEngine(storage);
      const mockSendMessage = vi.fn().mockResolvedValue({ message_id: 123 });

      const dispatcher = new UnifiedNotificationDispatcher({
        policyEngine: engine,
        hqGroupId: -1009999999999n,
        forumConfig: {
          hqFinancialDigestsTopicId: 42,
        },
        api: {
          sendMessage: mockSendMessage,
        } as any,
      });

      // Enable both for advances:cash
      const result = await dispatcher.dispatch({
        featureKey: 'advances:cash',
        siteGroupId: -1001111111111n,
        siteNotification: {
          text: 'سلفة عامل بموقع قنا',
        },
        hqNotification: {
          category: 'HQ_FINANCIAL_DIGESTS',
          text: 'ملخص سلفة نقدية للإدارة',
        },
      });

      expect(result.siteSent).toBe(true);
      expect(result.hqSent).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledTimes(2);

      // Verify site group message had no reply_markup (Read-Only)
      expect(mockSendMessage).toHaveBeenNthCalledWith(
        1,
        -1001111111111,
        'سلفة عامل بموقع قنا',
        expect.objectContaining({
          disable_notification: false,
        })
      );
      expect((mockSendMessage.mock.calls[0] as any)?.[2]?.reply_markup).toBeUndefined();

      // Verify HQ message was routed to topic 42
      expect(mockSendMessage).toHaveBeenNthCalledWith(
        2,
        -1009999999999,
        'ملخص سلفة نقدية للإدارة',
        expect.objectContaining({
          message_thread_id: 42,
        })
      );
      expect((mockSendMessage.mock.calls[1] as any)?.[2]?.reply_markup).toBeUndefined();
    });

    it('skips site group when feature is toggled off for site', async () => {
      const storage = new MockStorage();
      const engine = new NotificationPolicyEngine(storage);
      // Ensure canteen:cigarettes site policy is off
      await storage.set('notif:policy:site:canteen:cigarettes', 'false');

      const mockSendMessage = vi.fn().mockResolvedValue({ message_id: 123 });

      const dispatcher = new UnifiedNotificationDispatcher({
        policyEngine: engine,
        hqGroupId: -1009999999999n,
        forumConfig: {
          hqFinancialDigestsTopicId: 42,
        },
        api: {
          sendMessage: mockSendMessage,
        } as any,
      });

      const result = await dispatcher.dispatch({
        featureKey: 'canteen:cigarettes',
        siteGroupId: -1001111111111n,
        siteNotification: {
          text: 'مسحوب سجائر',
        },
        hqNotification: {
          category: 'HQ_FINANCIAL_DIGESTS',
          text: 'إشعار سجائر للإدارة',
        },
      });

      expect(result.siteSent).toBe(false);
      expect(result.hqSent).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('WhatsApp Error Reporting Helpers', () => {
    it('formats error report text with reference and actor info', () => {
      const text = formatWhatsAppErrorReportText({
        errorReference: 'ERR-7890',
        actorName: 'م. أحمد حسن',
        actorTelegramId: 7594239391n,
        siteName: 'موقع منجم قنا',
      });

      expect(text).toContain('ERR-7890');
      expect(text).toContain('م. أحمد حسن');
      expect(text).toContain('7594239391');
      expect(text).toContain('موقع منجم قنا');
    });

    it('builds direct WhatsApp URL with normalized phone and encoded message', () => {
      const url = buildWhatsAppErrorUrl('01012345678', {
        errorReference: 'ERR-7890',
        actorName: 'ابو زين',
      });

      expect(url).toBeTruthy();
      expect(url).toContain('https://wa.me/201012345678?text=');
      expect(url).toContain(encodeURIComponent('ERR-7890'));
    });
  });
});
