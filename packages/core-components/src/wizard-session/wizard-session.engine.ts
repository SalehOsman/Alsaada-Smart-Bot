import crypto from 'node:crypto';

export interface WizardSessionState<TData = Record<string, unknown>> {
  flowKey: string;
  step: string;
  history: string[]; // Bounded LIFO stack (MAX: 10)
  data: TData;
  createdAt: number;
  updatedAt: number;
}

export interface WizardEngineOptions {
  ttlSeconds?: number;       // Default: 900 seconds (15 minutes)
  lockTtlMs?: number;        // Default: 1500 ms
  maxHistoryDepth?: number;  // Default: 10 steps
  redis?: any;               // Redis client instance with status checking
}

interface L1CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_OPTIONS: Required<Omit<WizardEngineOptions, 'redis'>> = {
  ttlSeconds: 900,
  lockTtlMs: 1500,
  maxHistoryDepth: 10,
};

/**
 * 🧙 Universal Wizard Session Engine
 * Enterprise multi-tier session state coordinator:
 * - L2 Redis distributed state with graceful circuit-breaker fallback to L1 RAM LRU cache
 * - Atomic self-releasing Mutex lock `withLock()`
 * - Bounded navigation history stack (`maxHistoryDepth = 10`)
 * - Context-switch Garbage Collection (`startSession` clears old flow sessions)
 */
export class UniversalWizardSessionEngine<TData = Record<string, unknown>> {
  private redis: any;
  private readonly ttlSeconds: number;
  private readonly lockTtlMs: number;
  private readonly maxHistoryDepth: number;

  // L1 In-Memory LRU Store
  private readonly l1Store = new Map<string, L1CacheEntry<WizardSessionState<TData>>>();
  private readonly maxL1Entries = 1000;

  // In-Memory Lock Registry (for L1 Fallback)
  private readonly inMemoryLocks = new Map<string, { token: string; expiresAt: number }>();

  constructor(redisOrOptions?: any, maybeOptions?: WizardEngineOptions) {
    if (
      redisOrOptions &&
      typeof redisOrOptions === 'object' &&
      !('get' in redisOrOptions) &&
      !('status' in redisOrOptions)
    ) {
      const opts = redisOrOptions as WizardEngineOptions;
      this.redis = opts.redis;
      this.ttlSeconds = opts.ttlSeconds ?? DEFAULT_OPTIONS.ttlSeconds;
      this.lockTtlMs = opts.lockTtlMs ?? DEFAULT_OPTIONS.lockTtlMs;
      this.maxHistoryDepth = opts.maxHistoryDepth ?? DEFAULT_OPTIONS.maxHistoryDepth;
    } else {
      this.redis = redisOrOptions;
      const opts = maybeOptions ?? {};
      this.ttlSeconds = opts.ttlSeconds ?? DEFAULT_OPTIONS.ttlSeconds;
      this.lockTtlMs = opts.lockTtlMs ?? DEFAULT_OPTIONS.lockTtlMs;
      this.maxHistoryDepth = opts.maxHistoryDepth ?? DEFAULT_OPTIONS.maxHistoryDepth;
    }
  }

  private isRedisReady(): boolean {
    return Boolean(this.redis && (!this.redis.status || this.redis.status === 'ready'));
  }

  private getSessionKey(telegramId: bigint): string {
    return `session:wizard:${telegramId.toString()}`;
  }

  private getLockKey(telegramId: bigint): string {
    return `lock:wizard:${telegramId.toString()}`;
  }

  private getActiveFlowKey(telegramId: bigint): string {
    return `active:wizard:${telegramId.toString()}`;
  }

  private setL1(key: string, value: WizardSessionState<TData>): void {
    if (this.l1Store.size >= this.maxL1Entries) {
      const oldestKey = this.l1Store.keys().next().value;
      if (oldestKey) this.l1Store.delete(oldestKey);
    }
    this.l1Store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
  }

