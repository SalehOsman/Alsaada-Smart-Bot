import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DistributedCircuitBreaker,
} from '../src/services/distributed-circuit-breaker.service.js';
import { OutboxDaemon } from '../src/services/outbox-daemon.service.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');
let testServiceSeq = 0;

describe('Resilient OutboxDaemon & 3-State Distributed Circuit Breaker', () => {
  let circuitBreaker: DistributedCircuitBreaker;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    circuitBreaker = new DistributedCircuitBreaker({
      serviceName: `test_sheets_${++testServiceSeq}`,
      failureThreshold: 3,
      initialCooldownSeconds: 10,
      maxCooldownSeconds: 60,
    });
    await circuitBreaker.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Distributed 3-State Circuit Breaker State Transitions', () => {
    it('starts in CLOSED state and allows execution', async () => {
      // Arrange & Act
      const state = await circuitBreaker.getState();
      const canExec = await circuitBreaker.canExecute();

      // Assert
      expect(state).toBe('CLOSED');
      expect(canExec).toBe(true);
      expect(state).not.toBe('OPEN');
    });

    it('transitions to OPEN after reaching failure threshold', async () => {
      // Arrange & Act 1
      await circuitBreaker.recordFailure();
      expect(await circuitBreaker.getState()).toBe('CLOSED');

      // Act 2
      await circuitBreaker.recordFailure();
      expect(await circuitBreaker.getState()).toBe('CLOSED');

      // Act 3: 3rd failure hits threshold
      await circuitBreaker.recordFailure();

      // Assert
      expect(await circuitBreaker.getState()).toBe('OPEN');
      expect(await circuitBreaker.canExecute()).toBe(false);
    });

    it('transitions from OPEN to HALF_OPEN after cooldown expires', async () => {
      // Arrange
      await circuitBreaker.forceOpen(1);
      expect(await circuitBreaker.getState()).toBe('OPEN');

      // Act: Advance time past 1s cooldown
      await vi.advanceTimersByTimeAsync(1100);

      // Assert
      const state = await circuitBreaker.getState();
      expect(state).toBe('HALF_OPEN');
      expect(await circuitBreaker.canExecute()).toBe(true);
    });

    it('transitions from HALF_OPEN to CLOSED on successful Canary Probe', async () => {
      // Arrange
      await circuitBreaker.forceOpen(1);
      await vi.advanceTimersByTimeAsync(1100);
      expect(await circuitBreaker.getState()).toBe('HALF_OPEN');

      // Act
      const allowed = await circuitBreaker.allowCanaryProbe();
      await circuitBreaker.recordSuccess();

      // Assert
      expect(allowed).toBe(true);
      expect(await circuitBreaker.getState()).toBe('CLOSED');
      expect(await circuitBreaker.canExecute()).toBe(true);
      expect(await circuitBreaker.getCooldownSeconds()).toBe(10);
    });

    it('transitions from HALF_OPEN to OPEN with doubled cooldown on Canary Probe failure', async () => {
      // Arrange
      await circuitBreaker.forceOpen(10);
      await circuitBreaker.forceHalfOpen();
      expect(await circuitBreaker.getState()).toBe('HALF_OPEN');

      // Act: Canary failure
      await circuitBreaker.recordFailure(new Error('Google Sheets 503'));

      // Assert
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
          createdAt: new Date('2026-09-21T12:00:00.000Z'),
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

    it('processes pending event successfully and passes event.id as idempotencyKey', async () => {
      // Arrange
      let receivedIdempotencyKey = '';
      daemon.registerHandler('SYNC_OFFBOARDING', async (ev) => {
        receivedIdempotencyKey = ev.idempotencyKey;
      });

      // Act
      const tickResult = await daemon.processTick();

      // Assert
      expect(tickResult.succeeded).toBe(1);
      expect(receivedIdempotencyKey).toBe('ev-1');
      expect(mockEvents[0].status).toBe('COMPLETED');
      expect(mockEvents[0].retryCount).toBe(0);
    });

    it('defers events without dropping them or increasing retryCount when circuit is OPEN', async () => {
      // Arrange
      await circuitBreaker.forceOpen(60);

      // Act
      const tickResult = await daemon.processTick();

      // Assert
      expect(tickResult.deferred).toBe(1);
      expect(tickResult.succeeded).toBe(0);
      expect(tickResult.circuitState).toBe('OPEN');
      expect(mockEvents[0].status).toBe('PENDING');
      expect(mockEvents[0].retryCount).toBe(0);
      expect(mockEvents[0].nextRetryAt).not.toBeNull();
    });

    it('applies exponential backoff on transient processing failure', async () => {
      // Arrange
      daemon.registerHandler('SYNC_OFFBOARDING', async () => {
        throw new Error('Network timeout');
      });

      // Act
      const tickResult = await daemon.processTick();

      // Assert
      expect(tickResult.failed).toBe(1);
      expect(mockEvents[0].status).toBe('PENDING');
      expect(mockEvents[0].retryCount).toBe(1);
      expect(mockEvents[0].nextRetryAt).not.toBeNull();
      expect(mockEvents[0].errorMessage).toBe('Network timeout');
    });

    it('moves poisoned event to DeadLetterEvent after exceeding max retries', async () => {
      // Arrange
      mockEvents[0].retryCount = 9; // Next failure makes it 10
      mockEvents[0].maxRetries = 10;

      daemon.registerHandler('SYNC_OFFBOARDING', async () => {
        throw new Error('Unrecoverable schema error');
      });

      // Act
      const tickResult = await daemon.processTick();

      // Assert
      expect(tickResult.deadLettered).toBe(1);
      expect(mockEvents[0].status).toBe('FAILED');
      expect(mockEvents[0].retryCount).toBe(10);
      expect(deadLetters.length).toBe(1);
      expect(deadLetters[0].eventId).toBe('ev-1');
      expect(deadLetters[0].lastError).toBe('Unrecoverable schema error');
    });
  });
});
