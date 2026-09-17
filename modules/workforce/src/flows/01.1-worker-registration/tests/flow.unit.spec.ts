import { describe, it, expect } from 'vitest';
import {
  validateWorkerIdentification,
  validateWorkerPhoneNumber,
  validateWorkerFullName,
  validateWorkerHireDate,
} from '../flow.validators.js';
import {
  generateWorkerInviteToken,
  verifyWorkerInviteToken,
  WorkerRegistrationService,
} from '../flow.service.js';
import { WorkerRegistrationRepository } from '../flow.repository.js';
import { WorkerWizardStep } from '../flow.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.1 Unit Tests — Worker Registration & Identity Validators', () => {
  it('should correctly parse and validate a 14-digit Egyptian National ID', () => {
    // 29001012701234 -> Born 1990-01-01, Luxor (27), Male (odd digit)
    const result = validateWorkerIdentification('NATIONAL_ID', '29001012701234');
    expect(result.isValid).toBe(true);
    expect(result.gender).toBe('MALE');
    expect(result.governorateCode).toBe('27');
    expect(result.birthDate).toBeDefined();
    expect(result.age).toBeGreaterThanOrEqual(30);
  });

  it('should reject invalid national id numbers that do not have 14 digits', () => {
    const shortResult = validateWorkerIdentification('NATIONAL_ID', '12345');
    expect(shortResult.isValid).toBe(false);
    expect(shortResult.error).toBeDefined();
  });

  it('should validate foreign passports when birth date and gender are provided', () => {
    const passportResult = validateWorkerIdentification('PASSPORT', 'A12345678', {
      birthDate: new Date('1995-05-10'),
      gender: 'MALE',
    });
    expect(passportResult.isValid).toBe(true);
    expect(passportResult.gender).toBe('MALE');
    expect(passportResult.governorateCode).toBe('88');
    expect(passportResult.governorateNameAr).toContain('وافد');
  });

  it('should fail passport validation when birth date is missing', () => {
    const missingBirthDate = validateWorkerIdentification('PASSPORT', 'A12345678', {
      gender: 'MALE',
    });
    expect(missingBirthDate.isValid).toBe(false);
    expect(missingBirthDate.error).toContain('تاريخ الميلاد');
  });

  it('should validate Egyptian phone numbers and normalize digits', () => {
    const validPhone = validateWorkerPhoneNumber('01012345678');
    expect(validPhone.isValid).toBe(true);
    expect(validPhone.normalized).toBe('01012345678');

    const invalidPhone = validateWorkerPhoneNumber('01912345678');
    expect(invalidPhone.isValid).toBe(false);
  });

  it('should validate full names and require at least two words', () => {
    const validName = validateWorkerFullName('أحمد محمود علي');
    expect(validName.isValid).toBe(true);

    const singleName = validateWorkerFullName('أحمد');
    expect(singleName.isValid).toBe(false);
  });

  it('should validate flexible hire dates in DD-MM-YYYY format', () => {
    const validDate = validateWorkerHireDate('15-09-2026');
    expect(validDate.isValid).toBe(true);
    expect(validDate.date).toBeInstanceOf(Date);

    const invalidDate = validateWorkerHireDate('invalid-date');
    expect(invalidDate.isValid).toBe(false);
  });

  it('should generate and verify HMAC-SHA256 worker invitation tokens', () => {
    const secretKey = 'test-secret-key-for-worker-invite';
    const workerCode = 'OP-DRV-001';

    const token = generateWorkerInviteToken(workerCode, secretKey);
    expect(token).toBeDefined();
    expect(token.length).toBe(16);

    const isValid = verifyWorkerInviteToken(workerCode, token, secretKey);
    expect(isValid).toBe(true);

    const isTampered = verifyWorkerInviteToken(workerCode, 'tampered-token-12', secretKey);
    expect(isTampered).toBe(false);
  });

  it('should build a complete welcome WhatsApp link with encoded bot parameters', () => {
    const mockRepo = new WorkerRegistrationRepository({} as PrismaClient);
    const service = new WorkerRegistrationService(mockRepo);

    const link = service.buildWelcomeWhatsAppUrl({
      name: 'محمود حسن علي',
      code: 'OP-DRV-005',
      jobTitle: 'سائق لودر',
      siteName: 'موقع السباعية',
      hireDate: '15-09-2026',
      phone: '01012345678',
    });

    expect(link).toContain('https://api.whatsapp.com/send');
    expect(link).toContain('phone=201012345678');
    expect(link).toContain(encodeURIComponent('OP-DRV-005'));
    expect(link).toContain(encodeURIComponent('نقداً من الموقع الميداني'));
  });

  it('should apply front scan and back scan to update draft and aiDetectedData cleanly', () => {
    const mockRepo = new WorkerRegistrationRepository({} as PrismaClient);
    const service = new WorkerRegistrationService(mockRepo);

    const initialDraft = {
      currentStep: WorkerWizardStep.PHOTO_FRONT,
      idType: 'NATIONAL_ID' as const,
    };

    const frontScan = {
      isValid: true,
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT' as const,
      isQualityAcceptable: true,
      nationalIdNumber: '29205151234567',
      fullName: 'أحمد محمود إبراهيم خليل',
      birthDate: new Date('1992-05-15'),
      age: 34,
      gender: 'MALE' as const,
      governorateCode: '12',
      governorateNameAr: 'الدقهلية',
      address: 'المنصورة شارع الجمهورية',
      confidenceScore: 0.95,
      rawExtractedText: 'جمهورية مصر العربية...',
    };

    const updatedWithFront = service.applyAiFrontScan(initialDraft, frontScan, 'front-file-id-123');

    expect(updatedWithFront.frontPhotoFileId).toBe('front-file-id-123');
    expect(updatedWithFront.name).toBe('أحمد محمود إبراهيم خليل');
    expect(updatedWithFront.nickname).toBe('أحمد محمود');
    expect(updatedWithFront.idNumber).toBe('29205151234567');
    expect(updatedWithFront.gender).toBe('MALE');
    expect(updatedWithFront.governorateCode).toBe('12');
    expect(updatedWithFront.aiDetectedData?.name).toBe('أحمد محمود إبراهيم خليل');
    expect(updatedWithFront.aiDetectedData?.nationalId).toBe('29205151234567');
    expect(updatedWithFront.aiDetectedData?.age).toBe(34);

    const backScan = {
      isValid: true,
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_BACK' as const,
      isQualityAcceptable: true,
      expiryDateStr: '2028-11-20',
      address: 'المنصورة حي الجامعة',
      confidenceScore: 0.92,
      rawExtractedText: '...',
    };

    const updatedWithBack = service.applyAiBackScan(updatedWithFront, backScan, 'back-file-id-456');

    expect(updatedWithBack.backPhotoFileId).toBe('back-file-id-456');
    expect(updatedWithBack.expiryDate).toBe('2028-11-20');
    expect(updatedWithBack.address).toBe('المنصورة حي الجامعة');
    expect(updatedWithBack.aiDetectedData?.expiryDate).toBe('2028-11-20');

    const approvedDraft = service.approveAiDraft(updatedWithBack);

    expect(approvedDraft.name).toBe('أحمد محمود إبراهيم خليل');
    expect(approvedDraft.nickname).toBe('أحمد محمود');
    expect(approvedDraft.idNumber).toBe('29205151234567');
    expect(approvedDraft.gender).toBe('MALE');
    expect(approvedDraft.governorateCode).toBe('12');
    expect(approvedDraft.expiryDate).toBe('2028-11-20');
    expect(approvedDraft.address).toBe('المنصورة حي الجامعة');
  });

  it('should normalize Arabic/Eastern digits to English digits in AI scan and approval', () => {
    const mockRepo = new WorkerRegistrationRepository({} as PrismaClient);
    const service = new WorkerRegistrationService(mockRepo);

    const initialDraft = {
      currentStep: WorkerWizardStep.PHOTO_FRONT,
      idType: 'NATIONAL_ID' as const,
    };

    const frontScanWithArabicDigits = {
      isValid: true,
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT' as const,
      isQualityAcceptable: true,
      nationalIdNumber: '٢٩٠٠١٠١٢٧٠١٢٣٤',
      fullName: 'محمود عبد الرحيم علي',
      birthDate: new Date('1990-01-01'),
      age: 36,
      gender: 'MALE' as const,
      governorateCode: '٢٧',
      governorateNameAr: 'الأقصر',
      address: 'الأقصر',
      confidenceScore: 0.95,
      expiryDateStr: '٢٠٢٩-٠٥-٠١',
    };

    const updatedWithFront = service.applyAiFrontScan(initialDraft, frontScanWithArabicDigits, 'file-123');
    expect(updatedWithFront.idNumber).toBe('29001012701234');
    expect(updatedWithFront.governorateCode).toBe('27');
    expect(updatedWithFront.expiryDate).toBe('2029-05-01');
    expect(updatedWithFront.aiDetectedData?.nationalId).toBe('29001012701234');

    const backScanWithArabicDigits = {
      isValid: true,
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_BACK' as const,
      isQualityAcceptable: true,
      expiryDateStr: '٢٠٣٠-١٠-١٥',
      address: 'الأقصر - إسنا',
      confidenceScore: 0.9,
    };

    const updatedWithBack = service.applyAiBackScan(updatedWithFront, backScanWithArabicDigits, 'file-456');
    expect(updatedWithBack.expiryDate).toBe('2030-10-15');
    expect(updatedWithBack.aiDetectedData?.expiryDate).toBe('2030-10-15');

    const approved = service.approveAiDraft({
      ...updatedWithBack,
      phone: '٠١٠١٢٣٤٥٦٧٨',
    });
    expect(approved.idNumber).toBe('29001012701234');
    expect(approved.phone).toBe('01012345678');
    expect(approved.expiryDate).toBe('2030-10-15');
  });

  describe('Messages & Keyboards Unit Tests', () => {
    it('should include underage legal warning in aiConfirmationCard and normalize digits', async () => {
      const { WorkerRegistrationMessages } = await import('../flow.messages.js');

      // Underage worker: born in 2010 (16 years old in 2026)
      const underageCard = WorkerRegistrationMessages.aiConfirmationCard({
        currentStep: WorkerWizardStep.AI_CONFIRMATION,
        idType: 'NATIONAL_ID',
        name: 'حسن محمد أحمد',
        idNumber: '31001012701234',
        birthDate: '2010-01-01',
        aiDetectedData: {
          name: 'حسن محمد أحمد',
          nationalId: '31001012701234',
          birthDate: '2010-01-01',
          age: 16,
          expiryDate: '2028-05-26',
        },
      });

      expect(underageCard).toContain('تنبيه قانوني');
      expect(underageCard).toContain('العامل أصغر من سن العمل القانوني (أقل من 18 سنة)');
      expect(underageCard).toContain('31001012701234');
      expect(underageCard).toContain('(16 سنة)');
      expect(underageCard).not.toContain('٣١٠٠١٠١٢٧٠١٢٣٤');

      // Adult worker: born in 1990 (36 years old)
      const adultCard = WorkerRegistrationMessages.aiConfirmationCard({
        currentStep: WorkerWizardStep.AI_CONFIRMATION,
        idType: 'NATIONAL_ID',
        name: 'علي حسن إبراهيم',
        idNumber: '29001012701234',
        birthDate: '1990-01-01',
        aiDetectedData: {
          name: 'علي حسن إبراهيم',
          nationalId: '29001012701234',
          birthDate: '1990-01-01',
          age: 36,
        },
      });

      expect(adultCard).not.toContain('العامل أصغر من سن العمل القانوني');
    });

    it('should include underage legal warning in confirmationCard and normalize all digits', async () => {
      const { WorkerRegistrationMessages } = await import('../flow.messages.js');

      // Underage worker
      const card = WorkerRegistrationMessages.confirmationCard({
        currentStep: WorkerWizardStep.CONFIRMATION,
        idType: 'NATIONAL_ID',
        name: 'يوسف رجب عبد الله',
        nickname: 'يوسف رجب',
        idNumber: '٣١٠٠١٠١٢٧٠١٢٣٤',
        phone: '٠١٠١٢٣٤٥٦٧٨',
        birthDate: '2010-05-15',
        hireDate: '٢٠٢٦-٠٩-٠١',
        shiftSystem: '٢٠ يوم عمل / ١٠ راحة',
        accountNumber: '٠١٠٩٩٨٨٧٧٦٦',
        emergencyPhone: '٠١١٢٢٣٣٤٤٥٥',
        basicSalary: 6000,
        additionalSalary: 1500,
        paymentMethod: 'VODAFONE_CASH',
        jobTitleName: 'عامل عادي',
        siteName: 'موقع السباعية',
      });

      expect(card).toContain('تنبيه قانوني');
      expect(card).toContain('العامل أصغر من سن العمل القانوني (أقل من 18 سنة)');
      expect(card).toContain('31001012701234');
      expect(card).toContain('01012345678');
      expect(card).toContain('2026-09-01');
      expect(card).toContain('20 يوم عمل / 10 راحة');
      expect(card).toContain('01099887766');
      expect(card).toContain('01122334455');
      expect(card).not.toContain('٣١٠٠١٠١٢٧٠١٢٣٤');
      expect(card).not.toContain('٠١٠١٢٣٤٥٦٧٨');
    });

    it('should render aiProcessingPrompt and processingKeyboard correctly', async () => {
      const { WorkerRegistrationMessages } = await import('../flow.messages.js');
      const { WorkerRegistrationKeyboards } = await import('../flow.keyboard.js');

      const prompt = WorkerRegistrationMessages.aiProcessingPrompt();
      expect(prompt).toContain('قراءة وفحص البطاقة بالذكاء الاصطناعي');
      expect(prompt).toContain('جارٍ تنزيل الصورة وتحليل البيانات الرسمية بالذكاء الاصطناعي');

      const kb = WorkerRegistrationKeyboards.processingKeyboard();
      const btn = kb.inline_keyboard[0]?.[0];
      expect(btn?.text).toContain('جارٍ قراءة وفحص البطاقة بالذكاء الاصطناعي');
      expect(btn && 'callback_data' in btn ? btn.callback_data : '').toBe('wizard:worker:noop');
    });

    it('should normalize digits in aiEditIdPrompt and aiEditExpiryPrompt', async () => {
      const { WorkerRegistrationMessages } = await import('../flow.messages.js');

      const idPrompt = WorkerRegistrationMessages.aiEditIdPrompt('٢٩٠٠١٠١٢٧٠١٢٣٤', false);
      expect(idPrompt).toContain('29001012701234');
      expect(idPrompt).not.toContain('٢٩٠٠١٠١٢٧٠١٢٣٤');

      const expPrompt = WorkerRegistrationMessages.aiEditExpiryPrompt('٢٠٢٨-٠٥-٢٦');
      expect(expPrompt).toContain('2028-05-26');
      expect(expPrompt).not.toContain('٢٠٢٨-٠٥-٢٦');
    });

    it('should correctly detect underage worker for passport holders with non-ISO (DD-MM-YYYY) and Arabic digit birth dates', async () => {
      const { WorkerRegistrationMessages } = await import('../flow.messages.js');

      // Passport holder with DD-MM-YYYY birth date
      const cardDMY = WorkerRegistrationMessages.confirmationCard({
        currentStep: WorkerWizardStep.CONFIRMATION,
        idType: 'PASSPORT',
        name: 'John Doe',
        idNumber: 'A12345678',
        phone: '01012345678',
        birthDate: '15-05-2010',
      });
      expect(cardDMY).toContain('تنبيه قانوني');
      expect(cardDMY).toContain('العامل أصغر من سن العمل القانوني (أقل من 18 سنة)');

      // Passport holder with Arabic digits in birth date: ١٥-٠٥-٢٠١٠
      const cardArabic = WorkerRegistrationMessages.confirmationCard({
        currentStep: WorkerWizardStep.CONFIRMATION,
        idType: 'PASSPORT',
        name: 'Ali Khan',
        idNumber: 'P98765432',
        phone: '01122334455',
        birthDate: '١٥-٠٥-٢٠١٠',
      });
      expect(cardArabic).toContain('تنبيه قانوني');
      expect(cardArabic).toContain('العامل أصغر من سن العمل القانوني (أقل من 18 سنة)');
    });

    it('should normalize digits in payoutTransferChoicePrompt and payoutMethodPrompt', async () => {
      const { WorkerRegistrationMessages } = await import('../flow.messages.js');

      const trPrompt = WorkerRegistrationMessages.payoutTransferChoicePrompt('٠١٠١٢٣٤٥٦٧٨');
      expect(trPrompt).toContain('01012345678');
      expect(trPrompt).not.toContain('٠١٠١٢٣٤٥٦٧٨');

      const poPrompt = WorkerRegistrationMessages.payoutMethodPrompt('٠١٠٩٩٨٨٧٧٦٦');
      expect(poPrompt).toContain('01099887766');
      expect(poPrompt).not.toContain('٠١٠٩٩٨٨٧٧٦٦');
    });
  });
});
