import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UniversalCustodyGate } from '../src/custody-gate/gate.js';
import type { CustodyAccount } from '../src/custody-gate/types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Universal Custody Gate — Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const activeCustody: CustodyAccount = {
    id: 'cust-1',
    code: 'CUST-KHA-01',
    supervisorTelegramId: 998877n,
    supervisorName: 'م. أحمد الشناوي',
    siteCode: 'STE-KHA',
    currentBalance: 5000,
    status: 'OPEN',
  };

  it('1. allows operation when custody balance is sufficient', () => {
    // Arrange
    const params = {
      custody: activeCustody,
      requiredAmount: 1500,
      operationType: 'شراء سولار معدات',
    };

    // Act
    const res = UniversalCustodyGate.verifyCustodyFunds(params);

    // Assert
    expect(res.isAllowed).toBe(true);
    expect(res.requestedAmount).toBe(1500);
    expect(res.availableBalance).toBe(5000);
    expect(res.projectedBalance).toBe(3500);
  });

  it('2. rejects operation when custody balance is insufficient', () => {
    // Arrange
    const params = {
      custody: activeCustody,
      requiredAmount: 7500,
      operationType: 'سلفة عامل',
    };

    // Act
    const res = UniversalCustodyGate.verifyCustodyFunds(params);

    // Assert
    expect(res.isAllowed).toBe(false);
    expect(res.error).toBe('INSUFFICIENT_CUSTODY_BALANCE');
    expect(res.errorArabic).toContain('لا يكفي');
  });

  it('3. rejects operation when custody is frozen or settled', () => {
    // Arrange
    const frozenCustody: CustodyAccount = { ...activeCustody, status: 'FROZEN' };
    const params = {
      custody: frozenCustody,
      requiredAmount: 500,
      operationType: 'مصروف نثري',
    };

    // Act
    const res = UniversalCustodyGate.verifyCustodyFunds(params);

    // Assert
    expect(res.isAllowed).toBe(false);
    expect(res.error).toBe('CUSTODY_NOT_OPEN');
  });
});
