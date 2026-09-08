export type WorkerExportFilterType = 'ALL' | 'DEPARTMENT' | 'JOB_TITLE' | 'GOVERNORATE';

export interface WorkerExportFilter {
  type: WorkerExportFilterType;
  departmentId?: string;
  jobTitleId?: string;
  governorateCode?: string;
}

export interface WorkerExportResult {
  buffer: Buffer;
  fileName: string;
  workerCount: number;
  filterLabel: string;
}

export interface WorkerRowData {
  rowNumber: number;
  fullName: string;
  nickname?: string;
  legacyCode?: string;
  idType: 'NATIONAL_ID' | 'PASSPORT';
  idNumber: string;
  nationality: string;
  birthDate?: Date;
  gender?: 'MALE' | 'FEMALE';
  phone: string;
  jobCode: string;
  siteCode: string;
  hireDate?: Date;
  paymentMethod: string;
  walletType?: string;
  accountNumber?: string;
  drivingLicense?: string;
  militaryStatus?: string;
  emergencyPhone?: string;
  previousInsuranceStatus?: string;
  maritalStatus?: string;
  notes?: string;
}

export interface WorkerImportResult {
  success: boolean;
  totalRowsProcessed: number;
  workersCreated: number;
  errors: string[];
  createdWorkers?: Array<{ code: string; name: string }>;
}

export interface DepartmentSummary {
  id: string;
  name: string;
  code: string;
}

export interface JobTitleSummary {
  id: string;
  name: string;
  code: string;
}

export interface SiteSummary {
  id: string;
  name: string;
  code: string;
}

export interface WorkerExportEntity {
  id: string;
  code: string;
  legacyCode: string | null;
  name?: string;
  fullName?: string;
  nickname: string | null;
  nationalIdEncrypted: string | null;
  idType: string;
  nationality: string;
  birthDate: Date | null;
  gender: string;
  governorateCode: string | null;
  jobTitle: string;
  departmentId: string | null;
  jobTitleId: string | null;
  siteId: string;
  hireDate: Date;
  contractType: string;
  shiftSystem: string;
  dailyWage: number;
  basicSalary: number;
  fixedAllowances: number;
  paymentMethod: string;
  walletType: string | null;
  accountNumberEncrypted: string | null;
  canteenCigarettePolicy: string;
  phoneEncrypted: string;
  emergencyPhoneEncrypted: string | null;
  emergencyContactName: string | null;
  drivingLicense: string | null;
  militaryStatus: string | null;
  maritalStatus: string | null;
  idCardExpiryDate: Date | null;
  address: string | null;
  status: string;
  site: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  jobRef: { id: string; name: string } | null;
}
