export interface CustodyAccount {
  id: string;
  code: string;
  supervisorTelegramId: bigint;
  supervisorName: string;
  siteCode: string;
  currentBalance: number;
  status: 'OPEN' | 'FROZEN' | 'SETTLED';
}

export interface CustodyCheckParams {
  custody: CustodyAccount;
  requiredAmount: number;
  operationType: string;
}

export interface CustodyLockResult {
  isAllowed: boolean;
  custodyId: string;
  requestedAmount: number;
  availableBalance: number;
  projectedBalance: number;
  error?: string | undefined;
  errorArabic?: string | undefined;
}
