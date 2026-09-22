import { SampleDomainService } from './flow.service.js';
import { SampleDomainRepository } from './flow.repository.js';
import { SampleMessages } from './flow.messages.js';
import { buildSampleConfirmationKeyboard } from './flow.keyboard.js';
import { createSampleEvent } from './flow.telemetry.js';

export class SampleFlowHandler {
  private service: SampleDomainService;

  constructor(repository?: SampleDomainRepository) {
    this.service = new SampleDomainService(repository ?? new SampleDomainRepository());
  }

  async handleStart(userId: number, role: string) {
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return {
        text: SampleMessages.unauthorized,
        keyboard: [],
      };
    }

    createSampleEvent('flow_started', userId);
    return {
      text: SampleMessages.welcome,
      keyboard: buildSampleConfirmationKeyboard(),
    };
  }

  async handleConfirm(userId: number, title: string, amount: number) {
    const record = await this.service.createRecord({ title, amount });
    createSampleEvent('record_created', userId);
    return {
      text: SampleMessages.success(record.id),
      keyboard: [],
      record,
    };
  }
}
