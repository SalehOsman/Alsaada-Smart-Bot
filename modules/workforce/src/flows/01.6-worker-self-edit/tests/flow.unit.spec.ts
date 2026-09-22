import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerSelfEditService } from '../flow.service.js';
import { WorkerSelfEditRepository } from '../flow.repository.js';
import {
  validateWorkerSelfEditField,
  isForbiddenFinancialField,
  validateFieldValue,
} from '../flow.validators.js';

describe('01.6 Worker Self-Edit — Unit Tests', () => {
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

  it('validates allowed personal fields correctly', () => {
    // Arrange
    const phoneField = 'phone';
    const addressField = 'address';
    const walletField = 'walletType';
    const wageField = 'dailyWage';

    // Act
    const res1 = validateWorkerSelfEditField(phoneField);
    const res2 = validateWorkerSelfEditField(addressField);
    const res3 = validateWorkerSelfEditField(walletField);
    const res4 = validateWorkerSelfEditField(wageField);

    // Assert
    expect(res1).toBe(true);
    expect(res2).toBe(true);
    expect(res3).toBe(true);
    expect(res4).toBe(false);
  });

  it('strictly detects forbidden financial fields', () => {
    // Arrange
    const wage = 'dailyWage';
    const salary = 'basicSalary';
    const allow = 'fixedAllowances';
    const title = 'jobTitle';
    const phone = 'phone';

    // Act
    const isWageForbidden = isForbiddenFinancialField(wage);
    const isBasicSalaryForbidden = isForbiddenFinancialField(salary);
    const isAllowancesForbidden = isForbiddenFinancialField(allow);
    const isJobTitleForbidden = isForbiddenFinancialField(title);
    const isPhoneForbidden = isForbiddenFinancialField(phone);

    // Assert
    expect(isWageForbidden).toBe(true);
    expect(isBasicSalaryForbidden).toBe(true);
    expect(isAllowancesForbidden).toBe(true);
    expect(isJobTitleForbidden).toBe(true);
    expect(isPhoneForbidden).toBe(false);
  });

  it('validates and sanitizes phone numbers', () => {
    // Arrange
    const validRaw = '01012345678';
    const invalidRaw = '12345';

    // Act
    const valid = validateFieldValue('phone', validRaw);
    const invalid = validateFieldValue('phone', invalidRaw);

    // Assert
    expect(valid.isValid).toBe(true);
    expect(valid.sanitizedValue).toBe('01012345678');
    expect(invalid.isValid).toBe(false);
    expect(invalid.error).toContain('رقم مصري ساري');
    expect(invalid.sanitizedValue).toBeUndefined();
  });

  it('validates PPE shoe sizes properly', () => {
    // Arrange
    const validRaw = '43';
    const invalidRaw = '20';

    // Act
    const valid = validateFieldValue('ppeShoeSize', validRaw);
    const invalid = validateFieldValue('ppeShoeSize', invalidRaw);

    // Assert
    expect(valid.isValid).toBe(true);
    expect(valid.sanitizedValue).toBe('43');
    expect(invalid.isValid).toBe(false);
    expect(invalid.sanitizedValue).toBeUndefined();
  });

  it('throws error when attempting financial field modification in service', async () => {
    // Arrange
    const mockRepo = {} as unknown as WorkerSelfEditRepository;
    const service = new WorkerSelfEditService(mockRepo);

    // Act
    const execution = service.executeSelfEdit({
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'Ali',
      field: 'dailyWage' as unknown as 'phone',
      newValue: '500',
      actorTelegramId: 123456n,
    });

    // Assert
    await expect(execution).rejects.toThrow(/محاولة تعديل حقل مالي محظور/);
  });
});
