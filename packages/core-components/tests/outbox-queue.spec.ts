import { describe, it, expect, vi } from 'vitest';
import { TransactionalOutboxQueue } from '../src/outbox-queue/worker.js';

describe('Transactional Outbox Queue — Tests', () => {
  it('should enqueue outbox events with PENDING status and default retries', async () => {
    const queue = new TransactionalOutboxQueue();
    const event = queue.enqueue({
      eventType: 'SHEETS_APPEND_ROW',
      targetSheet: 'Advances_Master',
      payload: { advanceId: 'ADV-01', amount: 500 },
    });

    expect(event.id).toBeDefined();
    expect(event.status).toBe('PENDING');
    expect(event.retryCount).toBe(0);
    expect(event.maxRetries).toBe(5);
    expect(await queue.getPendingCount()).toBe(1);
  });

  it('should process pending events via registered handler and mark COMPLETED', async () => {
    const queue = new TransactionalOutboxQueue();
    const mockHandler = vi.fn().mockResolvedValue(undefined);

    queue.registerHandler('SHEETS_APPEND_ROW', mockHandler);
    queue.enqueue({
      eventType: 'SHEETS_APPEND_ROW',
      targetSheet: 'Advances_Master',
      payload: { advanceId: 'ADV-02', amount: 1000 },
    });

    const res = await queue.processBatch();
    expect(res.processedCount).toBe(1);
    expect(res.successCount).toBe(1);
    expect(res.failureCount).toBe(0);
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(await queue.getPendingCount()).toBe(0);
  });

  it('should retry failed events and mark dead letter when max retries exceeded', async () => {
    const queue = new TransactionalOutboxQueue();
    const failingHandler = vi.fn().mockRejectedValue(new Error('Google Sheets API 503 Rate Limit'));

    queue.registerHandler('SHEETS_APPEND_ROW', failingHandler);
    queue.enqueue({
      eventType: 'SHEETS_APPEND_ROW',
      targetSheet: 'Advances_Master',
      payload: { advanceId: 'ADV-03', amount: 750 },
      maxRetries: 2,
    });

    // 1st attempt: fails, retryCount = 1, stays PENDING
    const attempt1 = await queue.processBatch();
    expect(attempt1.failureCount).toBe(1);
    expect(attempt1.deadLetterCount).toBe(0);
    expect(await queue.getPendingCount()).toBe(1);

    // 2nd attempt: fails, retryCount = 2, reaches maxRetries -> becomes FAILED
    const attempt2 = await queue.processBatch();
    expect(attempt2.failureCount).toBe(1);
    expect(attempt2.deadLetterCount).toBe(1);
    expect(await queue.getPendingCount()).toBe(0);
  });
});
