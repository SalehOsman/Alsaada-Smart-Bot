import type { OutboxEvent, OutboxEnqueueInput, OutboxProcessResult } from './types.js';

export type OutboxHandler<T = Record<string, unknown>> = (event: OutboxEvent<T>) => Promise<void>;

export class TransactionalOutboxQueue {
  private readonly queue: OutboxEvent[] = [];
  private readonly handlers = new Map<string, OutboxHandler<any>>();

  /**
   * 📥 إدراج حدث جديد في طابور الـ Outbox المحلي
   */
  enqueue<T = Record<string, unknown>>(input: OutboxEnqueueInput<T>): OutboxEvent<T> {
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
    this.queue.push(event as unknown as OutboxEvent);
    return event;
  }

  /**
   * ⚙️ تسجيل معالج لنوع معين من الأحداث (مثل ترحيل صف لشيت معين)
   */
  registerHandler<T = Record<string, unknown>>(eventType: string, handler: OutboxHandler<T>): void {
    this.handlers.set(eventType, handler as OutboxHandler<any>);
  }

  /**
   * 🔍 استرجاع عدد الأحداث المعلقة
   */
  getPendingCount(): number {
    return this.queue.filter((e) => e.status === 'PENDING').length;
  }

  /**
   * 🔄 معالجة دفعة من أحداث الطابور بالتوازي المنضبط مع سياسة إعادة المحاولة الأسية
   */
  async processBatch(batchSize = 20, concurrency = 5): Promise<OutboxProcessResult> {
    const pendingEvents = this.queue
      .filter((e) => e.status === 'PENDING')
      .slice(0, batchSize);

    const result: OutboxProcessResult = {
      processedCount: pendingEvents.length,
      successCount: 0,
      failureCount: 0,
      deadLetterCount: 0,
    };

    for (let i = 0; i < pendingEvents.length; i += concurrency) {
      const chunk = pendingEvents.slice(i, i + concurrency);
      await Promise.allSettled(
        chunk.map(async (event) => {
          event.status = 'PROCESSING';
          event.lastAttemptAt = Date.now();
          const handler = this.handlers.get(event.eventType);

          if (!handler) {
            event.status = 'FAILED';
            event.errorMessage = `No handler registered for event type: ${event.eventType}`;
            result.failureCount++;
            result.deadLetterCount++;
            return;
          }

          try {
            await handler(event);
            event.status = 'COMPLETED';
            result.successCount++;
          } catch (err: unknown) {
            event.retryCount++;
            event.errorMessage = err instanceof Error ? err.message : 'Unknown processing error';

            if (event.retryCount >= event.maxRetries) {
              event.status = 'FAILED';
              result.deadLetterCount++;
            } else {
              event.status = 'PENDING'; // ستعاد محاولته في الدفعة القادمة
            }
            result.failureCount++;
          }
        })
      );
    }

    return result;
  }
}

