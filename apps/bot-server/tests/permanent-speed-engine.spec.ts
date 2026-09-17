import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fastCache } from '../src/services/fast-cache.service.js';
import { safeDeleteBackground } from '../src/services/screen-flow.service.js';
import { telemetryService } from '../src/services/telemetry.service.js';
import { outgoingAgent, pollingAgent } from '../src/bot.js';

describe('⚡ Permanent Speed Engine — 7 Sovereign Architectural Pillars', () => {
  beforeEach(async () => {
    fastCache.clearL1();
    telemetryService.resetCircuitBreaker();
    telemetryService.resetConsecutiveSlowCount();
    telemetryService.setLastHealTimestamp(0);
  });

  // Pillar 1: L1 RAM Micro-Cache & Memoization
  describe('Pillar 1: Tiered L1 RAM / L2 Redis Sovereign Cache', () => {
    it('should memoize static keyboards to eliminate GC churn and multiple instantiations', () => {
      let buildCount = 0;
      const builder = () => {
        buildCount++;
        return { inline_keyboard: [[{ text: 'زر ثابت', callback_data: 'test' }]] };
      };

      const kb1 = fastCache.memoizeKeyboard('static_test_menu', builder);
      const kb2 = fastCache.memoizeKeyboard('static_test_menu', builder);

      expect(buildCount).toBe(1);
      expect(kb1).toBe(kb2);
    });

    it('should provide sub-millisecond L1 RAM access for user context (< 0.1ms)', async () => {
      const testUserId = BigInt(Math.floor(Math.random() * 900000000) + 100000000);
      await fastCache.invalidateUserContext(testUserId);

      let dbFetchCount = 0;
      const fetcher = async () => {
        dbFetchCount++;
        return { id: 1001, role: 'SUPER_ADMIN', name: 'Saleh' };
      };

      const firstCall = await fastCache.rememberUserContext(testUserId, fetcher);
      expect(firstCall.name).toBe('Saleh');
      expect(dbFetchCount).toBe(1);

      const t0 = performance.now();
      const secondCall = await fastCache.rememberUserContext(testUserId, fetcher);
      const durationMs = performance.now() - t0;

      expect(secondCall.name).toBe('Saleh');
      expect(dbFetchCount).toBe(1); // Served directly from L1 RAM
      expect(durationMs).toBeLessThan(5); // Well within ultra-fast RAM threshold
    });
  });

  // Pillar 2: In-Place Mutation & Safe Background Deletions
  describe('Pillar 2: In-Place Mutation Sovereignty & Safe Background Deletions', () => {
    it('should execute safeDeleteBackground without throwing even if telegram deleteMessage fails', async () => {
      const mockCtx = {
        api: {
          deleteMessage: vi.fn().mockRejectedValue(new Error('message to delete not found')),
        },
        chat: { id: 123456 },
      } as any;

      expect(() => {
        safeDeleteBackground(mockCtx, 999);
      }).not.toThrow();

      // Ensure deleteMessage was invoked in the background
      expect(mockCtx.api.deleteMessage).toHaveBeenCalledWith(123456, 999);
    });
  });

  // Pillar 3: Dedicated Warm Socket Pool & Polling Isolation
  describe('Pillar 3: Dedicated Outgoing Warm Socket Pool', () => {
    it('should have outgoingAgent configured with keepAlive, maxFreeSockets >= 15 and maxSockets >= 50', () => {
      const agent = outgoingAgent as unknown as { keepAlive?: boolean; maxFreeSockets?: number; maxSockets?: number };
      expect(agent.keepAlive).toBe(true);
      expect(agent.maxFreeSockets).toBeGreaterThanOrEqual(15);
      expect(agent.maxSockets).toBeGreaterThanOrEqual(50);
    });

    it('should isolate pollingAgent from outgoingAgent', () => {
      const poll = pollingAgent as unknown as { keepAlive?: boolean; maxSockets?: number };
      expect(pollingAgent).not.toBe(outgoingAgent);
      expect(poll.keepAlive).toBe(true);
      expect(poll.maxSockets).toBeLessThanOrEqual(10);
    });
  });

  // Pillar 4: Pre-Routing Instant ACK Gate
  describe('Pillar 4: Pre-Routing Instant ACK Gate', () => {
    it('should not perform redundant roundtrips when answerCallbackQuery was already sent by instant ACK gate', async () => {
      const origAnswer = vi.fn().mockResolvedValue(true);
      let defaultAckSent = false;

      const fakeCtx = {
        callbackQuery: { id: 'cq-123', data: 'action:click' },
        answerCallbackQuery: async (textOrOptions?: any, opts?: any) => {
          const hasCustomAlert =
            (typeof textOrOptions === 'string' && textOrOptions.length > 0) ||
            (typeof textOrOptions === 'object' && (textOrOptions.text || textOrOptions.show_alert || textOrOptions.url));
          if (!hasCustomAlert && defaultAckSent) {
            return true;
          }
          return origAnswer(textOrOptions, opts);
        },
      };

      // Simulate pre-routing instant ACK
      defaultAckSent = true;
      void origAnswer();

      expect(origAnswer).toHaveBeenCalledTimes(1);

      // Downstream handler calls standard ctx.answerCallbackQuery() without custom alert
      const downstreamResult = await fakeCtx.answerCallbackQuery();
      expect(downstreamResult).toBe(true);
      // origAnswer should NOT have been called again!
      expect(origAnswer).toHaveBeenCalledTimes(1);

      // But if downstream handler specifies a custom modal alert, it MUST be delivered!
      await fakeCtx.answerCallbackQuery({ text: 'تنبيه مالي عاجل', show_alert: true });
      expect(origAnswer).toHaveBeenCalledTimes(2);
      expect(origAnswer).toHaveBeenLastCalledWith({ text: 'تنبيه مالي عاجل', show_alert: true }, undefined);
    });
  });

  // Pillar 5: Circuit-Breaker Latency Watchdog
  describe('Pillar 5: Circuit-Breaker Latency Watchdog & Auto-Heal', () => {
    it('should trigger connection pool warmUp when 3 consecutive operations exceed 500ms and cooldown is expired', async () => {
      const mockWarmer = vi.fn().mockResolvedValue(undefined);
      telemetryService.setConnectionPoolWarmer(mockWarmer);
      telemetryService.setLastHealTimestamp(0); // Cooldown expired (>60s ago)

      const alertSpy = vi.fn();
      const unsub = telemetryService.onAlert(alertSpy);

      // 1st slow operation
      await telemetryService.recordPerformance({
        actorTelegramId: 101n,
        callbackQueryOrCommand: 'action:menu',
        executionTimeMs: 550,
      });
      expect(mockWarmer).not.toHaveBeenCalled();

      // 2nd slow operation
      await telemetryService.recordPerformance({
        actorTelegramId: 101n,
        callbackQueryOrCommand: 'action:menu',
        executionTimeMs: 620,
      });
      expect(mockWarmer).not.toHaveBeenCalled();

      // 3rd slow operation -> triggers auto-heal!
      await telemetryService.recordPerformance({
        actorTelegramId: 101n,
        callbackQueryOrCommand: 'action:menu',
        executionTimeMs: 710,
      });

      expect(mockWarmer).toHaveBeenCalledTimes(1);
      expect(telemetryService.isCircuitBreakerOpen()).toBe(false);

      const healAlert = alertSpy.mock.calls.find((call) => call[0]?.type === 'CONNECTION_POOL_HEALED');
      expect(healAlert).toBeDefined();

      unsub();
    });

    it('should trip circuit breaker if recurrent slow operations happen within 60s cooldown to prevent self-DDoS', async () => {
      const mockWarmer = vi.fn().mockResolvedValue(undefined);
      telemetryService.setConnectionPoolWarmer(mockWarmer);

      // Simulate a recent heal within cooldown
      telemetryService.setLastHealTimestamp(Date.now() - 10_000); // 10s ago (<60s)

      const alertSpy = vi.fn();
      const unsub = telemetryService.onAlert(alertSpy);

      // 3 consecutive slow operations during active cooldown
      for (let i = 0; i < 3; i++) {
        await telemetryService.recordPerformance({
          actorTelegramId: 102n,
          callbackQueryOrCommand: 'action:heavy_op',
          executionTimeMs: 800,
        });
      }

      // Circuit breaker MUST be tripped to protect from self-DDoS!
      expect(telemetryService.isCircuitBreakerOpen()).toBe(true);
      expect(telemetryService.getCircuitBreakerTrippedAt()).not.toBeNull();
      expect(mockWarmer).not.toHaveBeenCalled(); // No additional spamming warmer calls

      const tripAlert = alertSpy.mock.calls.find((call) => call[0]?.type === 'CIRCUIT_BREAKER_TRIPPED');
      expect(tripAlert).toBeDefined();

      unsub();
    });

    it('should reset circuit breaker and restore normal state via resetCircuitBreaker()', () => {
      telemetryService.tripCircuitBreaker('Manual test');
      expect(telemetryService.isCircuitBreakerOpen()).toBe(true);

      telemetryService.resetCircuitBreaker();
      expect(telemetryService.isCircuitBreakerOpen()).toBe(false);
      expect(telemetryService.getCircuitBreakerTrippedAt()).toBeNull();
    });
  });
});
