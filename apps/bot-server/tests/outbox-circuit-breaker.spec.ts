import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DistributedCircuitBreaker,
} from '../src/services/distributed-circuit-breaker.service.js';
import { OutboxDaemon } from '../src/services/outbox-daemon.service.js';

describe('Resilient OutboxDaemon & 3-State Distributed Circuit Breaker', () => {
  let circuitBreaker: DistributedCircuitBreaker;

  beforeEach(async () => {
    circuitBreaker = new DistributedCircuitBreaker({
      serviceName: 'test_sheets_' + Math.random().toString(36).substring(2, 6),
      failureThreshold: 3,
      initialCooldownSeconds: 10,
      maxCooldownSeconds: 60,
    });
    await circuitBreaker.reset();
  });

  describe('Distributed 3-State Circuit Breaker State Transitions', () => {
    it('should start in CLOSED state and allow execution', async () => {
      const state = await circuitBreaker.getState();
      expect(state).toBe('CLOSED');
      expect(await circuitBreaker.canExecute()).toBe(true);
    });

    it('should transition to OPEN after reaching failure threshold', async () => {
      await circuitBreaker.recordFailure();
      expect(await circuitBreaker.getState()).toBe('CLOSED');

      await circuitBreaker.recordFailure();
      expect(await circuitBreaker.getState()).toBe('CLOSED');

      // 3rd failure hits threshold
      await circuitBreaker.recordFailure();
      expect(await circuitBreaker.getState()).toBe('OPEN');
      expect(await circuitBreaker.canExecute()).toBe(false);
    });

    it('should transition from OPEN to HALF_OPEN after cooldown expires', async () => {
      // Force open with 1-second cooldown
      await circuitBreaker.forceOpen(1);
      expect(await circuitBreaker.getState()).toBe('OPEN');

      // Wait for cooldown
      await new Promise((r) => setTimeout(r, 1100));

      const state = await circuitBreaker.getState();
      expect(state).toBe('HALF_OPEN');
      expect(await circuitBreaker.canExecute()).toBe(true);
    });

    it('should transition from HALF_OPEN to CLOSED on successful Canary Probe', async () => {
      await circuitBreaker.forceOpen(1);
      await new Promise((r) => setTimeout(r, 1100));
      expect(await circuitBreaker.getState()).toBe('HALF_OPEN');

      // Canary probe slot
      expect(await circuitBreaker.allowCanaryProbe()).toBe(true);
      // Success returns breaker to CLOSED
      await circuitBreaker.recordSuccess();

      expect(await circuitBreaker.getState()).toBe('CLOSED');
      expect(await circuitBreaker.canExecute()).toBe(true);
      expect(await circuitBreaker.getCooldownSeconds()).toBe(10);
    });

    it('should transition from HALF_OPEN to OPEN with doubled cooldown on Canary Probe failure', async () => {
      await circuitBreaker.forceOpen(10);
      await circuitBreaker.forceHalfOpen();

      expect(await circuitBreaker.getState()).toBe('HALF_OPEN');

      // Canary failure
      await circuitBreaker.recordFailure(new Error('Google Sheets 503'));

      expect(await circuitBreaker.getState()).toBe('OPEN');
      expect(await circuitBreaker.canExecute()).toBe(false);
      expect(await circuitBreaker.getCooldownSeconds()).toBe(20); // Doubled from 10 to 20
    });
  });

  describe('OutboxDaemon Integration & Zero-Event-Loss Semantics', () => {
    let mockEvents: any[];
    let deadLetters: any[];
    let mockDb: any;
    let daemon: OutboxDaemon;

    beforeEach(() => {
      mockEvents = [
        {
          id: 'ev-1',
          eventType: 'SYNC_OFFBOARDING',
          aggregateId: 'worker-101',
          targetSheet: 'WorkerOffboarding',
          payload: { workerId: 'worker-101', name: 'أحمد' },
          retryCount: 0,
          maxRetries: 10,
          status: 'PENDING',
          nextRetryAt: null,
          createdAt: new Date(),
        },
      ];
      deadLetters = [];

      mockDb = {
        outboxEvent: {
          findMany: vi.fn().mockImplementation(() => Promise.resolve(mockEvents.filter((e) => e.status === 'PENDING'))),
          update: vi.fn().mockImplementation(({ where, data }: any) => {
            const ev = mockEvents.find((e) => e.id === where.id);
            if (ev) Object.assign(ev, data);
            return Promise.resolve(ev);
          }),
          updateMany: vi.fn().mockImplementation(({ data }: any) => {
            let count = 0;
            for (const ev of mockEvents) {
              if (ev.status === 'PENDING') {
                Object.assign(ev, data);
                count++;
              }
            }
            return Promise.resolve({ count });
          }),
        },
        deadLetterEvent: {
          create: vi.fn().mockImplementation(({ data }: any) => {
            deadLetters.push(data);
            return Promise.resolve(data);
          }),
        },
      };

      daemon = new OutboxDaemon({
        circuitBreaker,
        db: mockDb as any,
      });
    });

    it('should process pending event successfully and pass event.id as idempotencyKey', async () => {
      let receivedIdempotencyKey = '';
      daemon.registerHandler('SYNC_OFFBOARDING', async (ev) => {
        receivedIdempotencyKey = ev.idempotencyKey;
      });

      const tickResult = await daemon.processTick();

      expect(tickResult.succeeded).toBe(1);
      expect(receivedIdempotencyKey).toBe('ev-1');
      expect(mockEvents[0].status).toBe('COMPLETED');
    });

    it('should defer events without dropping them or increasing retryCount when circuit is OPEN', async () => {
      await circuitBreaker.forceOpen(60);

      const tickResult = await daemon.processTick();

      expect(tickResult.deferred).toBe(1);
      expect(tickResult.succeeded).toBe(0);
      expect(tickResult.circuitState).toBe('OPEN');
      expect(mockEvents[0].status).toBe('PENDING'); // Still PENDING!
      expect(mockEvents[0].retryCount).toBe(0); // Retry count NOT increased!
      expect(mockEvents[0].nextRetryAt).not.toBeNull();
    });

    it('should apply exponential backoff on transient processing failure', async () => {
      daemon.registerHandler('SYNC_OFFBOARDING', async () => {
        throw new Error('Network timeout');
      });

      const tickResult = await daemon.processTick();

      expect(tickResult.failed).toBe(1);
      expect(mockEvents[0].status).toBe('PENDING');
      expect(mockEvents[0].retryCount).toBe(1);
      expect(mockEvents[0].nextRetryAt).not.toBeNull();
      expect(mockEvents[0].errorMessage).toBe('Network timeout');
    });

    it('should move poisoned event to DeadLetterEvent after exceeding max retries (10)', async () => {
      mockEvents[0].retryCount = 9; // Next failure makes it 10
      mockEvents[0].maxRetries = 10;

      daemon.registerHandler('SYNC_OFFBOARDING', async () => {
        throw new Error('Unrecoverable schema error');
      });

      const tickResult = await daemon.processTick();

      expect(tickResult.deadLettered).toBe(1);
      expect(mockEvents[0].status).toBe('FAILED');
      expect(mockEvents[0].retryCount).toBe(10);
      expect(deadLetters.length).toBe(1);
      expect(deadLetters[0].eventId).toBe('ev-1');
      expect(deadLetters[0].lastError).toBe('Unrecoverable schema error');
    });
  });
});
