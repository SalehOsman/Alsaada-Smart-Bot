import { describe, expect, it } from 'vitest';
import {
  verifyPerformanceBudget,
  L1RamCacheEngine,
  DEFAULT_THRESHOLDS,
} from '../verify-performance-budget.js';

describe('⚡ G14: verify-performance-budget governance gate', () => {
  it('1. passes all 6 SLA thresholds and performance budget requirements under normal execution', async () => {
    const result = await verifyPerformanceBudget({
      l1Iterations: 200,
      flowIterations: 10,
      telemetryIterations: 50,
      heapIterations: 200,
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.checked).toBe(6);
    expect(result.metrics).toBeDefined();

    if (result.metrics) {
      expect(result.metrics.l1AvgMs).toBeLessThan(DEFAULT_THRESHOLDS.l1MaxAvgMs);
      expect(result.metrics.mainMenuAvgMs).toBeLessThan(DEFAULT_THRESHOLDS.mainMenuMaxAvgMs);
      expect(result.metrics.workerDirAvgMs).toBeLessThan(DEFAULT_THRESHOLDS.workerDirMaxAvgMs);
      expect(result.metrics.claimWorkerAvgMs).toBeLessThan(DEFAULT_THRESHOLDS.claimWorkerMaxAvgMs);
      expect(result.metrics.telemetryAvgMs).toBeLessThan(DEFAULT_THRESHOLDS.telemetryMaxAvgMs);
      expect(result.metrics.heapDriftMb).toBeLessThan(DEFAULT_THRESHOLDS.maxHeapDriftMb);
    }
  });

  it('2. detects L1 RAM Cache SLA breach when latency exceeds budget ceiling', async () => {
    const result = await verifyPerformanceBudget({
      l1Iterations: 50,
      thresholds: { l1MaxAvgMs: 0.0000001 }, // Unachievable threshold to force SLA breach
    });

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('L1 RAM Cache latency exceeded budget'))).toBe(true);
  });

  it('3. detects Main Menu flow SLA breach when latency exceeds 10ms', async () => {
    const result = await verifyPerformanceBudget({
      flowIterations: 5,
      thresholds: { mainMenuMaxAvgMs: 0.0000001 },
    });

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('Main menu flow (action:main_menu) exceeded SLA budget'))).toBe(true);
  });

  it('4. detects Worker Directory flow SLA breach when latency exceeds 25ms', async () => {
    const result = await verifyPerformanceBudget({
      flowIterations: 5,
      thresholds: { workerDirMaxAvgMs: 0.0000001 },
    });

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('Worker directory flow (action:worker:directory) exceeded SLA budget'))).toBe(true);
  });

  it('5. detects Claim Worker flow SLA breach when latency exceeds 50ms', async () => {
    const result = await verifyPerformanceBudget({
      flowIterations: 5,
      thresholds: { claimWorkerMaxAvgMs: 0.0000001 },
    });

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('Claim worker flow (action:claim_worker) exceeded SLA budget'))).toBe(true);
  });

  it('6. detects Telemetry SLA breach when non-blocking dispatch exceeds 2ms', async () => {
    const result = await verifyPerformanceBudget({
      telemetryIterations: 10,
      thresholds: { telemetryMaxAvgMs: 0.0000001 },
    });

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('Telemetry dispatch latency exceeded SLA budget'))).toBe(true);
  });

  it('7. detects Memory Heap Drift breach when drift exceeds 5MB', async () => {
    const result = await verifyPerformanceBudget({
      heapIterations: 50,
      thresholds: { maxHeapDriftMb: -999 }, // Negative threshold forces breach
    });

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('Memory heap drift exceeded safety ceiling'))).toBe(true);
  });

  describe('8. L1RamCacheEngine core mechanics', () => {
    it('coalesces concurrent requests for the same key to prevent cache stampedes', async () => {
      const cache = new L1RamCacheEngine();
      let fetchCount = 0;

      const expensiveFetcher = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 10));
        return { data: 'coalesced_result' };
      };

      const results = await Promise.all([
        cache.remember('key:stampede', 60, expensiveFetcher),
        cache.remember('key:stampede', 60, expensiveFetcher),
        cache.remember('key:stampede', 60, expensiveFetcher),
      ]);

      expect(fetchCount).toBe(1);
      expect(results[0]).toEqual({ data: 'coalesced_result' });
      expect(results[1]).toEqual({ data: 'coalesced_result' });
      expect(results[2]).toEqual({ data: 'coalesced_result' });
    });

    it('returns null on cache miss or expired TTL', async () => {
      const cache = new L1RamCacheEngine();
      expect(cache.get('missing_key')).toBeNull();

      cache.set('expiring_key', { val: 42 }, -1); // Already expired
      expect(cache.get('expiring_key')).toBeNull();
    });
  });
});
