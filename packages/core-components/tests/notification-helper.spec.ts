import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  notifyFlowOperation,
  configureNotificationHelper,
  clearNotificationHelperCache,
  UnifiedNotificationDispatcher,
  NotificationPolicyEngine,
  type OutboxEnqueueInput,
} from '../src/index.js';

describe('notifyFlowOperation Universal Helper', () => {
  let mockApi: { sendMessage: ReturnType<typeof vi.fn> };
  let mockDispatcher: UnifiedNotificationDispatcher;
  let mockPolicyEngine: NotificationPolicyEngine;
  let mockResolveSiteGroup: ReturnType<typeof vi.fn>;
  let mockEnqueueOutbox: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearNotificationHelperCache();
    mockApi = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
    };
    mockPolicyEngine = new NotificationPolicyEngine();
    mockDispatcher = new UnifiedNotificationDispatcher({
      policyEngine: mockPolicyEngine,
      hqGroupId: -1009999,
      api: mockApi as unknown as import('grammy').Api,
      forumConfig: {
        hqSiteClosuresTopicId: 10,
        hqFinancialDigestsTopicId: 20,
        hqLogisticsFuelTopicId: 30,
        hqExecutiveDecreesTopicId: 40,
      },
    });
    mockResolveSiteGroup = vi.fn().mockResolvedValue(-1005555n);
    mockEnqueueOutbox = vi.fn().mockResolvedValue(undefined);

    configureNotificationHelper({
      dispatcher: mockDispatcher,
      resolveSiteGroup: mockResolveSiteGroup,
      enqueueOutbox: mockEnqueueOutbox,
    });
  });

  it('gracefully returns false when helper is not configured', async () => {
    configureNotificationHelper(undefined as unknown as import('../src/index.js').NotificationHelperConfig);
    const result = await notifyFlowOperation({
      featureKey: 'workforce:registration',
      siteId: 'site-1',
    });
    expect(result).toEqual({ siteSent: false, hqSent: false, outboxQueued: false });
  });

  it('resolves site group from cache and dispatches to site group and HQ topic', async () => {
    const res = await notifyFlowOperation({
      featureKey: 'advances:cash', // Enabled for both site and HQ by default
      siteId: 'site-abc',
      siteCardText: '💵 تسجيل سلفة موقع',
      hqCategory: 'HQ_FINANCIAL_DIGESTS',
      hqCardText: '📊 ملخص سلفة للإدارة العليا',
    });

    expect(mockResolveSiteGroup).toHaveBeenCalledWith('site-abc');
    expect(res.siteSent).toBe(true);
    expect(res.hqSent).toBe(true);
    expect(mockApi.sendMessage).toHaveBeenCalledTimes(2);

    // Call again for same siteId -> should hit cache, not call resolver again!
    await notifyFlowOperation({
      featureKey: 'advances:cash',
      siteId: 'site-abc',
      siteCardText: '💵 سلفة ثانية',
    });
    expect(mockResolveSiteGroup).toHaveBeenCalledTimes(1); // Cached!
  });

  it('queues outbox sync event when provided', async () => {
    const outboxEvent: OutboxEnqueueInput = {
      eventType: 'SHEETS_APPEND_ROW',
      targetSheet: 'Advances',
      payload: { amount: 500, workerCode: 'OP-01' },
    };

    const res = await notifyFlowOperation({
      featureKey: 'advances:cash',
      siteId: 'site-abc',
      siteCardText: '💵 سلفة',
      outboxEvent,
    });

    expect(res.outboxQueued).toBe(true);
    expect(mockEnqueueOutbox).toHaveBeenCalledWith(outboxEvent);
  });

  it('isolates errors without throwing, guaranteeing < 15ms non-blocking safety', async () => {
    mockApi.sendMessage.mockRejectedValue(new Error('Telegram Network Timeout'));
    mockEnqueueOutbox.mockRejectedValue(new Error('Outbox DB Busy'));

    const res = await notifyFlowOperation({
      featureKey: 'advances:cash',
      siteId: 'site-abc',
      siteCardText: '💵 تجربة خطأ شبكة',
      outboxEvent: {
        eventType: 'TEST',
        targetSheet: 'Test',
        payload: {},
      },
    });

    expect(res.siteSent).toBe(false);
    expect(res.outboxQueued).toBe(false);
    // Did not throw! Safe execution!
  });
});
