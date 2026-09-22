import type { SampleDomainDTO } from './flow.types.js';

export class SampleDomainRepository {
  private records: Map<string, SampleDomainDTO> = new Map();

  async create(record: Omit<SampleDomainDTO, 'id'>): Promise<SampleDomainDTO> {
    const id = `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const created: SampleDomainDTO = { id, ...record };
    this.records.set(id, created);
    return created;
  }

  async findById(id: string): Promise<SampleDomainDTO | null> {
    return this.records.get(id) ?? null;
  }

  async listAll(): Promise<SampleDomainDTO[]> {
    return Array.from(this.records.values());
  }
}
