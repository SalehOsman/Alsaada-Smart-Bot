export interface GovernorateItem {
  code: string;
  nameAr: string;
  nameEn: string;
}

export interface GovernoratePickerOptions {
  page?: number | undefined;
  pageSize?: number | undefined;
  actionPrefix?: string | undefined;
  pagePrefix?: string | undefined;
  valueType?: 'code' | 'name' | undefined;
  backCallbackData?: string | undefined;
  cancelCallbackData?: string | undefined;
  cancelText?: string | undefined;
  noopCallbackData?: string | undefined;
}
