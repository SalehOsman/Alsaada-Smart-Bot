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
  nickname?: string | undefined;
  legacyCode?: string | undefined;
  idType: 'NATIONAL_ID' | 'PASSPORT';
  idNumber: string;
  nationality?: string | undefined;
  birthDate?: Date | undefined;
  gender?: 'MALE' | 'FEMALE' | undefined;
  governorateCode?: string | undefined;
  phone: string;
  jobTitleId?: string | undefined;
  jobTitleName?: string | undefined;
  departmentId?: string | undefined;
  siteId?: string | undefined;
  siteName?: string | undefined;
  hireDate?: Date | undefined;
  shiftSystem?: string | undefined;
  dailyWage?: number | undefined;
  basicSalary?: number | undefined;
  fixedAllowances?: number | undefined;
  paymentMethod?: string | undefined;
  accountNumber?: string | undefined;
  walletType?: string | undefined;
  walletNumber?: string | undefined;
  emergencyContactName?: string | undefined;
  emergencyPhone?: string | undefined;
  drivingLicense?: string | undefined;
  militaryStatus?: string | undefined;
  maritalStatus?: string | undefined;
  previousInsuranceStatus?: string | undefined;
  idCardFrontPath?: string | undefined;
  idCardBackPath?: string | undefined;
  idCardExpiryDate?: Date | undefined;
  address?: string | undefined;
  notes?: string | undefined;
}

export interface WorkerValidationResult {
  isValid: boolean;
  error?: string | undefined;
  birthDate?: Date | undefined;
  age?: number | undefined;
  gender?: 'MALE' | 'FEMALE' | undefined;
  genderArabic?: string | undefined;
  governorateCode?: string | undefined;
  governorateNameAr?: string | undefined;
}

export interface PendingWorkerWizardState {
  currentStep: WorkerWizardStep;
  idType?: 'NATIONAL_ID' | 'PASSPORT' | undefined;
  frontPhotoFileId?: string | undefined;
  backPhotoFileId?: string | undefined;
  frontPhotoPath?: string | undefined;
  backPhotoPath?: string | undefined;
  aiDetectedData?: {
    nationalId?: string | undefined;
    passportNumber?: string | undefined;
    name?: string | undefined;
    birthDate?: string | undefined;
    gender?: 'MALE' | 'FEMALE' | undefined;
    governorateName?: string | undefined;
    governorateCode?: string | undefined;
    expiryDate?: string | undefined;
    address?: string | undefined;
  } | undefined;
  name?: string | undefined;
  nickname?: string | undefined;
  legacyCode?: string | undefined;
  idNumber?: string | undefined;
  nationality?: string | undefined;
  birthDate?: string | undefined;
  gender?: 'MALE' | 'FEMALE' | undefined;
  governorateCode?: string | undefined;
  expiryDate?: string | undefined;
  address?: string | undefined;
  phone?: string | undefined;
  paymentMethod?: string | undefined;
  accountNumber?: string | undefined;
  walletType?: string | undefined;
  jobTitleId?: string | undefined;
  jobTitleName?: string | undefined;
  siteId?: string | undefined;
  siteName?: string | undefined;
  hireDate?: string | undefined;
  shiftSystem?: string | undefined;
  dailyWage?: number | undefined;
  drivingLicense?: string | undefined;
  militaryStatus?: string | undefined;
  emergencyPhone?: string | undefined;
  insuranceStatus?: string | undefined;
  maritalStatus?: string | undefined;
  activeMessageId?: number | undefined;
  chatId?: number | undefined;
  previousSteps?: WorkerWizardStep[] | undefined;
}

export interface RegisteredWorkerResult {
  id: string;
  code: string;
  name: string;
  nickname?: string | undefined;
  jobTitle: string;
  siteName?: string | undefined;
  hireDate: Date;
  shiftSystem?: string | undefined;
  welcomeWhatsAppUrl: string;
}

export interface WorkerDuplicateCheckResult {
  isDuplicate: boolean;
  existingWorker?: {
    code: string;
    name: string;
    jobTitle: string;
    siteName?: string | undefined;
  } | null | undefined;
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
  nationalIdNumber?: string | undefined;
  passportNumber?: string | undefined;
  expiryDateStr?: string | undefined;
  fullName?: string | undefined;
  address?: string | undefined;
  birthDate?: Date | undefined;
  gender?: 'MALE' | 'FEMALE' | undefined;
  governorateNameAr?: string | undefined;
  userErrorMessage?: string | undefined;
}

export interface AiVisionScanner {
  scanDocument(
    imageBuffer: Buffer,
    mimeType: string,
    expectedType: 'NATIONAL_ID_FRONT' | 'NATIONAL_ID_BACK' | 'PASSPORT'
  ): Promise<AiVisionScanResult>;
}
