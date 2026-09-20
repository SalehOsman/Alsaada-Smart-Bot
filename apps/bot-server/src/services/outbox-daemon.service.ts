import { prisma, ExtendedPrismaClient } from '../db.js';
import {
  DistributedCircuitBreaker,
  googleSheetsCircuitBreaker,
} from './distributed-circuit-breaker.service.js';

export interface OutboxTickResult {
  claimed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
  deferred: number;
  circuitState: string;
}

export type OutboxEventHandler = (event: {
  id: string;
  eventType: string;
  aggregateId: string | null;
  targetSheet: string | null;
  payload: any;
  idempotencyKey: string;
}) => Promise<void>;

export class OutboxDaemon {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly circuitBreaker: DistributedCircuitBreaker;
  private readonly db: ExtendedPrismaClient;
  private readonly handlers = new Map<string, OutboxEventHandler>();

  // Lock ID for PostgreSQL pg_try_advisory_lock
  private readonly ADVISORY_LOCK_MAGIC = 868686;

  constructor(options?: {
    intervalMs?: number;
    circuitBreaker?: DistributedCircuitBreaker;
    db?: ExtendedPrismaClient;
  }) {
    this.intervalMs = options?.intervalMs ?? 5000;
    this.circuitBreaker = options?.circuitBreaker ?? googleSheetsCircuitBreaker;
    this.db = options?.db ?? prisma;
  }

