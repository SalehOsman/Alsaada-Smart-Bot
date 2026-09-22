import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  notifyFlowOperation,
  configureNotificationHelper,
  clearNotificationHelperCache,
  UnifiedNotificationDispatcher,
  NotificationPolicyEngine,
  type OutboxEnqueueInput,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('notifyFlowOperation Universal Helper', () => {
  let mockApi: { sendMessage: ReturnType<typeof vi.fn> };
  let mockDispatcher: UnifiedNotificationDispatcher;
  let mockPolicyEngine: NotificationPolicyEngine;
  let mockResolveSiteGroup: ReturnType<typeof vi.fn>;
  let mockEnqueueOutbox: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('1. gracefully returns false when helper is not configured', async () => {
    // Arrange
    configureNotificationHelper(undefined as unknown as import('../src/index.js').NotificationHelperConfig);
    const input = {
      featureKey: 'workforce:registration',
      siteId: 'site-1',
    };

    // Act
    const result = await notifyFlowOperation(input);

    // Assert
    expect(result).toEqual({ siteSent: false, hqSent: false, outboxQueued: false });
    expect(mockApi.sendMessage).not.toHaveBeenCalled();
  });

  it('2. resolves site group from cache and dispatches to site group and HQ topic', async () => {
    // Arrange
    const inputFirst = {
      featureKey: 'advances:cash', // Enabled for both site and HQ by default
      siteId: 'site-abc',
      siteCardText: '💵 تسجيل سلفة موقع',
      hqCategory: 'HQ_FINANCIAL_DIGESTS' as const,
      hqCardText: '📊 ملخص سلفة للإدارة العليا',
    };

    // Act
    const res = await notifyFlowOperation(inputFirst);

    // Assert
    expect(mockResolveSiteGroup).toHaveBeenCalledWith('site-abc');
    expect(res.siteSent).toBe(true);
    expect(res.hqSent).toBe(true);
    expect(mockApi.sendMessage).toHaveBeenCalledTimes(2);

    // Act again for same siteId -> hits cache without re-invoking resolver
    await notifyFlowOperation({
      featureKey: 'advances:cash',
      siteId: 'site-abc',
      siteCardText: '💵 سلفة ثانية',
    });

    // Assert cache hit
    expect(mockResolveSiteGroup).toHaveBeenCalledTimes(1);
    expect(mockApi.sendMessage).toHaveBeenCalledTimes(3);
  });

  it('3. queues outbox sync event when provided', async () => {
    // Arrange
    const outboxEvent: OutboxEnqueueInput = {
      eventType: 'SHEETS_APPEND_ROW',
      targetSheet: 'Advances',
      payload: { amount: 500, workerCode: 'OP-01' },
    };

    // Act
    const res = await notifyFlowOperation({
      featureKey: 'advances:cash',
      siteId: 'site-abc',
      siteCardText: '💵 سلفة',
      outboxEvent,
    });

    // Assert
    expect(res.outboxQueued).toBe(true);
    expect(mockEnqueueOutbox).toHaveBeenCalledWith(outboxEvent);
    expect(res.siteSent).toBe(true);
  });

  it('4. isolates errors without throwing, guaranteeing non-blocking safety', async () => {
    // Arrange
    mockApi.sendMessage.mockRejectedValue(new Error('Telegram Network Timeout'));
    mockEnqueueOutbox.mockRejectedValue(new Error('Outbox DB Busy'));

    // Act
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

    // Assert
    expect(res.siteSent).toBe(false);
    expect(res.outboxQueued).toBe(false);
    expect(res.hqSent).toBe(false);
  });
});
