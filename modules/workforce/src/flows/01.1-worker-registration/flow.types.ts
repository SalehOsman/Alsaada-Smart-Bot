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
  contractType?: string | undefined;
  dailyWage?: number | undefined;
  basicSalary?: number | undefined;
  additionalSalary?: number | undefined;
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
  frontPhotoBuffer?: Buffer | undefined;
  backPhotoBuffer?: Buffer | undefined;
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
  frontPhotoBase64?: string | undefined;
  backPhotoBase64?: string | undefined;
  aiDetectedData?: {
    nationalId?: string | undefined;
    passportNumber?: string | undefined;
    name?: string | undefined;
    birthDate?: string | undefined;
    age?: number | undefined;
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
  walletNumber?: string | undefined;
  walletWarning?: string | undefined;
  jobTitleId?: string | undefined;
  jobTitleName?: string | undefined;
  siteId?: string | undefined;
  siteName?: string | undefined;
  hireDate?: string | undefined;
  shiftSystem?: string | undefined;
  contractType?: string | undefined;
  dailyWage?: number | undefined;
  basicSalary?: number | undefined;
  additionalSalary?: number | undefined;
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
  companyName?: string | undefined;
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
  baseSalary?: number | undefined;
  additionalSalary?: number | undefined;
  workDays?: number | undefined;
  restDays?: number | undefined;
  shiftNature?: string | undefined;
}

export interface WorkerWizardStateStore {
  get(telegramId: bigint): Promise<PendingWorkerWizardState | null>;
  set(telegramId: bigint, state: PendingWorkerWizardState, ttlSeconds?: number): Promise<void>;
  delete(telegramId: bigint): Promise<void>;
}

export type { AiVisionScanResult } from '@alsaada/ai-vision-engine';

export interface AiVisionScanner {
  scanDocument(
    imageBuffer: Buffer,
    mimeType: string,
    expectedType: 'NATIONAL_ID_FRONT' | 'NATIONAL_ID_BACK' | 'PASSPORT'
  ): Promise<import('@alsaada/ai-vision-engine').AiVisionScanResult>;
}

export const DRIVING_LICENSE_MAP: Record<string, string> = {
  none: 'لا توجد رخصة قيادة',
  pvt: 'رخصة خاصة',
  '1st': 'مهنية درجة أولى',
  '2nd': 'مهنية درجة ثانية',
  '3rd': 'مهنية درجة ثالثة',
  heavy: 'رخصة تشغيل معدات ثقيلة',
  skip: 'لا توجد رخصة قيادة',
};

export const MILITARY_STATUS_MAP: Record<string, string> = {
  served: 'أدى الخدمة العسكرية (قدوة حسنة)',
  final_exempt: 'إعفاء نهائي',
  temp_exempt: 'إعفاء مؤقت',
  postponed: 'تأجيل دراسي',
  not_req: 'غير مطلوب / معافى طبياً',
  not_applied: 'لم يتم التقدم للخدمة العسكرية',
  skip: 'غير محدد / معافى',
};

export const INSURANCE_STATUS_MAP: Record<string, string> = {
  uninsured: 'غير مؤمن عليه بجهة أخرى',
  previously_insured: 'مؤمن عليه بجهة سابقة',
  fulltime_no_insurance: 'متفرغ تماماً وبدون تأمين',
  skip: 'غير مؤمن عليه بجهة أخرى',
};

export const MARITAL_STATUS_MAP: Record<string, string> = {
  single: 'أعزب',
  married: 'متزوج',
  married_children: 'متزوج ويعول',
  divorced: 'مطلق',
  widowed: 'أرمل',
  skip: 'أعزب',
};

export const PAYOUT_METHOD_MAP: Record<string, { type: string; label: string; method: string }> = {
  CASH_SITE: { type: 'نقدي / كاش', label: 'استلام نقدي بالخزينة / الموقع', method: 'CASH_SITE' },
  VODAFONE_CASH: { type: 'محفظة إلكترونية', label: 'محفظة فودافون كاش', method: 'VODAFONE_CASH' },
  INSTAPAY: { type: 'تحويل بنكي / إنستاباي', label: 'إنستاباي (InstaPay)', method: 'INSTAPAY' },
  BANK_TRANSFER: { type: 'تحويل بنكي رسمي', label: 'تحويل بنكي رسمي', method: 'BANK_TRANSFER' },
};

