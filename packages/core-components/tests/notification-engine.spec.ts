import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotificationPolicyEngine,
  FEATURE_POLICIES_CATALOG,
  type PolicyStorageAdapter,
  UnifiedNotificationDispatcher,
  formatWhatsAppErrorReportText,
  buildWhatsAppErrorUrl,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('NotificationPolicyEngine & Dispatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it('1. provides default policy from catalog when storage is empty', async () => {
    // Arrange
    const engine = new NotificationPolicyEngine();

    // Act
    const siteCigarettes = await engine.isSiteNotificationEnabled('canteen:cigarettes');
    const hqCigarettes = await engine.isHqNotificationEnabled('canteen:cigarettes');
    const silentCigarettes = await engine.isSilentNotification('canteen:cigarettes');
    const siteAdvances = await engine.isSiteNotificationEnabled('advances:cash');
    const hqAdvances = await engine.isHqNotificationEnabled('advances:cash');
    const silentAdvances = await engine.isSilentNotification('advances:cash');

    // Assert
    // Canteen cigarettes defaults: disabled in site group, enabled in HQ, silent
    expect(siteCigarettes).toBe(false);
    expect(hqCigarettes).toBe(true);
    expect(silentCigarettes).toBe(true);

    // Advances cash defaults: enabled in site group, enabled in HQ, loud
    expect(siteAdvances).toBe(true);
    expect(hqAdvances).toBe(true);
    expect(silentAdvances).toBe(false);

    expect(siteCigarettes).not.toBe(siteAdvances);
  });

  it('2. allows independent toggling of site and hq policies', async () => {
    // Arrange
    const storage = new MockStorage();
    const engine = new NotificationPolicyEngine(storage);

    // Act
    // Toggle site policy for cigarettes ON
    const nextSite = await engine.toggleSitePolicy('canteen:cigarettes');
    const siteEnabled = await engine.isSiteNotificationEnabled('canteen:cigarettes');
    const hqBefore = await engine.isHqNotificationEnabled('canteen:cigarettes');

    // Toggle HQ policy for cigarettes OFF
    const nextHq = await engine.toggleHqPolicy('canteen:cigarettes');
    const hqAfter = await engine.isHqNotificationEnabled('canteen:cigarettes');
    const siteStillEnabled = await engine.isSiteNotificationEnabled('canteen:cigarettes');

    // Assert
    expect(nextSite).toBe(true);
    expect(siteEnabled).toBe(true);
    expect(hqBefore).toBe(true);
    expect(nextHq).toBe(false);
    expect(hqAfter).toBe(false);
    expect(siteStillEnabled).toBe(true);
    expect(hqAfter).not.toBe(siteStillEnabled);
  });

  it('3. returns full policy matrix matching catalog count', async () => {
    // Arrange
    const engine = new NotificationPolicyEngine();

    // Act
    const matrix = await engine.getFullPolicyMatrix();

    // Assert
    expect(matrix.length).toBe(FEATURE_POLICIES_CATALOG.length);
    expect(matrix.length).toBeGreaterThan(0);
    expect(matrix[0]).toHaveProperty('siteGroupEnabled');
    expect(matrix[0]).toHaveProperty('hqGroupEnabled');
    expect(matrix[0]).toHaveProperty('isSilent');
    expect(matrix[0]?.featureKey).toBeDefined();
    expect(matrix[0]?.featureKey).not.toBe('');
  });

  describe('UnifiedNotificationDispatcher', () => {
    it('4. dispatches to site group without inline buttons and to HQ topic independently', async () => {
      // Arrange
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

      // Act
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

      // Assert
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
      expect(result.siteSent).not.toBe(false);
    });

    it('5. skips site group when feature is toggled off for site', async () => {
      // Arrange
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

      // Act
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

      // Assert
      expect(result.siteSent).toBe(false);
      expect(result.hqSent).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(result.siteSent).not.toBe(result.hqSent);
    });
  });

  describe('WhatsApp Error Reporting Helpers', () => {
    it('6. formats error report text with reference and actor info', () => {
      // Arrange
      const input = {
        errorReference: 'ERR-7890',
        actorName: 'م. أحمد حسن',
        actorTelegramId: 7594239391n,
        siteName: 'موقع منجم قنا',
      };

      // Act
      const text = formatWhatsAppErrorReportText(input);

      // Assert
      expect(text).toContain('ERR-7890');
      expect(text).toContain('م. أحمد حسن');
      expect(text).toContain('7594239391');
      expect(text).toContain('موقع منجم قنا');
      expect(text).not.toContain('undefined');
    });

    it('7. builds direct WhatsApp URL with normalized phone and encoded message', () => {
      // Arrange
      const phone = '01012345678';
      const data = {
        errorReference: 'ERR-7890',
        actorName: 'ابو زين',
      };

      // Act
      const url = buildWhatsAppErrorUrl(phone, data);

      // Assert
      expect(url).toBeTruthy();
      expect(url).toContain('https://wa.me/201012345678?text=');
      expect(url).toContain(encodeURIComponent('ERR-7890'));
      expect(url).not.toContain('ERR-9999');
    });
  });
});
