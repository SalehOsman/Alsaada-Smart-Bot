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
  contractTypeAr?: string | undefined;
  governorateName?: string | undefined;
  dailyWageMasked?: string | undefined;
  basicSalaryMasked?: string | undefined;
  additionalSalaryMasked?: string | undefined;
  totalSalaryMasked?: string | undefined;
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
  telegramId?: bigint | null | undefined;
  documentsCount?: number | undefined;
  commitmentBadge?: string | undefined;
}

export interface WorkerDocumentItem {
  id: string;
  workerId: string;
  title: string;
  category: string;
  fileName: string;
  fileType: string;
  fileUri: string;
  driveFileId?: string | null | undefined;
  fileSizeBytes?: bigint | null | undefined;
  uploadedBy?: bigint | null | undefined;
  createdAt: Date;
  updatedAt?: Date | undefined;
}

export interface WorkerDocUploadState {
  workerId: string;
  workerCode: string;
  workerName: string;
  step: 'PICK_CATEGORY' | 'CUSTOM_TITLE' | 'AWAIT_FILE';
  category?: string | undefined;
  title?: string | undefined;
  activeMessageId?: number | undefined;
  chatId?: number | undefined;
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
