import type { QueryResultItem } from './flow.types.js';

export class SampleQueryRepository {
  private items: QueryResultItem[] = [
    { id: 'rec-001', title: 'عملية تجريبية 1', status: 'APPROVED', amount: 1500 },
    { id: 'rec-002', title: 'عملية تجريبية 2', status: 'APPROVED', amount: 3200 },
  ];

  async query(status?: string, limit = 10): Promise<QueryResultItem[]> {
    let result = this.items;
    if (status && status !== 'ALL') {
      result = result.filter((i) => i.status === status);
    }
    return result.slice(0, limit);
  }
}
