export interface CompanyProfileDto {
  id: string;
  tenantId: string;
  legalName: string;
  tradeName: string;
  commercialRegistrationNumber: string | null;
  taxRegistrationNumber: string | null;
  headquartersAddress: string | null;
  primaryPhone: string | null;
  officialEmail: string | null;
  baseCurrency: string;
}

export type CompanyFieldKey =
  | 'legalName'
  | 'tradeName'
  | 'commercialRegistrationNumber'
  | 'taxRegistrationNumber'
  | 'headquartersAddress'
  | 'primaryPhone'
  | 'officialEmail'
  | 'baseCurrency';

export interface PendingCompanyEditState {
  fieldKey: CompanyFieldKey;
  promptMessageId: number;
  timestamp: number;
}
