import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UniversalWizardSessionEngine } from '../src/wizard-session/wizard-session.engine.js';

describe('UniversalWizardSessionEngine', () => {
  const telegramId = 987654321n;

  describe('In-Memory Mode (L1 Standalone)', () => {
    let engine: UniversalWizardSessionEngine<{ workerName?: string; nationalId?: string; stepNumber?: number }>;

    beforeEach(() => {
      engine = new UniversalWizardSessionEngine({
        ttlSeconds: 60,
        lockTtlMs: 200,
        maxHistoryDepth: 3, // Small depth for easy testing
      });
    });

    it('starts a new session with initial step and context-switch GC', async () => {
      const state = await engine.startSession(telegramId, 'worker-onboarding', 'step:national_id', {
        stepNumber: 1,
      });

      expect(state.flowKey).toBe('worker-onboarding');
      expect(state.step).toBe('step:national_id');
      expect(state.history).toEqual(['step:national_id']);
      expect(state.data).toEqual({ stepNumber: 1 });
      expect(state.createdAt).toBeGreaterThan(0);
      expect(state.updatedAt).toBe(state.createdAt);

      const fetched = await engine.getSession(telegramId);
      expect(fetched).toEqual(state);
    });

    it('transitions steps and merges patch data', async () => {
      await engine.startSession(telegramId, 'worker-onboarding', 'step:national_id', {
        stepNumber: 1,
      });

      const next = await engine.transitionStep(telegramId, 'step:phone', {
        nationalId: '29901011234567',
        stepNumber: 2,
      });

      expect(next.step).toBe('step:phone');
      expect(next.history).toEqual(['step:national_id', 'step:phone']);
      expect(next.data.stepNumber).toBe(2);
      expect(next.data.nationalId).toBe('29901011234567');
      expect(next.updatedAt).toBeGreaterThanOrEqual(next.createdAt);
    });

    it('enforces bounded history stack (maxHistoryDepth = 3)', async () => {
      await engine.startSession(telegramId, 'flow:deep', 's1');
      await engine.transitionStep(telegramId, 's2');
      await engine.transitionStep(telegramId, 's3');
      const s4 = await engine.transitionStep(telegramId, 's4');

      // History should only contain the last 3 steps: ['s2', 's3', 's4']
      expect(s4.history).toEqual(['s2', 's3', 's4']);
      expect(s4.history.length).toBe(3);
    });

    it('pops previous step from history backstack', async () => {
      await engine.startSession(telegramId, 'flow:nav', 'step1');
      await engine.transitionStep(telegramId, 'step2');
      await engine.transitionStep(telegramId, 'step3');

      const pop1 = await engine.popPreviousStep(telegramId);
      expect(pop1).not.toBeNull();
      expect(pop1?.previousStep).toBe('step2');
      expect(pop1?.state.step).toBe('step2');
      expect(pop1?.state.history).toEqual(['step1', 'step2']);

      const pop2 = await engine.popPreviousStep(telegramId);
      expect(pop2).not.toBeNull();
      expect(pop2?.previousStep).toBe('step1');
      expect(pop2?.state.step).toBe('step1');
      expect(pop2?.state.history).toEqual(['step1']);

      // Cannot pop beyond initial step
      const pop3 = await engine.popPreviousStep(telegramId);
      expect(pop3).toBeNull();
    });

    it('performs context-switch GC when starting a new session', async () => {
      // User is on old flow
      await engine.startSession(telegramId, 'flow:old', 'old_step', { workerName: 'Saleh' });
      const oldSession = await engine.getSession(telegramId);
      expect(oldSession?.flowKey).toBe('flow:old');

      // User switches to new flow -> old flow data and history wiped cleanly
      const newSession = await engine.startSession(telegramId, 'flow:new', 'new_step', { workerName: 'Ali' });
      expect(newSession.flowKey).toBe('flow:new');
      expect(newSession.step).toBe('new_step');
      expect(newSession.history).toEqual(['new_step']);
      expect(newSession.data.workerName).toBe('Ali');
    });

    it('clears session explicitly', async () => {
      await engine.startSession(telegramId, 'flow:test', 'step1');
      await engine.clearSession(telegramId);

      const session = await engine.getSession(telegramId);
      expect(session).toBeNull();
    });

    it('acquires and automatically releases Mutex lock on error', async () => {
      let runCount = 0;
      await expect(
        engine.withLock(telegramId, async () => {
          runCount++;
          throw new Error('Simulated processing failure');
        })
      ).rejects.toThrow('Simulated processing failure');

      expect(runCount).toBe(1);

      // Mutex must be cleanly released despite the thrown error!
      const secondRun = await engine.withLock(telegramId, async () => {
        return 'recovered';
      });
      expect(secondRun).toBe('recovered');
    });

    it('rejects concurrent executions under withLock', async () => {
      let resolveFirst: () => void = () => {};
      const firstPromise = new Promise<void>((r) => {
        resolveFirst = r;
      });

      const run1 = engine.withLock(telegramId, async () => {
        await firstPromise;
        return 'done1';
      });

      // Attempt concurrent call while run1 is in-flight
      await expect(
        engine.withLock(telegramId, async () => {
          return 'done2';
        })
      ).rejects.toThrow(/Concurrent lock conflict/);

      resolveFirst();
      await expect(run1).resolves.toBe('done1');
    });
  });

  describe('Distributed Redis (L2) with L1 Fallback', () => {
    let mockRedisStore: Map<string, string>;
    let mockRedis: any;
    let engine: UniversalWizardSessionEngine;

    beforeEach(() => {
      mockRedisStore = new Map();
      mockRedis = {
        status: 'ready',
        get: vi.fn(async (key: string) => mockRedisStore.get(key) ?? null),
        set: vi.fn(async (key: string, val: string) => {
          mockRedisStore.set(key, val);
          return 'OK';
        }),
        del: vi.fn(async (...keys: string[]) => {
          for (const k of keys) mockRedisStore.delete(k);
          return keys.length;
        }),
      };

      engine = new UniversalWizardSessionEngine(mockRedis, {
        ttlSeconds: 300,
        lockTtlMs: 500,
        maxHistoryDepth: 5,
      });
    });

    it('saves and reads session from Redis L2 store', async () => {
      await engine.startSession(telegramId, 'flow:redis', 's1', { foo: 'bar' });

      expect(mockRedis.set).toHaveBeenCalled();
      const sessionKey = `session:wizard:${telegramId}`;
      expect(mockRedisStore.has(sessionKey)).toBe(true);

      const retrieved = await engine.getSession(telegramId);
      expect(retrieved?.flowKey).toBe('flow:redis');
      expect(retrieved?.data).toEqual({ foo: 'bar' });
    });

    it('falls back seamlessly to L1 cache if Redis throws', async () => {
      await engine.startSession(telegramId, 'flow:fallback', 's1', { preserved: true });

      // Simulate Redis crash
      mockRedis.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const retrieved = await engine.getSession(telegramId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.flowKey).toBe('flow:fallback');
      expect(retrieved?.data).toEqual({ preserved: true });
    });

    it('deletes from both Redis L2 and L1 memory on clearSession', async () => {
      await engine.startSession(telegramId, 'flow:clear', 's1');
      await engine.clearSession(telegramId);

      expect(mockRedis.del).toHaveBeenCalled();
      const fetched = await engine.getSession(telegramId);
      expect(fetched).toBeNull();
    });

    it('acquires and releases Redis distributed Mutex lock under withLock', async () => {
      const lockKey = `lock:wizard:${telegramId}`;
      mockRedis.set.mockImplementation(async (k: string, v: string, ...args: any[]) => {
        if (args.includes('NX') && mockRedisStore.has(k)) {
          return null;
        }
        mockRedisStore.set(k, v);
        return 'OK';
      });

      const res = await engine.withLock(telegramId, async () => {
        expect(mockRedisStore.has(lockKey)).toBe(true);
        return 'redis-locked';
      });

      expect(res).toBe('redis-locked');
      expect(mockRedisStore.has(lockKey)).toBe(false);
    });

    it('rejects concurrent requests when Redis distributed lock is already held', async () => {
      const lockKey = `lock:wizard:${telegramId}`;
      mockRedis.set.mockImplementation(async (k: string, v: string, ...args: any[]) => {
        if (args.includes('NX') && mockRedisStore.has(k)) {
          return null;
        }
        mockRedisStore.set(k, v);
        return 'OK';
      });

      let resolveFirst: () => void = () => {};
      const firstGate = new Promise<void>((r) => {
        resolveFirst = r;
      });

      const call1 = engine.withLock(telegramId, async () => {
        await firstGate;
        return 'res1';
      });

      // Wait brief microtask for call1 to acquire Redis lock
      await new Promise((r) => setTimeout(r, 10));

      await expect(
        engine.withLock(telegramId, async () => 'res2')
      ).rejects.toThrow(/Concurrent lock conflict/);

      resolveFirst();
      await expect(call1).resolves.toBe('res1');
    });

    it('falls back seamlessly to in-memory lock if Redis lock set throws', async () => {
      mockRedis.set.mockImplementation(async (k: string, _v: string, ...args: any[]) => {
        if (k.startsWith('lock:')) {
          throw new Error('REDIS_TIMEOUT');
        }
        return 'OK';
      });

      const result = await engine.withLock(telegramId, async () => {
        return 'fallback-success';
      });

      expect(result).toBe('fallback-success');
    });

    it('releases Redis lock automatically when inner callback throws an error', async () => {
      const lockKey = `lock:wizard:${telegramId}`;
      mockRedis.set.mockImplementation(async (k: string, v: string) => {
        mockRedisStore.set(k, v);
        return 'OK';
      });

      await expect(
        engine.withLock(telegramId, async () => {
          throw new Error('Operation failed inside lock');
        })
      ).rejects.toThrow('Operation failed inside lock');

      // Mutex in Redis should be deleted
      expect(mockRedisStore.has(lockKey)).toBe(false);
    });
  });
});
