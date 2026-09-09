import { describe, it, expect } from 'vitest';
import {
  FIELD_KEY_SHORT_MAP,
  FIELD_TO_SHORT_MAP,
  FIELD_LABELS,
  validateFieldValue,
} from '../flow.validators.js';
import type { EditableWorkerField } from '../flow.types.js';

describe('Flow 01.2.D Unit Tests — Worker Edit Governance & Short Mappings', () => {
  it('should bidirectionally map all editable fields without loss', () => {
    const fields = Object.keys(FIELD_LABELS) as EditableWorkerField[];

    for (const f of fields) {
      const short = FIELD_TO_SHORT_MAP[f];
      expect(short).toBeDefined();
      expect(short.length).toBeLessThanOrEqual(7);

      const recovered = FIELD_KEY_SHORT_MAP[short];
      expect(recovered).toBe(f);
    }
  });

  it('should validate phone values and normalize digits', () => {
    const valid = validateFieldValue('phone', '01012345678');
    expect(valid.isValid).toBe(true);
    expect(valid.cleanValue).toBe('01012345678');

    const invalid = validateFieldValue('phone', '01912345678');
    expect(invalid.isValid).toBe(false);
  });

  it('should validate flexible dates for expiry dates', () => {
    const valid = validateFieldValue('idCardExpiryDate', '26-05-2028');
    expect(valid.isValid).toBe(true);

    const invalid = validateFieldValue('idCardExpiryDate', 'bad-date');
    expect(invalid.isValid).toBe(false);
  });

  it('should validate name field and require at least two names', () => {
    const valid = validateFieldValue('name', 'سالم حسن علي');
    expect(valid.isValid).toBe(true);

    const single = validateFieldValue('name', 'سالم');
    expect(single.isValid).toBe(false);
  });

  it('should validate insurance number requiring 7-10 digits', () => {
    const valid = validateFieldValue('insuranceNumber', '12345678');
    expect(valid.isValid).toBe(true);
    expect(valid.cleanValue).toBe('12345678');

    const invalidShort = validateFieldValue('insuranceNumber', '123');
    expect(invalidShort.isValid).toBe(false);
  });

  it('should validate monetary fields (dailyWage, basicSalary)', () => {
    const valid = validateFieldValue('dailyWage', '350');
    expect(valid.isValid).toBe(true);
    expect(valid.cleanValue).toBe('350');

    const invalid = validateFieldValue('dailyWage', '-50');
    expect(invalid.isValid).toBe(false);
  });

  it('should validate bloodType against allowed blood types', () => {
    const valid = validateFieldValue('bloodType', 'o+');
    expect(valid.isValid).toBe(true);
    expect(valid.cleanValue).toBe('O+');

    const invalid = validateFieldValue('bloodType', 'XYZ');
    expect(invalid.isValid).toBe(false);
  });

  it('should render all 4 tab cards completely with worker data', async () => {
    const { WorkerEditMessages } = await import('../flow.messages.js');
    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'سالم حسن عبد الرحيم',
      nickname: 'أبو سالم',
      legacyCode: 'LEG-101',
      nationalId: '29801011234567',
      idCardExpiryDate: new Date('2028-05-26'),
      governorateCode: 'الجيزة',
      address: 'فيصل - الجيزة',
      militaryStatus: 'أدى الخدمة العسكرية',
      maritalStatus: 'متزوج',
      bloodType: 'O+',
      jobTitle: 'عامل تشغيل موقع',
      jobRef: { title: 'عامل تشغيل موقع' },
      site: { name: 'محطة معالجة الصالحية' },
      department: { name: 'العمليات الميدانية' },
      shiftSystem: 'وردية نهارية (12 ساعة)',
      contractType: 'يومية حرة',
      hireDate: new Date('2025-01-15'),
      status: 'ACTIVE',
      drivingLicense: 'درجة ثالثة',
      barracksUnit: 'عنبر ب - الدور الثاني',
      bedNumber: '14',
      paymentMethod: 'محفظة إلكترونية',
      accountNumberEncrypted: 'encrypted-wallet-payload',
      walletOwnerName: 'سالم حسن عبد الرحيم',
      instaPayHandle: 'salem@instapay',
      dailyWage: 350,
      basicSalary: 9000,
      fixedAllowances: 500,
      insuranceNumber: '87654321',
      insuranceStatus: 'مؤمن عليه',
      canteenCigarettePolicy: 'ONE_PACK_DAILY',
      cigaretteBrand: 'كليوباترا بوكس',
      phoneEncrypted: 'encrypted-phone-payload',
      emergencyPhoneEncrypted: 'encrypted-em-payload',
      emergencyContactName: 'حسن عبد الرحيم (الوالد)',
      ppeShoeSize: '43',
      ppeUniformSize: 'XL',
      medicalNotes: 'حساسية من البنسلين',
    };

    const tab1 = WorkerEditMessages.tab1PersonalCard(mockWorker, true);
    expect(tab1).toContain('سالم حسن عبد الرحيم');
    expect(tab1).toContain('أبو سالم');
    expect(tab1).toContain('26-05-2028');

    const tab2 = WorkerEditMessages.tab2JobCard(mockWorker, true);
    expect(tab2).toContain('عامل تشغيل موقع');
    expect(tab2).toContain('محطة معالجة الصالحية');
    expect(tab2).toContain('عنبر ب - الدور الثاني');

    const tab3 = WorkerEditMessages.tab3FinanceCard(mockWorker, true);
    expect(tab3).toContain('علبة واحدة يومياً');
    expect(tab3).toContain('كليوباترا بوكس');
    expect(tab3).toContain('87654321');
    expect(tab3).toContain('مؤمن عليه');

    const tab4 = WorkerEditMessages.tab4DocsCard(mockWorker, true);
    expect(tab4).toContain('43');
    expect(tab4).toContain('XL');
    expect(tab4).toContain('حساسية من البنسلين');
  });

  it('should generate tab keyboards and 2-step cigarette keyboards within telegram size limits', async () => {
    const { WorkerEditKeyboards } = await import('../flow.keyboard.js');
    const kb = WorkerEditKeyboards.workerProfileTabsKeyboard('wrk-1', 'FINANCE', true);
    expect(kb.inline_keyboard.length).toBeGreaterThanOrEqual(4);

    const polKb = WorkerEditKeyboards.cigarettePolicyKeyboard('wrk-1');
    expect(polKb.inline_keyboard.length).toBe(6);

    const items = [
      { id: 'c-1', name: 'كليوباترا بوكس', sellingPrice: 55 },
      { id: 'c-2', name: 'إل إم أزرق', sellingPrice: 85 },
    ];
    const brdKb = WorkerEditKeyboards.cigaretteBrandKeyboard('wrk-1', items);
    expect(brdKb.inline_keyboard.length).toBeGreaterThanOrEqual(2);
  });
});
