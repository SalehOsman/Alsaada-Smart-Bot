import { SampleQueryRepository } from './flow.repository.js';
import { validateQueryFilter, type QueryFilterInput } from './flow.validators.js';
import type { QueryResultItem } from './flow.types.js';

export class SampleQueryService {
  constructor(private readonly repository: SampleQueryRepository) {}

  async listRecords(filter: QueryFilterInput): Promise<QueryResultItem[]> {
    const check = validateQueryFilter(filter);
    if (!check.isValid) {
      throw new Error(check.error ?? 'معايير الاستعلام غير صحيحة');
    }
    return this.repository.query(filter.status, filter.limit ?? 10);
  }
}
