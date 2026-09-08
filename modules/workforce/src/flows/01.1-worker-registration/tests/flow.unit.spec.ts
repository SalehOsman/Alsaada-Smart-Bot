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
  });
});
