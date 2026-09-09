export type WorkerExportFilterType = 'ALL' | 'DEPARTMENT' | 'JOB_TITLE' | 'GOVERNORATE';

export interface WorkerExportFilter {
  type: WorkerExportFilterType;
  departmentId?: string | undefined;
  jobTitleId?: string | undefined;
  governorateCode?: string | undefined;
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
  nickname?: string | undefined;
  legacyCode?: string | undefined;
  idType: 'NATIONAL_ID' | 'PASSPORT';
  idNumber: string;
  nationality: string;
  birthDate?: Date | undefined;
  gender?: 'MALE' | 'FEMALE' | undefined;
  phone: string;
  jobCode: string;
  siteCode: string;
  hireDate?: Date | undefined;
  paymentMethod: string;
  walletType?: string | undefined;
  accountNumber?: string | undefined;
  drivingLicense?: string | undefined;
  militaryStatus?: string | undefined;
  emergencyPhone?: string | undefined;
  previousInsuranceStatus?: string | undefined;
  maritalStatus?: string | undefined;
  notes?: string | undefined;
}

export interface WorkerImportResult {
  success: boolean;
  totalRowsProcessed: number;
  workersCreated: number;
  errors: string[];
  createdWorkers?: Array<{ code: string; name: string }> | undefined;
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
