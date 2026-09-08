export enum WorkerWizardStep {
  DOC_TYPE = 'DOC_TYPE',
  PHOTO_FRONT = 'PHOTO_FRONT',
  PHOTO_BACK = 'PHOTO_BACK',
  AI_CONFIRMATION = 'AI_CONFIRMATION',
  AI_EDIT_NAME = 'AI_EDIT_NAME',
  AI_EDIT_ID = 'AI_EDIT_ID',
  AI_EDIT_GOVERNORATE = 'AI_EDIT_GOVERNORATE',
  AI_EDIT_EXPIRY = 'AI_EDIT_EXPIRY',
  AI_EDIT_ADDRESS = 'AI_EDIT_ADDRESS',
  FULL_NAME = 'FULL_NAME',
  ID_NUMBER = 'ID_NUMBER',
  PASSPORT_NATIONALITY = 'PASSPORT_NATIONALITY',
  PASSPORT_BIRTHDATE = 'PASSPORT_BIRTHDATE',
  PASSPORT_GENDER = 'PASSPORT_GENDER',
  MANUAL_EXPIRY = 'MANUAL_EXPIRY',
  NICKNAME = 'NICKNAME',
  PHONE = 'PHONE',
  PAYOUT_TRANSFER_CHOICE = 'PAYOUT_TRANSFER_CHOICE',
  CUSTOM_WALLET_INPUT = 'CUSTOM_WALLET_INPUT',
  PAYOUT_METHOD_CHOICE = 'PAYOUT_METHOD_CHOICE',
  JOB_CHOICE = 'JOB_CHOICE',
  CUSTOM_JOB_INPUT = 'CUSTOM_JOB_INPUT',
  SITE_CHOICE = 'SITE_CHOICE',
  START_DATE_CHOICE = 'START_DATE_CHOICE',
  CUSTOM_START_DATE_INPUT = 'CUSTOM_START_DATE_INPUT',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  MILITARY_STATUS = 'MILITARY_STATUS',
  EMERGENCY_PHONE = 'EMERGENCY_PHONE',
  INSURANCE_STATUS = 'INSURANCE_STATUS',
  MARITAL_STATUS = 'MARITAL_STATUS',
  CONFIRMATION = 'CONFIRMATION',
}

export interface CreateWorkerInput {
  name: string;
  nickname?: string;
  legacyCode?: string;
  idType: 'NATIONAL_ID' | 'PASSPORT';
  idNumber: string;
  nationality?: string;
  birthDate?: Date;
  gender?: 'MALE' | 'FEMALE';
  governorateCode?: string;
  phone: string;
  jobTitleId?: string;
  jobTitleName: string;
  departmentId?: string;
  siteId?: string;
  siteName?: string;
  hireDate?: Date;
  shiftSystem?: string;
  dailyWage?: number;
  basicSalary?: number;
  fixedAllowances?: number;
  paymentMethod?: string;
  accountNumber?: string;
  walletType?: string;
  emergencyContactName?: string;
  emergencyPhone?: string;
  drivingLicense?: string;
  militaryStatus?: string;
  maritalStatus?: string;
  previousInsuranceStatus?: string;
  idCardFrontPath?: string;
  idCardBackPath?: string;
  idCardExpiryDate?: Date;
  address?: string;
  notes?: string;
}

export interface WorkerValidationResult {
  isValid: boolean;
  error?: string;
  birthDate?: Date;
  age?: number;
  gender?: 'MALE' | 'FEMALE';
  genderArabic?: string;
  governorateCode?: string;
  governorateNameAr?: string;
}

export interface PendingWorkerWizardState {
  currentStep: WorkerWizardStep;
  idType?: 'NATIONAL_ID' | 'PASSPORT';
  frontPhotoFileId?: string;
  backPhotoFileId?: string;
  frontPhotoPath?: string;
  backPhotoPath?: string;
  aiDetectedData?: {
    nationalId?: string;
    passportNumber?: string;
    name?: string;
    birthDate?: string;
    gender?: 'MALE' | 'FEMALE';
    governorateName?: string;
    governorateCode?: string;
    expiryDate?: string;
    address?: string;
  };
  name?: string;
  nickname?: string;
  legacyCode?: string;
  idNumber?: string;
  nationality?: string;
  birthDate?: string;
  gender?: 'MALE' | 'FEMALE';
  governorateCode?: string;
  expiryDate?: string;
  address?: string;
  phone?: string;
  paymentMethod?: string;
  accountNumber?: string;
  walletType?: string;
  jobTitleId?: string;
  jobTitleName?: string;
  siteId?: string;
  siteName?: string;
  hireDate?: string;
  shiftSystem?: string;
  dailyWage?: number;
  drivingLicense?: string;
  militaryStatus?: string;
  emergencyPhone?: string;
  insuranceStatus?: string;
  maritalStatus?: string;
  activeMessageId?: number;
  chatId?: number;
  previousSteps?: WorkerWizardStep[];
}

export interface RegisteredWorkerResult {
  id: string;
  code: string;
  name: string;
  nickname?: string;
  jobTitle: string;
  siteName?: string;
  hireDate: Date;
  shiftSystem?: string;
  welcomeWhatsAppUrl: string;
}

export interface WorkerDuplicateCheckResult {
  isDuplicate: boolean;
  existingWorker?: {
    code: string;
    name: string;
    jobTitle: string;
    siteName?: string;
  } | null;
}

export interface WorkerLookupOption {
  id: string;
  code: string;
  name: string;
}

export interface JobTitleLookupOption extends WorkerLookupOption {
  departmentCode: string;
}

export interface WorkerWizardStateStore {
  get(telegramId: bigint): Promise<PendingWorkerWizardState | null>;
  set(telegramId: bigint, state: PendingWorkerWizardState, ttlSeconds?: number): Promise<void>;
  delete(telegramId: bigint): Promise<void>;
}

export interface AiVisionScanResult {
  isValid: boolean;
  detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT' | 'EGYPTIAN_NATIONAL_ID_BACK' | 'PASSPORT' | 'OTHER';
  isQualityAcceptable: boolean;
  nationalIdNumber?: string;
  passportNumber?: string;
  expiryDateStr?: string;
  fullName?: string;
  address?: string;
  birthDate?: Date;
  gender?: 'MALE' | 'FEMALE';
  governorateNameAr?: string;
  userErrorMessage?: string;
}

export interface AiVisionScanner {
  scanDocument(
    imageBuffer: Buffer,
    mimeType: string,
    expectedType: 'NATIONAL_ID_FRONT' | 'NATIONAL_ID_BACK' | 'PASSPORT'
  ): Promise<AiVisionScanResult>;
}
