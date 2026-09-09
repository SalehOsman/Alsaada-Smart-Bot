export type WorkerProfileTab = 'PERSONAL' | 'JOB' | 'FINANCE' | 'DOCS';

export type EditableWorkerField =
  // Personal & ID
  | 'legacyCode'
  | 'name'
  | 'nickname'
  | 'governorateCode'
  | 'address'
  | 'idCardExpiryDate'
  | 'bloodType'
  | 'militaryStatus'
  | 'maritalStatus'
  // Job & Operations
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
  bloodType?: string | null;
  jobTitle?: string | null;
  jobRef?: { title?: string | null } | null;
  site?: { name?: string | null } | null;
  department?: { name?: string | null } | null;
  shiftSystem?: string | null;
  contractType?: string | null;
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
  phoneEncrypted?: string | null;
  emergencyPhoneEncrypted?: string | null;
  emergencyContactName?: string | null;
  ppeShoeSize?: string | null;
  ppeUniformSize?: string | null;
  medicalNotes?: string | null;
}

