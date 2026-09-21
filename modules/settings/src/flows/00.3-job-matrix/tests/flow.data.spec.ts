import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateDeptCode, validateDeptName, validateSalary } from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.3 Data & Validation Tests — الهيكل الوظيفي ومصفوفة المهن والورديات', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('validates department code with alphanumeric structure', () => {
    // Arrange
    const validCode = 'D-ENG';

    // Act
    const res = validateDeptCode(validCode);

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('rejects empty department code with localized error message', () => {
    // Arrange
    const emptyCode = '   ';

    // Act
    const res = validateDeptCode(emptyCode);

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('كود القسم مطلوب.');
  });

  it('rejects department code with invalid characters or excessive length', () => {
    // Arrange
    const invalidCode = 'DEPT@SPECIAL#CODE_TOO_LONG';

    // Act
    const res = validateDeptCode(invalidCode);

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('كود القسم يجب أن يتكون من حروف وأرقام إنجليزية (مثال: D-ENG).');
  });

  it('validates department name exceeding minimum length', () => {
    // Arrange
    const validName = 'إدارة المشروعات';

    // Act
    const res = validateDeptName(validName);

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('rejects department name shorter than minimum threshold', () => {
    // Arrange
    const shortName = 'إد';

    // Act
    const res = validateDeptName(shortName);

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('اسم القسم يجب ألا يقل عن 3 أحرف.');
  });

  it('validates positive numeric salary value', () => {
    // Arrange
    const salaryVal = '12500';

    // Act
    const res = validateSalary(salaryVal);

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.amount).toBe(12500);
  });

  it('rejects negative salary input', () => {
    // Arrange
    const negativeSalary = -500;

    // Act
    const res = validateSalary(negativeSalary);

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('يرجى إدخال مبلغ صحيح أكبر من أو يساوي 0.');
  });
});
