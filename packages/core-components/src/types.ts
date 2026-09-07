export interface WorkerItem {
  id: string;
  code: string;
  name: string;
  jobTitle?: string;
  siteLocation?: string;
  phone?: string;
  dailyWage?: number;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CustomActionButton {
  text: string;
  callbackData: string;
}
