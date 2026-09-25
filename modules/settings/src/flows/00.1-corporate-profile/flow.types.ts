export interface CompanyProfileDto {
  id: string;
  legalName: string;
  tradeName: string;
  commercialRegistrationNumber: string | null;
  commercialRegistrationIssueDate?: string | null;
  commercialRegistrationExpiryDate?: string | null;
  socialInsuranceNumber?: string | null;
  taxRegistrationNumber: string | null;
  vatRegistrationNumber?: string | null;
  logoPath?: string | null;
  logoFileId?: string | null;
  socialLinks?: string | null;
  headerImagePath?: string | null;
  headerImageFileId?: string | null;
  footerImagePath?: string | null;
  footerImageFileId?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  reportShortName?: string | null;
  bankName?: string | null;
  bankAccountHolder?: string | null;
  bankAccountNumber?: string | null;
  bankIban?: string | null;
  bankSwift?: string | null;
  headquartersAddress: string | null;
  primaryPhone: string | null;
  officialEmail: string | null;
  baseCurrency: string;
}

export type CompanyFieldKey =
  | 'legalName'
  | 'tradeName'
  | 'commercialRegistrationNumber'
  | 'commercialRegistrationIssueDate'
  | 'commercialRegistrationExpiryDate'
  | 'socialInsuranceNumber'
  | 'taxRegistrationNumber'
  | 'vatRegistrationNumber'
  | 'logoPath'
  | 'socialLinks'
  | 'headerImagePath'
  | 'footerImagePath'
  | 'primaryColor'
  | 'secondaryColor'
  | 'reportShortName'
  | 'bankName'
  | 'bankAccountHolder'
  | 'bankAccountNumber'
  | 'bankIban'
  | 'bankSwift'
  | 'headquartersAddress'
  | 'primaryPhone'
  | 'officialEmail'
  | 'baseCurrency';

export interface PendingCompanyEditState {
  fieldKey: CompanyFieldKey;
  promptMessageId: number;
  timestamp: number;
}
