import { describe, it, expect } from 'vitest';
import { UniversalCustodyGate } from '../src/custody-gate/gate.js';
import type { CustodyAccount } from '../src/custody-gate/types.js';

describe('Universal Custody Gate — Tests', () => {
  const activeCustody: CustodyAccount = {
    id: 'cust-1',
    code: 'CUST-KHA-01',
    supervisorTelegramId: 998877n,
    supervisorName: 'م. أحمد الشناوي',
    siteCode: 'STE-KHA',
    currentBalance: 5000,
    status: 'OPEN',
  };

  it('should allow operation when custody balance is sufficient', () => {
    const res = UniversalCustodyGate.verifyCustodyFunds({
      custody: activeCustody,
      requiredAmount: 1500,
      operationType: 'شراء سولار معدات',
    });

    expect(res.isAllowed).toBe(true);
    expect(res.requestedAmount).toBe(1500);
    expect(res.availableBalance).toBe(5000);
    expect(res.projectedBalance).toBe(3500);
  });

  it('should reject operation when custody balance is insufficient', () => {
    const res = UniversalCustodyGate.verifyCustodyFunds({
      custody: activeCustody,
      requiredAmount: 7500,
      operationType: 'سلفة عامل',
    });

    expect(res.isAllowed).toBe(false);
    expect(res.error).toBe('INSUFFICIENT_CUSTODY_BALANCE');
    expect(res.errorArabic).toContain('لا يكفي');
  });

  it('should reject operation when custody is frozen or settled', () => {
    const frozenCustody: CustodyAccount = { ...activeCustody, status: 'FROZEN' };
    const res = UniversalCustodyGate.verifyCustodyFunds({
      custody: frozenCustody,
      requiredAmount: 500,
      operationType: 'مصروف نثري',
    });

    expect(res.isAllowed).toBe(false);
    expect(res.error).toBe('CUSTODY_NOT_OPEN');
  });
});