  private getL1(key: string): WizardSessionState<TData> | null {
    const entry = this.l1Store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.l1Store.delete(key);
      return null;
    }
    // Refresh LRU order
    this.l1Store.delete(key);
    this.l1Store.set(key, entry);
    return entry.value;
  }

  private async saveSession(telegramId: bigint, state: WizardSessionState<TData>): Promise<void> {
    const sessionKey = this.getSessionKey(telegramId);
    const activeFlowKey = this.getActiveFlowKey(telegramId);

    // 1. Update L1
    this.setL1(sessionKey, state);

    // 2. Update L2 Redis if available
    if (this.isRedisReady()) {
      try {
        const serialized = JSON.stringify(state, (_key, val) =>
          typeof val === 'bigint' ? val.toString() : val
        );
        await this.redis.set(sessionKey, serialized, 'EX', this.ttlSeconds);
        await this.redis.set(activeFlowKey, state.flowKey, 'EX', this.ttlSeconds);
      } catch (err) {
        console.warn(`⚠️ [UniversalWizardSessionEngine] Redis write failed for ${sessionKey}:`, err);
      }
    }
  }

  /**
   * 1. Get current session state (L2 Redis with L1 fallback)
   */
  public async getSession(telegramId: bigint): Promise<WizardSessionState<TData> | null> {
    const sessionKey = this.getSessionKey(telegramId);

    // 1. Check L2 Redis
    if (this.isRedisReady()) {
      try {
        const raw = await this.redis.get(sessionKey);
        if (raw) {
          const parsed = JSON.parse(raw) as WizardSessionState<TData>;
          this.setL1(sessionKey, parsed);
          return parsed;
        }
      } catch (err) {
        console.warn(`⚠️ [UniversalWizardSessionEngine] Redis read failed for ${sessionKey}:`, err);
      }
    }

    // 2. Fallback to L1 RAM Cache
    return this.getL1(sessionKey);
  }

  /**
   * 2. Start a new wizard session.
   * Performs Context-Switch GC to wipe any prior dangling flow for this user.
   */
  public async startSession(
    telegramId: bigint,
    flowKey: string,
    initialStep: string,
    initialData?: TData
  ): Promise<WizardSessionState<TData>> {
    // Context-Switch Garbage Collection: clear prior flow session
    await this.clearSession(telegramId);

    const now = Date.now();
    const state: WizardSessionState<TData> = {
      flowKey,
      step: initialStep,
      history: [initialStep],
      data: (initialData ? { ...initialData } : {}) as TData,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveSession(telegramId, state);
    return state;
  }

  /**
   * 3. Transition to next step with bounded navigation backstack and optional patch data.
   */
  public async transitionStep(
    telegramId: bigint,
    nextStep: string,
    patchData?: Partial<TData>
  ): Promise<WizardSessionState<TData>> {
    const current = await this.getSession(telegramId);
    if (!current) {
      throw new Error(`[UniversalWizardSessionEngine] No active session found for telegramId: ${telegramId}`);
    }

    // Maintain bounded history stack
    const updatedHistory = [...current.history, nextStep];
    if (updatedHistory.length > this.maxHistoryDepth) {
      updatedHistory.splice(0, updatedHistory.length - this.maxHistoryDepth);
    }

    const updatedState: WizardSessionState<TData> = {
      ...current,
      step: nextStep,
      history: updatedHistory,
      data: {
        ...current.data,
        ...(patchData || {}),
      },
      updatedAt: Date.now(),
    };

    await this.saveSession(telegramId, updatedState);
    return updatedState;
  }

  /**
   * 4. Pop the last step from history and navigate backward.
   */
  public async popPreviousStep(
    telegramId: bigint
  ): Promise<{ previousStep: string; state: WizardSessionState<TData> } | null> {
    const current = await this.getSession(telegramId);
    if (!current || current.history.length <= 1) {
      return null;
    }

    // Remove current step immutably
    const newHistory = current.history.slice(0, -1);
    const previousStep = newHistory[newHistory.length - 1]!;
    const updatedState: WizardSessionState<TData> = {
      ...current,
      step: previousStep,
      history: newHistory,
      updatedAt: Date.now(),
    };

    await this.saveSession(telegramId, updatedState);
    return { previousStep, state: updatedState };
  }

  /**
   * 5. Clear all wizard session keys for this user across L1 & L2.
   */
  public async clearSession(telegramId: bigint): Promise<void> {
    const sessionKey = this.getSessionKey(telegramId);
    const activeFlowKey = this.getActiveFlowKey(telegramId);
    const lockKey = this.getLockKey(telegramId);

    // 1. Clear L1 & Memory Locks
    this.l1Store.delete(sessionKey);
    this.inMemoryLocks.delete(lockKey);

    // 2. Clear Redis
    if (this.isRedisReady()) {
      try {
        await this.redis.del(sessionKey, activeFlowKey, lockKey);
      } catch (err) {
        console.warn(`⚠️ [UniversalWizardSessionEngine] Redis del failed for ${sessionKey}:`, err);
      }
    }
  }

  /**
   * 6. Self-releasing atomic Mutex guard with lock TTL and mandatory finally release.
   */
  public async withLock<R>(telegramId: bigint, fn: () => Promise<R>): Promise<R> {
    const lockKey = this.getLockKey(telegramId);
    const token = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
    let redisLockAcquired = false;
    let redisFailed = false;
    let inMemoryLockAcquired = false;

    if (this.isRedisReady()) {
      try {
        const res = await this.redis.set(lockKey, token, 'PX', this.lockTtlMs, 'NX');
        redisLockAcquired = res === 'OK';
      } catch (err) {
        redisFailed = true;
        console.warn(`⚠️ [UniversalWizardSessionEngine] Redis lock failed, falling back to L1 memory lock:`, err);
      }
    }

    // Fallback to in-memory lock if redis is unavailable or threw an error
    if (!this.isRedisReady() || redisFailed) {
      const now = Date.now();
      const existing = this.inMemoryLocks.get(lockKey);
      if (!existing || existing.expiresAt <= now) {
        this.inMemoryLocks.set(lockKey, { token, expiresAt: now + this.lockTtlMs });
        inMemoryLockAcquired = true;
      }
    }

    if (!redisLockAcquired && !inMemoryLockAcquired) {
      throw new Error(`[UniversalWizardSessionEngine] Concurrent lock conflict for telegramId: ${telegramId}`);
    }

    try {
      return await fn();
    } finally {
      // Release Redis lock if acquired via Redis
      if (redisLockAcquired && this.isRedisReady()) {
        try {
          const currentVal = await this.redis.get(lockKey);
          if (currentVal === token) {
            await this.redis.del(lockKey);
          }
        } catch {
          // Ignore unlock error
        }
      }

      // Release in-memory lock if acquired in memory
      if (inMemoryLockAcquired) {
        const currentMem = this.inMemoryLocks.get(lockKey);
        if (currentMem && currentMem.token === token) {
          this.inMemoryLocks.delete(lockKey);
        }
      }
    }
  }
}
