import { SampleDomainRepository } from './flow.repository.js';
import { validateSampleCreation, type SampleCreationInput } from './flow.validators.js';
import type { SampleDomainDTO } from './flow.types.js';

export class SampleDomainService {
  constructor(private readonly repository: SampleDomainRepository) {}

  async createRecord(input: SampleCreationInput): Promise<SampleDomainDTO> {
    const check = validateSampleCreation(input);
    if (!check.isValid) {
      throw new Error(check.error ?? 'بيانات العملية غير صحيحة');
    }
    return this.repository.create({
      title: input.title.trim(),
      amount: input.amount,
      status: 'APPROVED',
    });
  }

  async getRecord(id: string): Promise<SampleDomainDTO | null> {
    return this.repository.findById(id);
  }
}
