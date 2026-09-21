import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { WorkerRegistrationMessages } from '../flow.messages.js';
import { WorkerRegistrationKeyboards } from '../flow.keyboard.js';
import { WorkerWizardStep } from '../flow.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.1 Unit Tests — Worker Registration & Identity Validators', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('correctly parses and validates a 14-digit Egyptian National ID', () => {
    // Arrange
    const rawId = '29001012701234';

    // Act
    const result = validateWorkerIdentification('NATIONAL_ID', rawId);

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.gender).toBe('MALE');
    expect(result.governorateCode).toBe('27');
    expect(result.birthDate).toBeDefined();
    expect(result.age).toBeGreaterThanOrEqual(30);
  });

  it('rejects invalid national id numbers that do not have 14 digits', () => {
    // Arrange
    const shortId = '12345';

    // Act
    const shortResult = validateWorkerIdentification('NATIONAL_ID', shortId);

    // Assert
    expect(shortResult.isValid).toBe(false);
    expect(shortResult.error).toBeDefined();
    expect(shortResult.error).toContain('14');
  });

  it('validates foreign passports when birth date and gender are provided', () => {
    // Arrange
    const passportNumber = 'A12345678';
    const metadata = {
      birthDate: new Date('1995-05-10'),
      gender: 'MALE' as const,
    };

    // Act
    const passportResult = validateWorkerIdentification('PASSPORT', passportNumber, metadata);

    // Assert
    expect(passportResult.isValid).toBe(true);
    expect(passportResult.gender).toBe('MALE');
    expect(passportResult.governorateCode).toBe('88');
    expect(passportResult.governorateNameAr).toContain('وافد');
  });

  it('fails passport validation when birth date is missing', () => {
    // Arrange
    const passportNumber = 'A12345678';
    const metadata = {
      gender: 'MALE' as const,
    };

    // Act
    const missingBirthDate = validateWorkerIdentification('PASSPORT', passportNumber, metadata);

    // Assert
    expect(missingBirthDate.isValid).toBe(false);
    expect(missingBirthDate.error).toContain('تاريخ الميلاد');
  });

  it('validates Egyptian phone numbers and normalizes digits', () => {
    // Arrange
    const rawPhone = '01012345678';
    const invalidRawPhone = '01912345678';

    // Act
    const validPhone = validateWorkerPhoneNumber(rawPhone);
    const invalidPhone = validateWorkerPhoneNumber(invalidRawPhone);

    // Assert
    expect(validPhone.isValid).toBe(true);
    expect(validPhone.normalized).toBe('01012345678');
    expect(invalidPhone.isValid).toBe(false);
  });

  it('validates full names and requires at least two words', () => {
    // Arrange
    const validFullName = 'أحمد محمود علي';
    const singleWordName = 'أحمد';

    // Act
    const validName = validateWorkerFullName(validFullName);
    const singleName = validateWorkerFullName(singleWordName);

    // Assert
    expect(validName.isValid).toBe(true);
    expect(singleName.isValid).toBe(false);
  });

  it('validates flexible hire dates in DD-MM-YYYY format', () => {
    // Arrange
    const validDateStr = '15-09-2026';
    const invalidDateStr = 'invalid-date';

    // Act
    const validDate = validateWorkerHireDate(validDateStr);
    const invalidDate = validateWorkerHireDate(invalidDateStr);

    // Assert
    expect(validDate.isValid).toBe(true);
    expect(validDate.date).toBeInstanceOf(Date);
    expect(invalidDate.isValid).toBe(false);
  });

  it('generates and verifies HMAC-SHA256 worker invitation tokens', () => {
    // Arrange
    const secretKey = 'test-secret-key-for-worker-invite';
    const workerCode = 'OP-DRV-001';

    // Act
    const token = generateWorkerInviteToken(workerCode, secretKey);
    const isValid = verifyWorkerInviteToken(workerCode, token, secretKey);
    const isTampered = verifyWorkerInviteToken(workerCode, 'tampered-token-12', secretKey);

    // Assert
    expect(token).toBeDefined();
    expect(token.length).toBe(16);
    expect(isValid).toBe(true);
    expect(isTampered).toBe(false);
  });

  it('builds a complete welcome WhatsApp link with encoded bot parameters', () => {
    // Arrange
    const mockRepo = new WorkerRegistrationRepository({} as PrismaClient);
    const service = new WorkerRegistrationService(mockRepo);

    // Act
    const link = service.buildWelcomeWhatsAppUrl({
      name: 'محمود حسن علي',
      code: 'OP-DRV-005',
      jobTitle: 'سائق لودر',
      siteName: 'موقع السباعية',
      hireDate: '15-09-2026',
      phone: '01012345678',
    });

    // Assert
    expect(link).toContain('https://api.whatsapp.com/send');
    expect(link).toContain('phone=201012345678');
    expect(link).toContain(encodeURIComponent('OP-DRV-005'));
    expect(link).toContain(encodeURIComponent('نقداً من الموقع الميداني'));
  });

  it('applies front scan and back scan to update draft and aiDetectedData cleanly', () => {
    // Arrange
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

    const backScan = {
      isValid: true,
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_BACK' as const,
      isQualityAcceptable: true,
      expiryDateStr: '2028-11-20',
      address: 'المنصورة حي الجامعة',
      confidenceScore: 0.92,
      rawExtractedText: '...',
    };

    // Act
    const updatedWithFront = service.applyAiFrontScan(initialDraft, frontScan, 'front-file-id-123');
    const updatedWithBack = service.applyAiBackScan(updatedWithFront, backScan, 'back-file-id-456');
    const approvedDraft = service.approveAiDraft(updatedWithBack);

    // Assert
    expect(updatedWithFront.frontPhotoFileId).toBe('front-file-id-123');
    expect(updatedWithFront.name).toBe('أحمد محمود إبراهيم خليل');
    expect(updatedWithFront.nickname).toBe('أحمد محمود');
    expect(updatedWithFront.idNumber).toBe('29205151234567');
    expect(updatedWithFront.gender).toBe('MALE');
    expect(updatedWithFront.governorateCode).toBe('12');
    expect(updatedWithFront.aiDetectedData?.nationalId).toBe('29205151234567');
    expect(updatedWithBack.backPhotoFileId).toBe('back-file-id-456');
    expect(updatedWithBack.expiryDate).toBe('2028-11-20');
    expect(approvedDraft.name).toBe('أحمد محمود إبراهيم خليل');
    expect(approvedDraft.idNumber).toBe('29205151234567');
    expect(approvedDraft.expiryDate).toBe('2028-11-20');
  });

  it('normalizes Arabic/Eastern digits to English digits in AI scan and approval', () => {
    // Arrange
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

    const backScanWithArabicDigits = {
      isValid: true,
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_BACK' as const,
      isQualityAcceptable: true,
      expiryDateStr: '٢٠٣٠-١٠-١٥',
      address: 'الأقصر - إسنا',
      confidenceScore: 0.9,
    };

    // Act
    const updatedWithFront = service.applyAiFrontScan(initialDraft, frontScanWithArabicDigits, 'file-123');
    const updatedWithBack = service.applyAiBackScan(updatedWithFront, backScanWithArabicDigits, 'file-456');
    const approved = service.approveAiDraft({
      ...updatedWithBack,
      phone: '٠١٠١٢٣٤٥٦٧٨',
    });

    // Assert
    expect(updatedWithFront.idNumber).toBe('29001012701234');
    expect(updatedWithFront.governorateCode).toBe('27');
    expect(updatedWithFront.expiryDate).toBe('2029-05-01');
    expect(updatedWithBack.expiryDate).toBe('2030-10-15');
    expect(approved.idNumber).toBe('29001012701234');
    expect(approved.phone).toBe('01012345678');
    expect(approved.expiryDate).toBe('2030-10-15');
  });

  describe('Messages & Keyboards Unit Tests', () => {
    it('includes underage legal warning in aiConfirmationCard and normalizes digits', () => {
      // Arrange
      const underageData = {
        currentStep: WorkerWizardStep.AI_CONFIRMATION,
        idType: 'NATIONAL_ID' as const,
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
      };

      const adultData = {
        currentStep: WorkerWizardStep.AI_CONFIRMATION,
        idType: 'NATIONAL_ID' as const,
        name: 'علي حسن إبراهيم',
        idNumber: '29001012701234',
        birthDate: '1990-01-01',
        aiDetectedData: {
          name: 'علي حسن إبراهيم',
          nationalId: '29001012701234',
          birthDate: '1990-01-01',
          age: 36,
        },
      };

      // Act
      const underageCard = WorkerRegistrationMessages.aiConfirmationCard(underageData);
      const adultCard = WorkerRegistrationMessages.aiConfirmationCard(adultData);

      // Assert
      expect(underageCard).toContain('تنبيه قانوني');
      expect(underageCard).toContain('العامل أصغر من سن العمل القانوني (أقل من 18 سنة)');
      expect(underageCard).toContain('31001012701234');
      expect(underageCard).toContain('(16 سنة)');
      expect(underageCard).not.toContain('٣١٠٠١٠١٢٧٠١٢٣٤');
      expect(adultCard).not.toContain('العامل أصغر من سن العمل القانوني');
    });

    it('includes underage legal warning in confirmationCard and normalizes all digits', () => {
      // Arrange
      const underageState = {
        currentStep: WorkerWizardStep.CONFIRMATION,
        idType: 'NATIONAL_ID' as const,
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
      };

      // Act
      const card = WorkerRegistrationMessages.confirmationCard(underageState);

      // Assert
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

    it('renders aiProcessingPrompt and processingKeyboard correctly', () => {
      // Arrange
      // Act
      const prompt = WorkerRegistrationMessages.aiProcessingPrompt();
      const kb = WorkerRegistrationKeyboards.processingKeyboard();
      const btn = kb.inline_keyboard[0]?.[0];

      // Assert
      expect(prompt).toContain('قراءة وفحص البطاقة بالذكاء الاصطناعي');
      expect(prompt).toContain('جارٍ تنزيل الصورة وتحليل البيانات الرسمية بالذكاء الاصطناعي');
      expect(btn?.text).toContain('جارٍ قراءة وفحص البطاقة بالذكاء الاصطناعي');
      expect(btn && 'callback_data' in btn ? btn.callback_data : '').toBe('wizard:worker:noop');
    });

    it('normalizes digits in aiEditIdPrompt and aiEditExpiryPrompt', () => {
      // Arrange
      const rawId = '٢٩٠٠١٠١٢٧٠١٢٣٤';
      const rawExp = '٢٠٢٨-٠٥-٢٦';

      // Act
      const idPrompt = WorkerRegistrationMessages.aiEditIdPrompt(rawId, false);
      const expPrompt = WorkerRegistrationMessages.aiEditExpiryPrompt(rawExp);

      // Assert
      expect(idPrompt).toContain('29001012701234');
      expect(idPrompt).not.toContain('٢٩٠٠١٠١٢٧٠١٢٣٤');
      expect(expPrompt).toContain('2028-05-26');
      expect(expPrompt).not.toContain('٢٠٢٨-٠٥-٢٦');
    });

    it('correctly detects underage worker for passport holders with non-ISO and Arabic digit birth dates', () => {
      // Arrange
      const cardDMYState = {
        currentStep: WorkerWizardStep.CONFIRMATION,
        idType: 'PASSPORT' as const,
        name: 'John Doe',
        idNumber: 'A12345678',
        phone: '01012345678',
        birthDate: '15-05-2010',
      };

      const cardArabicState = {
        currentStep: WorkerWizardStep.CONFIRMATION,
        idType: 'PASSPORT' as const,
        name: 'Ali Khan',
        idNumber: 'P98765432',
        phone: '01122334455',
        birthDate: '١٥-٠٥-٢٠١٠',
      };

      // Act
      const cardDMY = WorkerRegistrationMessages.confirmationCard(cardDMYState);
      const cardArabic = WorkerRegistrationMessages.confirmationCard(cardArabicState);

      // Assert
      expect(cardDMY).toContain('تنبيه قانوني');
      expect(cardDMY).toContain('العامل أصغر من سن العمل القانوني (أقل من 18 سنة)');
      expect(cardArabic).toContain('تنبيه قانوني');
      expect(cardArabic).toContain('العامل أصغر من سن العمل القانوني (أقل من 18 سنة)');
    });

    it('normalizes digits in payoutTransferChoicePrompt and payoutMethodPrompt', () => {
      // Arrange
      const rawPhone1 = '٠١٠١٢٣٤٥٦٧٨';
      const rawPhone2 = '٠١٠٩٩٨٨٧٧٦٦';

      // Act
      const trPrompt = WorkerRegistrationMessages.payoutTransferChoicePrompt(rawPhone1);
      const poPrompt = WorkerRegistrationMessages.payoutMethodPrompt(rawPhone2);

      // Assert
      expect(trPrompt).toContain('01012345678');
      expect(trPrompt).not.toContain('٠١٠١٢٣٤٥٦٧٨');
      expect(poPrompt).toContain('01099887766');
      expect(poPrompt).not.toContain('٠١٠٩٩٨٨٧٧٦٦');
    });
  });
});
