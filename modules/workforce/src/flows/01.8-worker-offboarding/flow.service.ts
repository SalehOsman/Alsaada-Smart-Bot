import type { WorkerOffboardingRepository } from './flow.repository.js';
import type { WorkerOffboardingInput, WorkerOffboardingResult } from './flow.types.js';
import {
  validateTerminationReason,
  validateOffboardingEligibility,
} from './flow.validators.js';

export class WorkerOffboardingService {
  constructor(
    private readonly repository: WorkerOffboardingRepository,
    private readonly onWorkerDemoted?: (demotedTelegramId: bigint) => Promise<void>
  ) {}

  async getActiveWorkers(siteId?: string) {
    return this.repository.getActiveWorkers(siteId);
  }

  async getWorkerById(workerId: string) {
    return this.repository.getWorkerById(workerId);
  }

  async executeOffboarding(input: WorkerOffboardingInput): Promise<WorkerOffboardingResult> {
    if (!validateTerminationReason(input.reason)) {
      throw new Error('سبب إنهاء الخدمة المحدد غير معتمد.');
    }

    const worker = await this.repository.getWorkerById(input.workerId);
    if (!worker) {
      throw new Error('لم يتم العثور على سجل العامل المطلوب إنهاء خدمته.');
    }

    const eligibility = validateOffboardingEligibility(worker.status);
    if (!eligibility.eligible) {
      throw new Error(eligibility.error || 'العامل غير مؤهل للمخالصة.');
    }

    const result = await this.repository.terminateWorker(input);

    if (result.demotedTelegramId && this.onWorkerDemoted) {
      await this.onWorkerDemoted(result.demotedTelegramId);
    }

    return result;
  }
}
