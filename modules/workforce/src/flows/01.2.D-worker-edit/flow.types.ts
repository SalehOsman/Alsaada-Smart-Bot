export type WorkerProfileTab = 'PERSONAL' | 'JOB' | 'FINANCE' | 'DOCS';

export type EditableWorkerField =
  // Personal & ID
  | 'legacyCode'
  | 'name'
  | 'nickname'
  | 'governorateCode'
  | 'address'
  | 'idCardExpiryDate'
  | 'militaryStatus'
  | 'maritalStatus'
  | 'nationalId'
  // Job & Operations
  | 'jobTitleId'
  | 'siteId'
  | 'departmentId'
  | 'hireDate'
  | 'status'
  | 'shiftSystem'
  | 'contractType'
  | 'drivingLicense'
  | 'barracksUnit'
  | 'bedNumber'
  // Financial & Quotas
  | 'dailyWage'
  | 'basicSalary'
  | 'fixedAllowances'
  | 'paymentMethod'
  | 'walletNumber'
  | 'walletOwnerName'
  | 'instaPayHandle'
  | 'insuranceNumber'
  | 'insuranceStatus'
  | 'canteenCigarettePolicy'
  | 'cigaretteBrand'
  // Contacts & Safety
  | 'phone'
  | 'emergencyPhone'
  | 'emergencyContactName'
  | 'ppeShoeSize'
  | 'ppeUniformSize'
  | 'medicalNotes';

export interface CreateEditRequestInput {
  workerId: string;
  workerCode: string;
  workerName: string;
  requesterTelegramId: bigint;
  requesterName: string;
  requesterRole: string;
  fieldKey: EditableWorkerField;
  fieldName: string;
  oldValue?: string;
  newValue: string;
  reason?: string;
}

export interface EditExecutionResult {
  success: boolean;
  workerCode?: string;
  fieldName?: string;
  newValue?: string;
  isDirectExecution: boolean;
  ticketId?: string;
  error?: string;
  worker?: unknown;
}

export interface PendingEditTicket {
  id: string;
  requestId: string;
  workerId: string;
  workerCode: string;
  workerName: string;
  requesterName: string;
  requesterRole: string;
  fieldKey: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  reason: string;
  createdAt: Date;
}

export interface PendingWorkerEditState {
  workerId: string;
  workerCode: string;
  workerName: string;
  currentTab?: WorkerProfileTab;
  fieldKey?: EditableWorkerField;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  isSuperAdmin: boolean;
  step?: 'SELECT_POLICY' | 'SELECT_BRAND';
  selectedPolicy?: string;
  promptMsgId?: number;
}

export interface WorkerCardView {
  id: string;
  code: string;
  name: string;
  nickname?: string | null;
  legacyCode?: string | null;
  nationalId?: string | null;
  idCardExpiryDate?: Date | string | null;
  governorateCode?: string | null;
  address?: string | null;
  militaryStatus?: string | null;
  maritalStatus?: string | null;
  governorateName?: string | null;
  jobTitle?: string | null;
  jobTitleId?: string | null;
  jobRef?: { id?: string; name?: string | null; title?: string | null } | null;
  siteId?: string | null;
  site?: { id?: string; name?: string | null } | null;
  departmentId?: string | null;
  department?: { id?: string; name?: string | null } | null;
  shiftSystem?: string | null;
  contractType?: string | null;
  contractTypeAr?: string | null;
  hireDate?: Date | string | null;
  status?: string | null;
  drivingLicense?: string | null;
  barracksUnit?: string | null;
  bedNumber?: string | null;
  paymentMethod?: string | null;
  accountNumberEncrypted?: string | null;
  walletOwnerName?: string | null;
  instaPayHandle?: string | null;
  dailyWage?: unknown;
  basicSalary?: unknown;
  fixedAllowances?: unknown;
  insuranceNumber?: string | null;
  insuranceStatus?: string | null;
  canteenCigarettePolicy?: string | null;
  cigaretteBrand?: string | null;
  canteenItem?: { name: string } | null;
  phone?: string | null;
  emergencyPhone?: string | null;
  accountNumber?: string | null;
  phoneEncrypted?: string | null;
  emergencyPhoneEncrypted?: string | null;
  emergencyContactName?: string | null;
  ppeShoeSize?: string | null;
  ppeUniformSize?: string | null;
  medicalNotes?: string | null;
}

export interface SalaryAdjustmentWizardState {
  workerId: string;
  workerCode: string;
  workerName: string;
  currentBase: number;
  currentAdditional: number;
  currentAdd: number;
  currentGross: number;
  newBase?: number;
  newAdditional?: number;
  effectiveMonth?: string;
  effectiveDate?: Date;
  reason?: string;
  step: 'NEW_BASE' | 'NEW_ADDITIONAL' | 'EFFECTIVE_DATE' | 'REASON' | 'CONFIRM';
}

export interface SalaryHistoryRecord {
  id: string;
  changeId: string;
  workerId: string;
  previousBasicSalary: number;
  previousAdditionalSalary: number;
  previousGrossSalary: number;
  newBasicSalary: number;
  newAdditionalSalary: number;
  newGrossSalary: number;
  effectiveMonth: string;
  effectiveDate: Date;
  reason: string;
  approvedByName?: string | null;
  createdAt: Date;
}

export interface WorkerChangeLogRecord {
  id: string;
  changeId: string;
  workerId: string;
  workerCode: string;
  category: string;
  fieldKey: string;
  fieldNameAr: string;
  oldValue?: string | null;
  newValue?: string | null;
  oldDisplayValue?: string | null;
  newDisplayValue?: string | null;
  reason?: string | null;
  actorName?: string | null;
  actorRole: string;
  createdAt: Date;
}

export interface TicketCreationData {
  requestId: string;
  workerId: string;
  workerCode: string;
  workerName: string;
  requesterTelegramId: bigint;
  requesterName: string;
  requesterRole: string;
  fieldKey: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface WorkerAuditInput {
  category: string;
  fieldKey: string;
  fieldNameAr: string;
  oldValue?: string | null | undefined;
  newValue?: string | null | undefined;
  oldDisplayValue?: string | null | undefined;
  newDisplayValue?: string | null | undefined;
  reason?: string | null | undefined;
  actorTelegramId?: bigint | undefined;
  actorName?: string | null | undefined;
  actorRole?: string | undefined;
}

export interface SalaryAdjustmentData {
  changeId: string;
  workerId: string;
  workerCode: string;
  workerName: string;
  previousBasicSalary: number;
  previousAdditionalSalary: number;
  previousGrossSalary: number;
  newBasicSalary: number;
  newAdditionalSalary: number;
  newGrossSalary: number;
  effectiveMonth: string;
  effectiveDate: Date;
  reason: string;
  approvedByTelegramId?: bigint | undefined;
  approvedByName?: string | null | undefined;
  notes?: string | null | undefined;
}
