import { describe, it, expect, vi } from 'vitest';
import { WorkerSelfEditService } from '../flow.service.js';
import { WorkerSelfEditRepository } from '../flow.repository.js';
import {
  validateWorkerSelfEditField,
  isForbiddenFinancialField,
  validateFieldValue,
} from '../flow.validators.js';

describe('01.6 Worker Self-Edit — Unit Tests', () => {
  it('should validate allowed personal fields', () => {
    expect(validateWorkerSelfEditField('phone')).toBe(true);
    expect(validateWorkerSelfEditField('address')).toBe(true);
    expect(validateWorkerSelfEditField('walletType')).toBe(true);
    expect(validateWorkerSelfEditField('dailyWage')).toBe(false);
  });

  it('should strictly detect forbidden financial fields', () => {
    expect(isForbiddenFinancialField('dailyWage')).toBe(true);
    expect(isForbiddenFinancialField('basicSalary')).toBe(true);
    expect(isForbiddenFinancialField('fixedAllowances')).toBe(true);
    expect(isForbiddenFinancialField('jobTitle')).toBe(true);
    expect(isForbiddenFinancialField('phone')).toBe(false);
  });

  it('should validate and sanitize phone numbers', () => {
    const valid = validateFieldValue('phone', '01012345678');
    expect(valid.isValid).toBe(true);
    expect(valid.sanitizedValue).toBe('01012345678');

    const invalid = validateFieldValue('phone', '12345');
    expect(invalid.isValid).toBe(false);
    expect(invalid.error).toContain('رقم مصري ساري');
  });

  it('should validate ppe shoe sizes', () => {
    const valid = validateFieldValue('ppeShoeSize', '43');
    expect(valid.isValid).toBe(true);
    expect(valid.sanitizedValue).toBe('43');

    const invalid = validateFieldValue('ppeShoeSize', '20');
    expect(invalid.isValid).toBe(false);
  });

  it('should throw error when attempting financial field modification in service', async () => {
    const mockRepo = {} as unknown as WorkerSelfEditRepository;
    const service = new WorkerSelfEditService(mockRepo);

    await expect(
      service.executeSelfEdit({
        workerId: 'w-1',
        workerCode: 'OP-01',
        workerName: 'Ali',
        field: 'dailyWage' as unknown as 'phone',
        newValue: '500',
        actorTelegramId: 123456n,
      })
    ).rejects.toThrow(/محاولة تعديل حقل مالي محظور/);
  });
});
