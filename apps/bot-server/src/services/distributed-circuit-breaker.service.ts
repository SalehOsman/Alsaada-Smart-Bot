import { redis, safeRedisGet, safeRedisSet, safeRedisDel } from '../redis.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  serviceName: string;
  failureThreshold?: number; // default: 5
  initialCooldownSeconds?: number; // default: 60s
  maxCooldownSeconds?: number; // default: 900s (15 min)
}

interface InMemoryBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  openedAt: number;
  cooldownSeconds: number;
  canaryInFlight: boolean;
}

export class DistributedCircuitBreaker {
  public readonly serviceName: string;
  public readonly failureThreshold: number;
  public readonly initialCooldownSeconds: number;
  public readonly maxCooldownSeconds: number;

  private readonly stateKey: string;
  private readonly failuresKey: string;
  private readonly lastFailureKey: string;
  private readonly openedAtKey: string;
  private readonly cooldownKey: string;
  private readonly canaryKey: string;

  private memState: InMemoryBreakerState;

  constructor(options: CircuitBreakerOptions) {
    this.serviceName = options.serviceName;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.initialCooldownSeconds = options.initialCooldownSeconds ?? 60;
    this.maxCooldownSeconds = options.maxCooldownSeconds ?? 900;

    const prefix = `cb:${this.serviceName}`;
    this.stateKey = `${prefix}:state`;
    this.failuresKey = `${prefix}:failures`;
    this.lastFailureKey = `${prefix}:last_failure`;
    this.openedAtKey = `${prefix}:opened_at`;
    this.cooldownKey = `${prefix}:cooldown`;
    this.canaryKey = `${prefix}:canary_in_flight`;

    this.memState = {
      state: 'CLOSED',
      failures: 0,
      lastFailureAt: 0,
      openedAt: 0,
      cooldownSeconds: this.initialCooldownSeconds,
      canaryInFlight: false,
    };
  }

  private isRedisActive(): boolean {
    return typeof redis !== 'undefined' && redis !== null && redis.status === 'ready';
  }

  public async getState(): Promise<CircuitState> {
    if (!this.isRedisActive()) {
      return this.evaluateInMemoryState();
    }

    try {
      let state = (await safeRedisGet(this.stateKey)) as CircuitState | null;
      if (!state) {
        state = 'CLOSED';
        await safeRedisSet(this.stateKey, 'CLOSED', 86400);
      }

      if (state === 'OPEN') {
        const openedAtRaw = await safeRedisGet(this.openedAtKey);
        const cooldownRaw = await safeRedisGet(this.cooldownKey);
        const openedAt = openedAtRaw ? parseInt(openedAtRaw, 10) : 0;
        const cooldownSec = cooldownRaw ? parseInt(cooldownRaw, 10) : this.initialCooldownSeconds;

        const now = Date.now();
        if (now - openedAt >= cooldownSec * 1000) {
          // Automatic transition from OPEN to HALF_OPEN after cooldown
          await safeRedisSet(this.stateKey, 'HALF_OPEN', 86400);
          await safeRedisDel(this.canaryKey);
          return 'HALF_OPEN';
        }
      }

      return state;
    } catch {
      return this.evaluateInMemoryState();
    }
  }

  private evaluateInMemoryState(): CircuitState {
    const now = Date.now();
    if (this.memState.state === 'OPEN') {
      if (now - this.memState.openedAt >= this.memState.cooldownSeconds * 1000) {
        this.memState.state = 'HALF_OPEN';
        this.memState.canaryInFlight = false;
      }
    }
    return this.memState.state;
  }

  public async canExecute(): Promise<boolean> {
    const state = await this.getState();
    if (state === 'CLOSED') {
      return true;
    }
    if (state === 'HALF_OPEN') {
      return this.allowCanaryProbe();
    }
    return false;
  }

  public async allowCanaryProbe(): Promise<boolean> {
    const state = await this.getState();
    if (state !== 'HALF_OPEN') {
      return false;
    }

    if (!this.isRedisActive()) {
      if (!this.memState.canaryInFlight) {
        this.memState.canaryInFlight = true;
        return true;
      }
      return false;
    }

    try {
      // Atomic reservation of canary slot using SET NX
      const res = await redis.set(this.canaryKey, 'probe', 'EX', 30, 'NX');
      return res === 'OK';
    } catch {
      if (!this.memState.canaryInFlight) {
        this.memState.canaryInFlight = true;
        return true;
      }
      return false;
    }
  }

  public async recordSuccess(): Promise<void> {
    const state = await this.getState();

    if (!this.isRedisActive()) {
      this.memState.state = 'CLOSED';
      this.memState.failures = 0;
      this.memState.cooldownSeconds = this.initialCooldownSeconds;
      this.memState.canaryInFlight = false;
      return;
    }

    try {
      await safeRedisSet(this.stateKey, 'CLOSED', 86400);
      await safeRedisDel(this.failuresKey);
      await safeRedisDel(this.lastFailureKey);
      await safeRedisDel(this.openedAtKey);
      await safeRedisDel(this.canaryKey);
      await safeRedisSet(this.cooldownKey, this.initialCooldownSeconds.toString(), 86400);
    } catch {
      this.memState.state = 'CLOSED';
      this.memState.failures = 0;
      this.memState.cooldownSeconds = this.initialCooldownSeconds;
      this.memState.canaryInFlight = false;
    }
  }

