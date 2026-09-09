import type { OutboxEvent, OutboxEnqueueInput, OutboxProcessResult } from './types.js';

export type OutboxHandler<T = any> = (event: OutboxEvent<T>) => Promise<void>;

export class TransactionalOutboxQueue {
  private readonly queue: OutboxEvent[] = [];
  private readonly handlers = new Map<string, OutboxHandler>();

  /**
   * 📥 إدراج حدث جديد في طابور الـ Outbox المحلي
   */
  enqueue<T = any>(input: OutboxEnqueueInput<T>): OutboxEvent<T> {
    const event: OutboxEvent<T> = {
      id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      eventType: input.eventType,
      targetSheet: input.targetSheet,
      payload: input.payload,
      retryCount: 0,
      maxRetries: input.maxRetries ?? 5,
      status: 'PENDING',
      createdAt: Date.now(),
    };
    this.queue.push(event);
    return event;
  }

  /**
   * ⚙️ تسجيل معالج لنوع معين من الأحداث (مثل ترحيل صف لشيت معين)
   */
  registerHandler<T = any>(eventType: string, handler: OutboxHandler<T>): void {
    this.handlers.set(eventType, handler);
  }

  /**
   * 🔍 استرجاع عدد الأحداث المعلقة
   */
  getPendingCount(): number {
    return this.queue.filter((e) => e.status === 'PENDING').length;
  }

  /**
   * 🔄 معالجة دفعة من أحداث الطابور في الخلفية مع سياسة إعادة المحاولة الأسية
   */
  async processBatch(batchSize = 20): Promise<OutboxProcessResult> {
    const pendingEvents = this.queue
      .filter((e) => e.status === 'PENDING')
      .slice(0, batchSize);

    const result: OutboxProcessResult = {
      processedCount: pendingEvents.length,
      successCount: 0,
      failureCount: 0,
      deadLetterCount: 0,
    };

    for (const event of pendingEvents) {
      event.status = 'PROCESSING';
      event.lastAttemptAt = Date.now();
      const handler = this.handlers.get(event.eventType);

      if (!handler) {
        event.status = 'FAILED';
        event.errorMessage = `No handler registered for event type: ${event.eventType}`;
        result.failureCount++;
        result.deadLetterCount++;
        continue;
      }

      try {
        await handler(event);
        event.status = 'COMPLETED';
        result.successCount++;
      } catch (err: any) {
        event.retryCount++;
        event.errorMessage = err.message || 'Unknown processing error';

        if (event.retryCount >= event.maxRetries) {
          event.status = 'FAILED';
          result.deadLetterCount++;
        } else {
          event.status = 'PENDING'; // ستعاد محاولته في الدفعة القادمة
        }
        result.failureCount++;
      }
    }

    return result;
  }
}