  public registerHandler(eventType: string, handler: OutboxEventHandler): void {
    this.handlers.set(eventType, handler);
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(async () => {
      try {
        await this.processTick();
      } catch (err) {
        console.error('⚠️ [OutboxDaemon] Unhandled error during poll tick:', err);
      }
    }, this.intervalMs);
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Main processing tick.
   * Acquired via PostgreSQL advisory lock to ensure single active worker across nodes.
   */
  public async processTick(batchSize = 20): Promise<OutboxTickResult> {
    const result: OutboxTickResult = {
      claimed: 0,
      succeeded: 0,
      failed: 0,
      deadLettered: 0,
      deferred: 0,
      circuitState: 'CLOSED',
    };

    let lockAcquired = true;

    // 1. Try advisory lock if raw query is supported
    try {
      if (typeof (this.db as any).$queryRaw === 'function') {
        const lockRes = await (this.db as any).$queryRaw<Array<{ acquired: boolean }>>`
          SELECT pg_try_advisory_lock(${this.ADVISORY_LOCK_MAGIC}) AS acquired;
        `;
        if (lockRes && lockRes[0] && !lockRes[0].acquired) {
          return result; // Another daemon node is already executing this tick
        }
      }
    } catch {
      // In-memory or mocked DB in tests
      lockAcquired = true;
    }

    try {
      const state = await this.circuitBreaker.getState();
      result.circuitState = state;

      const now = new Date();

      // 2. Handle OPEN Circuit Breaker (Zero Event Loss)
      if (state === 'OPEN') {
        const cooldownSec = await this.circuitBreaker.getCooldownSeconds();
        const nextRetry = new Date(Date.now() + cooldownSec * 1000);

        try {
          // Defer pending ready events without incrementing retryCount
          const deferredEvents = await this.db.outboxEvent.updateMany({
            where: {
              status: 'PENDING',
              OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
            },
            data: {
              nextRetryAt: nextRetry,
            },
          });
          result.deferred = deferredEvents.count;
        } catch (e) {
          console.warn('⚠️ [OutboxDaemon] Could not defer events during OPEN circuit:', e);
        }

        return result;
      }

      // 3. Handle HALF_OPEN Circuit Breaker (Canary Probe)
      if (state === 'HALF_OPEN') {
        const canProbe = await this.circuitBreaker.allowCanaryProbe();
        if (!canProbe) {
          return result; // Probe already in flight
        }

        // Claim exactly 1 event for probe
        const probeEvent = await this.claimBatch(1);
        if (probeEvent.length === 0) {
          return result;
        }

        result.claimed = 1;
        const ev = probeEvent[0];

        try {
          await this.executeEvent(ev);
          await this.circuitBreaker.recordSuccess();
          result.succeeded = 1;
        } catch (err: any) {
          await this.circuitBreaker.recordFailure(err);
          await this.handleEventFailure(ev, err);
          result.failed = 1;
          return result;
        }

        // Probe succeeded! Circuit transitioned to CLOSED, can proceed with rest of batch
        batchSize = batchSize - 1;
        if (batchSize <= 0) return result;
      }

      // 4. Handle CLOSED (or recently closed after probe) Circuit Breaker
      const events = await this.claimBatch(batchSize);
      result.claimed += events.length;

      for (const ev of events) {
        try {
          await this.executeEvent(ev);
          await this.circuitBreaker.recordSuccess();
          result.succeeded++;
        } catch (err: any) {
          await this.circuitBreaker.recordFailure(err);
          const wasDeadLettered = await this.handleEventFailure(ev, err);
          if (wasDeadLettered) {
            result.deadLettered++;
          } else {
            result.failed++;
          }
        }
      }

      return result;
    } finally {
      // Release advisory lock
      if (lockAcquired) {
        try {
          if (typeof (this.db as any).$queryRaw === 'function') {
            await (this.db as any).$queryRaw`
              SELECT pg_advisory_unlock(${this.ADVISORY_LOCK_MAGIC});
            `;
          }
        } catch {}
      }
    }
  }

  private async claimBatch(limit: number): Promise<any[]> {
    const now = new Date();

    if (typeof (this.db as any).$queryRaw === 'function') {
      try {
        const claimed = await (this.db as any).$queryRaw<Array<{ id: string }>>`
          UPDATE outbox_events
          SET status = 'PROCESSING', last_attempt_at = NOW()
          WHERE id IN (
            SELECT id FROM outbox_events
            WHERE status = 'PENDING'
              AND (next_retry_at IS NULL OR next_retry_at <= NOW())
            ORDER BY created_at ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          )
          RETURNING id;
        `;

        if (claimed && Array.isArray(claimed) && claimed.length > 0) {
          const ids = (claimed as Array<{ id: string }>).map((c) => c.id);
          return await this.db.outboxEvent.findMany({
            where: { id: { in: ids } },
          });
        }
        return [];
      } catch {
        // Fall through to fallback
      }
    }

    // Fallback for mocked environments
    const events = await this.db.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    if (events.length > 0) {
      const ids = events.map((e: any) => e.id);
      await this.db.outboxEvent.updateMany({
        where: { id: { in: ids } },
        data: { status: 'PROCESSING', lastAttemptAt: now },
      });
    }

    return events;
  }

  private async executeEvent(event: any): Promise<void> {
    const handler = this.handlers.get(event.eventType);
    if (!handler) {
      throw new Error(`No handler registered for event type: ${event.eventType}`);
    }

    // event.id is the mandatory Idempotency Key
    await handler({
      id: event.id,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      targetSheet: event.targetSheet,
      payload: event.payload,
      idempotencyKey: event.id,
    });

    // Mark completed
    await this.db.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  private async handleEventFailure(event: any, err: any): Promise<boolean> {
    const currentRetryCount = (event.retryCount ?? 0) + 1;
    const maxRetries = event.maxRetries ?? 10;
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (currentRetryCount >= maxRetries) {
      // Toxic payload: Move to DeadLetterEvent
      try {
        await this.db.deadLetterEvent.create({
          data: {
            eventId: event.id,
            eventType: event.eventType,
            aggregateId: event.aggregateId,
            payload: event.payload,
            retryCount: currentRetryCount,
            lastError: errorMessage,
            createdAt: event.createdAt ?? new Date(),
            movedAt: new Date(),
          },
        });
      } catch (dlErr) {
        console.error(`⚠️ [OutboxDaemon] Failed to write dead letter event for ${event.id}:`, dlErr);
      }

      await this.db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'FAILED',
          errorMessage,
          retryCount: currentRetryCount,
          processedAt: new Date(),
        },
      });

      return true;
    } else {
      // Exponential backoff
      const delayMs = Math.min(1000 * Math.pow(2, currentRetryCount), 3600000);
      const nextRetryAt = new Date(Date.now() + delayMs);

      await this.db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PENDING',
          errorMessage,
          retryCount: currentRetryCount,
          nextRetryAt,
        },
      });

      return false;
    }
  }
}

export const outboxDaemon = new OutboxDaemon();
