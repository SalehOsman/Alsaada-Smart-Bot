export type TransactionCategory =
  | 'CANTEEN'
  | 'ADVANCES'
  | 'LOGISTICS'
  | 'FUELS'
  | 'CUSTODY'
  | 'WORKFORCE'
  | 'GENERAL'
  | 'HQ_SITE_CLOSURES'
  | 'HQ_FINANCIAL_DIGESTS'
  | 'HQ_LOGISTICS_FUEL'
  | 'HQ_EXECUTIVE_DECREES';

export interface ForumTopicConfig {
  canteenTopicId?: number;
  advancesTopicId?: number;
  logisticsTopicId?: number;
  fuelsTopicId?: number;
  custodyTopicId?: number;
  workforceTopicId?: number;
  generalTopicId?: number;
  // Executive HQ Group 4 Topics
  hqSiteClosuresTopicId?: number;
  hqFinancialDigestsTopicId?: number;
  hqLogisticsFuelTopicId?: number;
  hqExecutiveDecreesTopicId?: number;
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
    case 'HQ_SITE_CLOSURES':
      return config.hqSiteClosuresTopicId ?? config.generalTopicId;
    case 'HQ_FINANCIAL_DIGESTS':
      return config.hqFinancialDigestsTopicId ?? config.generalTopicId;
    case 'HQ_LOGISTICS_FUEL':
      return config.hqLogisticsFuelTopicId ?? config.generalTopicId;
    case 'HQ_EXECUTIVE_DECREES':
      return config.hqExecutiveDecreesTopicId ?? config.generalTopicId;
    case 'GENERAL':
    default:
      return config.generalTopicId;
  }
}
