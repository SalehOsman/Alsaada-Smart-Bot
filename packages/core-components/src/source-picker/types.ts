export type FundSourceType = 'CUSTODY' | 'MAIN_TREASURY';

export interface CustodyOption {
  id: string;
  name: string;
  balance: number;
  location?: string;
}

export interface FundSourceSelection {
  type: FundSourceType;
  custodyId?: string;
  custodyName?: string;
  availableBalance?: number;
}
