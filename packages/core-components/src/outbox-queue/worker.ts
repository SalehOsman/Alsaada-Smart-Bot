import { PrismaClient, Prisma } from '@alsaada/database';
import type { OutboxEvent, OutboxEnqueueInput, OutboxProcessResult } from './types.js';

export type OutboxHandler<T = Record<string, unknown>> = (event: OutboxEvent<T>) => Promise<void>;

export class TransactionalOutboxQueue {
  private readonly queue: OutboxEvent[] = [];
  private readonly handlers = new Map<string, OutboxHandler<any>>();
  private readonly db?: PrismaClient | undefined;

  constructor(db?: PrismaClient | undefined) {
    this.db = db;
  }

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
   * 📥 إدراج حدث جديد في طابور الـ Outbox في قاعدة البيانات ضمن معاملة
   */
  async enqueueTx<T = Record<string, unknown>>(tx: any, input: OutboxEnqueueInput<T>): Promise<void> {
    if (!this.db) {
      this.enqueue(input);
      return;
    }
    
    await tx.outboxEvent.create({
      data: {
        eventType: input.eventType,
        targetSheet: input.targetSheet,
        payload: input.payload as Prisma.InputJsonValue,
        maxRetries: input.maxRetries ?? 5,
        status: 'PENDING',
        nextRetryAt: new Date(),
      },
    });
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
  async getPendingCount(): Promise<number> {
    if (this.db) {
      return this.db.outboxEvent.count({
        where: { status: 'PENDING' },
      });
    }
    return this.queue.filter((e) => e.status === 'PENDING').length;
  }

  /**
   * 🔄 معالجة دفعة من أحداث الطابور بالتوازي المنضبط مع سياسة إعادة المحاولة الأسية
   */
  async processBatch(batchSize = 20, concurrency = 5): Promise<OutboxProcessResult> {
    let pendingEvents: OutboxEvent<any>[] = [];
    
    if (this.db) {
      const claimResult = await this.db.$queryRaw<{id: string}[]>`
        UPDATE outbox_events
        SET status = 'PROCESSING', last_attempt_at = NOW()
        WHERE id IN (
          SELECT id FROM outbox_events
          WHERE status = 'PENDING'
             OR (status = 'PROCESSING' AND last_attempt_at < NOW() - INTERVAL '5 minutes')
          ORDER BY created_at ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id;
      `;
      
      const claimedIds = claimResult.map(r => r.id);
      
      if (claimedIds.length > 0) {
         const dbEvents = await this.db.outboxEvent.findMany({
           where: { id: { in: claimedIds } }
         });
         
         pendingEvents = dbEvents.map(e => ({
           id: e.id,
           eventType: e.eventType,
           targetSheet: e.targetSheet,
           payload: e.payload as any,
           retryCount: e.retryCount,
           maxRetries: e.maxRetries,
           status: e.status as 'PROCESSING',
           createdAt: e.createdAt.getTime(),
           lastAttemptAt: e.lastAttemptAt?.getTime()
         }));
      }
    } else {
      pendingEvents = this.queue
        .filter((e) => e.status === 'PENDING')
        .slice(0, batchSize);
    }

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
          if (!this.db) {
            event.status = 'PROCESSING';
            event.lastAttemptAt = Date.now();
          }
          const handler = this.handlers.get(event.eventType);

          if (!handler) {
            await this.updateEventStatus(event.id, 'FAILED', `No handler registered for event type: ${event.eventType}`, event.retryCount);
            result.failureCount++;
            result.deadLetterCount++;
            this.sendTelemetryAlert(event.eventType, 'FAILED', 'No handler registered');
            return;
          }

          try {
            await handler(event);
            await this.updateEventStatus(event.id, 'COMPLETED', undefined, event.retryCount);
            result.successCount++;
          } catch (err: unknown) {
            const currentRetryCount = event.retryCount + 1;
            const errorMessage = err instanceof Error ? err.message : 'Unknown processing error';

            if (currentRetryCount >= event.maxRetries) {
              await this.updateEventStatus(event.id, 'FAILED', errorMessage, currentRetryCount);
              result.deadLetterCount++;
              this.sendTelemetryAlert(event.eventType, 'FAILED', errorMessage);
            } else {
              await this.updateEventStatus(event.id, 'PENDING', errorMessage, currentRetryCount);
            }
            result.failureCount++;
          }
        })
      );
    }

    return result;
  }
  
  private async updateEventStatus(id: string, status: 'PENDING'|'COMPLETED'|'FAILED', errorMessage: string | undefined, retryCount: number) {
    if (this.db) {
       await this.db.outboxEvent.update({
         where: { id },
         data: {
           status,
           errorMessage: errorMessage ?? null,
           retryCount,
           ...(status === 'COMPLETED' ? { processedAt: new Date() } : {})
         }
       });
    } else {
       const event = this.queue.find(e => e.id === id);
       if (event) {
         event.status = status;
         event.errorMessage = errorMessage;
         event.retryCount = retryCount;
       }
    }
  }
  
  private sendTelemetryAlert(eventType: string, status: string, errorMsg: string) {
    console.error(`[TELEMETRY ALERT] Outbox event ${eventType} failed: ${errorMsg}`);
  }
}

