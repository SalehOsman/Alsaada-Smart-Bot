export interface WorkerDirectoryItem {
  id: string;
  code: string;
  legacyCode?: string | null;
  aliases: string[];
  name: string;
  nickname?: string | null;
  jobTitle: string;
  siteName?: string | undefined;
  status: string;
}

export interface WorkerProfile360 {
  id: string;
  code: string;
  legacyCode?: string | undefined;
  name: string;
  nickname?: string | undefined;
  idType: 'NATIONAL_ID' | 'PASSPORT';
  idNumberMasked: string;
  idNumberFull?: string | undefined;
  canRevealId?: boolean | undefined;
  isIdRevealed?: boolean | undefined;
  phone?: string | undefined;
  jobTitle: string;
  departmentName?: string | undefined;
  siteName?: string | undefined;
  hireDate: Date;
  shiftSystem?: string | undefined;
  dailyWageMasked?: string | undefined;
  paymentMethod?: string | undefined;
  accountNumberMasked?: string | undefined;
  drivingLicense?: string | undefined;
  militaryStatus?: string | undefined;
  maritalStatus?: string | undefined;
  emergencyContactName?: string | undefined;
  emergencyPhone?: string | undefined;
  idCardExpiryDate?: Date | undefined;
  address?: string | undefined;
  status: string;
  directWhatsAppUrl?: string | undefined;
  isProfileComplete: boolean;
  completionPercentage: number;
  missingItems: string[];
  missingDataWhatsAppUrl?: string | undefined;
}

export interface WorkerDirectoryQuery {
  page?: number | undefined;
  pageSize?: number | undefined;
  searchQuery?: string | undefined;
  siteId?: string | undefined;
  status?: string | undefined;
}

export interface WorkerDirectoryResult {
  items: WorkerDirectoryItem[];
  totalCount: number;
  page: number;
  totalPages: number;
}
