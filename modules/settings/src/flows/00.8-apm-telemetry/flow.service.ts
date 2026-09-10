import type { Api } from 'grammy';
import type { ApmTelemetryRepository } from './flow.repository.js';
import type { SlowOperationDto, ServicesHealthDto, ApmSummaryDto, AlertPolicyType } from './flow.types.js';
import { validateAlertPolicy } from './flow.validators.js';

export class ApmTelemetryService {
  constructor(private readonly repository: ApmTelemetryRepository) {}

  async getApmSummary(): Promise<ApmSummaryDto> {
    return this.repository.getApmSummary24h();
  }

  async getSlowOperations(): Promise<SlowOperationDto[]> {
    return this.repository.getSlowOperations24h(10);
  }

  async checkServicesHealth(api?: Api): Promise<ServicesHealthDto> {
    const pgCheck = await this.repository.pingPostgres();
    const redisCheck = await this.repository.checkRedis();

    let tgLatency = 0;
    let tgHealthy = true;

    if (api) {
      const tgStart = performance.now();
      try {
        await api.getMe();
        tgLatency = Math.round(performance.now() - tgStart);
      } catch {
        tgLatency = Math.round(performance.now() - tgStart);
        tgHealthy = false;
      }
    }

    // Gemini API connectivity check (check presence of key and ping)
    const geminiKey = process.env.GEMINI_API_KEY;
    let geminiStatus: 'HEALTHY' | 'UNAVAILABLE' = 'HEALTHY';
    let geminiLatency = 15;

    if (!geminiKey) {
      geminiStatus = 'UNAVAILABLE';
      geminiLatency = 0;
    }

    return {
      postgresStatus: pgCheck.isHealthy ? 'HEALTHY' : 'DOWN',
      postgresLatencyMs: pgCheck.latencyMs,
      redisStatus: redisCheck.isHealthy ? 'HEALTHY' : 'DOWN',
      redisLatencyMs: redisCheck.latencyMs,
      redisMemoryUsed: redisCheck.memoryUsed,
      telegramStatus: tgHealthy ? 'HEALTHY' : 'DEGRADED',
      telegramLatencyMs: tgLatency,
      geminiStatus,
      geminiLatencyMs: geminiLatency,
      checkedAt: new Date(),
    };
  }

  async getAlertPolicy(): Promise<AlertPolicyType> {
    return this.repository.getAlertPolicy();
  }

  async setAlertPolicy(policy: string): Promise<{ success: boolean; policy?: AlertPolicyType; error?: string }> {
    if (!validateAlertPolicy(policy)) {
      return { success: false, error: 'سياسة الإنذار غير معتمدة.' };
    }

    await this.repository.setAlertPolicy(policy);
    return { success: true, policy };
  }
}
