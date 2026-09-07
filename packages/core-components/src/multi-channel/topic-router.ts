export type TransactionCategory =
  | 'CANTEEN'
  | 'ADVANCES'
  | 'LOGISTICS'
  | 'FUELS'
  | 'CUSTODY'
  | 'WORKFORCE'
  | 'GENERAL';

export interface ForumTopicConfig {
  canteenTopicId?: number;
  advancesTopicId?: number;
  logisticsTopicId?: number;
  fuelsTopicId?: number;
  custodyTopicId?: number;
  workforceTopicId?: number;
  generalTopicId?: number;
}

/**
 * Resolves the Telegram Forum Thread ID for a given transaction category.
 */
export function resolveTopicId(category: TransactionCategory, config: ForumTopicConfig): number | undefined {
  switch (category) {
    case 'CANTEEN':
      return config.canteenTopicId ?? config.generalTopicId;
    case 'ADVANCES':
      return config.advancesTopicId ?? config.generalTopicId;
    case 'LOGISTICS':
      return config.logisticsTopicId ?? config.generalTopicId;
    case 'FUELS':
      return config.fuelsTopicId ?? config.generalTopicId;
    case 'CUSTODY':
      return config.custodyTopicId ?? config.generalTopicId;
    case 'WORKFORCE':
      return config.workforceTopicId ?? config.generalTopicId;
    case 'GENERAL':
    default:
      return config.generalTopicId;
  }
}
