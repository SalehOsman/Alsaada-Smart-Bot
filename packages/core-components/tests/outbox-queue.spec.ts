import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransactionalOutboxQueue } from '../src/outbox-queue/worker.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Transactional Outbox Queue — Tests', () => {
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

  it('1. enqueues outbox events with PENDING status and default retries', async () => {
    // Arrange
    const queue = new TransactionalOutboxQueue();

    // Act
    const event = queue.enqueue({
      eventType: 'SHEETS_APPEND_ROW',
      targetSheet: 'Advances_Master',
      payload: { advanceId: 'ADV-01', amount: 500 },
    });
    const pendingCount = await queue.getPendingCount();

    // Assert
    expect(event.id).toMatch(/^outbox_\d+_[a-z0-9]+$/);
    expect(event.status).toBe('PENDING');
    expect(event.retryCount).toBe(0);
    expect(event.maxRetries).toBe(5);
    expect(pendingCount).toBe(1);
    expect(event.targetSheet).toBe('Advances_Master');
    expect(event.payload).toEqual({ advanceId: 'ADV-01', amount: 500 });
  });

  it('2. processes pending events via registered handler and marks COMPLETED', async () => {
    // Arrange
    const queue = new TransactionalOutboxQueue();
    const mockHandler = vi.fn().mockResolvedValue(undefined);

    queue.registerHandler('SHEETS_APPEND_ROW', mockHandler);
    const event = queue.enqueue({
      eventType: 'SHEETS_APPEND_ROW',
      targetSheet: 'Advances_Master',
      payload: { advanceId: 'ADV-02', amount: 1000 },
    });

    // Act
    const res = await queue.processBatch();
    const remainingPending = await queue.getPendingCount();

    // Assert
    expect(res.processedCount).toBe(1);
    expect(res.successCount).toBe(1);
    expect(res.failureCount).toBe(0);
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SHEETS_APPEND_ROW',
        payload: { advanceId: 'ADV-02', amount: 1000 },
      })
    );
    expect(remainingPending).toBe(0);
    expect(event.status).toBe('COMPLETED');
    expect(event.errorMessage).toBeUndefined();
  });

  it('3. retries failed events and marks dead letter when max retries exceeded', async () => {
    // Arrange
    const queue = new TransactionalOutboxQueue();
    const failingHandler = vi.fn().mockRejectedValue(new Error('Google Sheets API 503 Rate Limit'));

    queue.registerHandler('SHEETS_APPEND_ROW', failingHandler);
    const event = queue.enqueue({
      eventType: 'SHEETS_APPEND_ROW',
      targetSheet: 'Advances_Master',
      payload: { advanceId: 'ADV-03', amount: 750 },
      maxRetries: 2,
    });

    // Act 1st attempt: fails, retryCount = 1, stays PENDING
    const attempt1 = await queue.processBatch();
    const pendingAfterFirst = await queue.getPendingCount();

    // Assert 1st attempt
    expect(attempt1.failureCount).toBe(1);
    expect(attempt1.deadLetterCount).toBe(0);
    expect(pendingAfterFirst).toBe(1);
    expect(event.status).toBe('PENDING');

    // Act 2nd attempt: fails, retryCount = 2, reaches maxRetries -> becomes FAILED
    const attempt2 = await queue.processBatch();
    const pendingAfterSecond = await queue.getPendingCount();

    // Assert 2nd attempt
    expect(attempt2.failureCount).toBe(1);
    expect(attempt2.deadLetterCount).toBe(1);
    expect(pendingAfterSecond).toBe(0);
    expect(failingHandler).toHaveBeenCalledTimes(2);
    expect(event.status).toBe('FAILED');
    expect(event.errorMessage).toContain('Google Sheets API 503 Rate Limit');
  });

  it('4. marks unhandled event type directly as failed dead letter', async () => {
    // Arrange
    const queue = new TransactionalOutboxQueue();
    const event = queue.enqueue({
      eventType: 'UNKNOWN_OR_UNREGISTERED_EVENT',
      targetSheet: 'Audit',
      payload: { reason: 'test-fallback' },
    });

    // Act
    const res = await queue.processBatch();
    const remainingPending = await queue.getPendingCount();

    // Assert
    expect(res.processedCount).toBe(1);
    expect(res.successCount).toBe(0);
    expect(res.failureCount).toBe(1);
    expect(res.deadLetterCount).toBe(1);
    expect(remainingPending).toBe(0);
    expect(event.status).toBe('FAILED');
    expect(event.errorMessage).toContain('No handler registered');
  });
});