  public async recordFailure(_error?: Error | string): Promise<void> {
    const state = await this.getState();
    const now = Date.now();

    if (!this.isRedisActive()) {
      this.memState.lastFailureAt = now;
      if (state === 'HALF_OPEN') {
        // Canary probe failed: double cooldown and return to OPEN
        this.memState.state = 'OPEN';
        this.memState.openedAt = now;
        this.memState.cooldownSeconds = Math.min(
          this.memState.cooldownSeconds * 2,
          this.maxCooldownSeconds
        );
        this.memState.canaryInFlight = false;
        return;
      }

      this.memState.failures += 1;
      if (this.memState.failures >= this.failureThreshold) {
        this.memState.state = 'OPEN';
        this.memState.openedAt = now;
      }
      return;
    }

    try {
      if (state === 'HALF_OPEN') {
        // Canary probe failed
        const currentCooldownRaw = await safeRedisGet(this.cooldownKey);
        const currentCooldown = currentCooldownRaw
          ? parseInt(currentCooldownRaw, 10)
          : this.initialCooldownSeconds;
        const newCooldown = Math.min(currentCooldown * 2, this.maxCooldownSeconds);

        await safeRedisSet(this.stateKey, 'OPEN', 86400);
        await safeRedisSet(this.openedAtKey, now.toString(), 86400);
        await safeRedisSet(this.cooldownKey, newCooldown.toString(), 86400);
        await safeRedisDel(this.canaryKey);
        return;
      }

      // In CLOSED state
      const currentFailuresRaw = await safeRedisGet(this.failuresKey);
      const failures = (currentFailuresRaw ? parseInt(currentFailuresRaw, 10) : 0) + 1;

      await safeRedisSet(this.failuresKey, failures.toString(), 60);
      await safeRedisSet(this.lastFailureKey, now.toString(), 86400);

      if (failures >= this.failureThreshold) {
        await safeRedisSet(this.stateKey, 'OPEN', 86400);
        await safeRedisSet(this.openedAtKey, now.toString(), 86400);
        await safeRedisSet(this.cooldownKey, this.initialCooldownSeconds.toString(), 86400);
      }
    } catch {
      this.memState.failures += 1;
      if (this.memState.failures >= this.failureThreshold || state === 'HALF_OPEN') {
        this.memState.state = 'OPEN';
        this.memState.openedAt = now;
      }
    }
  }

  public async getCooldownSeconds(): Promise<number> {
    if (!this.isRedisActive()) {
      return this.memState.cooldownSeconds;
    }
    try {
      const val = await safeRedisGet(this.cooldownKey);
      return val ? parseInt(val, 10) : this.initialCooldownSeconds;
    } catch {
      return this.memState.cooldownSeconds;
    }
  }

  public async reset(): Promise<void> {
    this.memState = {
      state: 'CLOSED',
      failures: 0,
      lastFailureAt: 0,
      openedAt: 0,
      cooldownSeconds: this.initialCooldownSeconds,
      canaryInFlight: false,
    };

    if (this.isRedisActive()) {
      try {
        await safeRedisDel(this.stateKey);
        await safeRedisDel(this.failuresKey);
        await safeRedisDel(this.lastFailureKey);
        await safeRedisDel(this.openedAtKey);
        await safeRedisDel(this.cooldownKey);
        await safeRedisDel(this.canaryKey);
      } catch {}
    }
  }

  public async forceOpen(cooldownSeconds?: number): Promise<void> {
    const cd = cooldownSeconds ?? this.initialCooldownSeconds;
    const now = Date.now();
    this.memState.state = 'OPEN';
    this.memState.openedAt = now;
    this.memState.cooldownSeconds = cd;

    if (this.isRedisActive()) {
      try {
        await safeRedisSet(this.stateKey, 'OPEN', 86400);
        await safeRedisSet(this.openedAtKey, now.toString(), 86400);
        await safeRedisSet(this.cooldownKey, cd.toString(), 86400);
      } catch {}
    }
  }

  public async forceHalfOpen(): Promise<void> {
    this.memState.state = 'HALF_OPEN';
    this.memState.canaryInFlight = false;

    if (this.isRedisActive()) {
      try {
        await safeRedisSet(this.stateKey, 'HALF_OPEN', 86400);
        await safeRedisDel(this.canaryKey);
      } catch {}
    }
  }

  public async forceClosed(): Promise<void> {
    await this.reset();
  }
}

export const googleSheetsCircuitBreaker = new DistributedCircuitBreaker({
  serviceName: 'google_sheets',
  failureThreshold: 5,
  initialCooldownSeconds: 60,
  maxCooldownSeconds: 900,
});
