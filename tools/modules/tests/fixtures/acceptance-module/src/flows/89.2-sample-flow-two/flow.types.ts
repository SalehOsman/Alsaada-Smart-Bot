export interface QueryFilter {
  status?: string;
  limit?: number;
}

export interface QueryResultItem {
  id: string;
  title: string;
  status: string;
  amount: number;
}
