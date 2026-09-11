export interface HqGroupStatusDto {
  chatId: string | null;
  title?: string | null;
  isBound: boolean;
  topicsConfigured: boolean;
  topics: {
    siteClosuresThreadId?: number;
    financialDigestsThreadId?: number;
    logisticsFuelThreadId?: number;
    executiveDecreesThreadId?: number;
  };
}

export interface SiteGroupItemDto {
  id: string;
  code: string;
  name: string;
  governorate: string;
  telegramGroupId: string | null;
  isBound: boolean;
  workersCount: number;
}

export interface GroupHealthStatusDto {
  isAvailable: boolean;
  chatId: string;
  title?: string | undefined;
  type?: string | undefined;
  isForum?: boolean | undefined;
  canPostMessages: boolean;
  canManageTopics: boolean;
  canDeleteMessages: boolean;
  statusMessage: string;
}
