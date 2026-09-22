import { SampleQueryService } from './flow.service.js';
import { SampleQueryRepository } from './flow.repository.js';
import { QueryMessages } from './flow.messages.js';
import { buildQueryKeyboard } from './flow.keyboard.js';
import { createQueryEvent } from './flow.telemetry.js';

export class SampleQueryHandler {
  private service: SampleQueryService;

  constructor(repository?: SampleQueryRepository) {
    this.service = new SampleQueryService(repository ?? new SampleQueryRepository());
  }

  async handleQuery(userId: number, role: string, status = 'ALL') {
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return {
        text: QueryMessages.unauthorized,
        keyboard: [],
      };
    }

    createQueryEvent('query_executed', userId);
    const records = await this.service.listRecords({ status: status as any, limit: 10 });

    if (records.length === 0) {
      return {
        text: QueryMessages.emptyList,
        keyboard: buildQueryKeyboard(),
        records: [],
      };
    }

    const itemsText = records.map((r) => `• ${r.title} - ${r.amount} ج.م [${r.status}]`).join('\n');
    return {
      text: `${QueryMessages.listTitle(records.length)}\n\n${itemsText}`,
      keyboard: buildQueryKeyboard(),
      records,
    };
  }
}
