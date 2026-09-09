export interface WorkerDirectoryItem {
  id: string;
  code: string;
  legacyCode?: string;
  aliases: string[];
  name: string;
  nickname?: string;
  jobTitle: string;
  siteName?: string;
  status: string;
}

export interface WorkerProfile360 {
  id: string;
  code: string;
  legacyCode?: string;
  name: string;
  nickname?: string;
  idType: 'NATIONAL_ID' | 'PASSPORT';
  idNumberMasked: string;
  phone?: string;
  jobTitle: string;
  departmentName?: string;
  siteName?: string;
  hireDate: Date;
  shiftSystem?: string;
  dailyWageMasked?: string;
  paymentMethod?: string;
  accountNumberMasked?: string;
  drivingLicense?: string;
  militaryStatus?: string;
  maritalStatus?: string;
  emergencyContactName?: string;
  emergencyPhone?: string;
  idCardExpiryDate?: Date;
  address?: string;
  status: string;
  directWhatsAppUrl?: string;
  isProfileComplete: boolean;
  completionPercentage: number;
  missingItems: string[];
  missingDataWhatsAppUrl?: string;
}

export interface WorkerDirectoryQuery {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
  siteId?: string;
  status?: string;
}

export interface WorkerDirectoryResult {
  items: WorkerDirectoryItem[];
  totalCount: number;
  page: number;
  totalPages: number;
}
