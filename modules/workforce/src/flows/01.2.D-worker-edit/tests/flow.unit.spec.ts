import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FIELD_KEY_SHORT_MAP,
  FIELD_TO_SHORT_MAP,
  FIELD_LABELS,
  validateFieldValue,
  getReturnTab,
} from '../flow.validators.js';
import { WorkerEditKeyboards } from '../flow.keyboard.js';
import { WorkerEditMessages } from '../flow.messages.js';
import type { EditableWorkerField } from '../flow.types.js';

describe('Flow 01.2.D Unit Tests — Worker Edit Governance & Short Mappings', () => {
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

  it('bidirectionally maps all editable fields without loss', () => {
    // Arrange
    const fields = Object.keys(FIELD_LABELS) as EditableWorkerField[];

    for (const f of fields) {
      // Act
      const short = FIELD_TO_SHORT_MAP[f];
      const recovered = FIELD_KEY_SHORT_MAP[short];

      // Assert
      expect(short).toBeDefined();
      expect(short.length).toBeLessThanOrEqual(7);
      expect(recovered).toBe(f);
    }
  });

  it('validates phone values and normalizes digits while rejecting invalid prefixes', () => {
    // Arrange
    const validRawPhone = '01012345678';
    const invalidRawPhone = '01912345678';

    // Act
    const valid = validateFieldValue('phone', validRawPhone);
    const invalid = validateFieldValue('phone', invalidRawPhone);

    // Assert
    expect(valid.isValid).toBe(true);
    expect(valid.cleanValue).toBe('01012345678');
    expect(invalid.isValid).toBe(false);
  });

  it('validates flexible dates for expiry dates and rejects malformed values', () => {
    // Arrange
    const validDateStr = '26-05-2028';
    const invalidDateStr = 'bad-date';

    // Act
    const valid = validateFieldValue('idCardExpiryDate', validDateStr);
    const invalid = validateFieldValue('idCardExpiryDate', invalidDateStr);

    // Assert
    expect(valid.isValid).toBe(true);
    expect(invalid.isValid).toBe(false);
  });

  it('validates name field requiring at least two words and rejects single names', () => {
    // Arrange
    const validNameStr = 'سالم حسن علي';
    const singleNameStr = 'سالم';

    // Act
    const valid = validateFieldValue('name', validNameStr);
    const single = validateFieldValue('name', singleNameStr);

    // Assert
    expect(valid.isValid).toBe(true);
    expect(single.isValid).toBe(false);
  });

  it('validates insurance number requiring 7-10 digits and rejects short values', () => {
    // Arrange
    const validInsNum = '12345678';
    const invalidShortInsNum = '123';

    // Act
    const valid = validateFieldValue('insuranceNumber', validInsNum);
    const invalidShort = validateFieldValue('insuranceNumber', invalidShortInsNum);

    // Assert
    expect(valid.isValid).toBe(true);
    expect(valid.cleanValue).toBe('12345678');
    expect(invalidShort.isValid).toBe(false);
  });

  it('validates monetary fields dailyWage and basicSalary while rejecting negative numbers', () => {
    // Arrange
    const validWageStr = '350';
    const negativeWageStr = '-50';

    // Act
    const valid = validateFieldValue('dailyWage', validWageStr);
    const invalid = validateFieldValue('dailyWage', negativeWageStr);

    // Assert
    expect(valid.isValid).toBe(true);
    expect(valid.cleanValue).toBe('350');
    expect(invalid.isValid).toBe(false);
  });

  it('validates nationalId requiring 14 digits and rejects improper lengths', () => {
    // Arrange
    const validNatId = '29801011234567';
    const shortNatId = '12345';

    // Act
    const valid = validateFieldValue('nationalId', validNatId);
    const invalid = validateFieldValue('nationalId', shortNatId);

    // Assert
    expect(valid.isValid).toBe(true);
    expect(valid.cleanValue).toBe('29801011234567');
    expect(invalid.isValid).toBe(false);
  });

  it('renders all 4 tab cards completely with worker data', () => {
    // Arrange
    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'سالم حسن عبد الرحيم',
      nickname: 'أبو سالم',
      legacyCode: 'LEG-101',
      nationalId: '29801011234567',
      idCardExpiryDate: new Date('2028-05-26'),
      governorateCode: '21',
      address: 'فيصل - الجيزة',
      militaryStatus: 'أدى الخدمة العسكرية',
      maritalStatus: 'متزوج',
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

    // Act
    const tab1 = WorkerEditMessages.tab1PersonalCard(mockWorker, true);
    const tab2 = WorkerEditMessages.tab2JobCard(mockWorker, true);
    const tab3 = WorkerEditMessages.tab3FinanceCard(mockWorker, true);
    const tab4 = WorkerEditMessages.tab4DocsCard(mockWorker, true);

    // Assert
    expect(tab1).toContain('سالم حسن عبد الرحيم');
    expect(tab1).toContain('أبو سالم');
    expect(tab1).toContain('26-05-2028');

    expect(tab2).toContain('عامل تشغيل موقع');
    expect(tab2).toContain('محطة معالجة الصالحية');
    expect(tab2).toContain('عنبر ب - الدور الثاني');

    expect(tab3).toContain('علبة واحدة يومياً');
    expect(tab3).toContain('كليوباترا بوكس');
    expect(tab3).toContain('87654321');
    expect(tab3).toContain('مؤمن عليه');

    expect(tab4).toContain('43');
    expect(tab4).toContain('XL');
    expect(tab4).toContain('حساسية من البنسلين');
  });

  it('generates tab keyboards and 2-step cigarette keyboards within telegram size limits', () => {
    // Arrange
    const items = [
      { id: 'c-1', name: 'كليوباترا بوكس', sellingPrice: 55 },
      { id: 'c-2', name: 'إل إم أزرق', sellingPrice: 85 },
    ];

    // Act
    const kb = WorkerEditKeyboards.workerProfileTabsKeyboard('wrk-1', 'FINANCE', true);
    const polKb = WorkerEditKeyboards.cigarettePolicyKeyboard('wrk-1');
    const brdKb = WorkerEditKeyboards.cigaretteBrandKeyboard('wrk-1', items);

    // Assert
    expect(kb.inline_keyboard.length).toBeGreaterThanOrEqual(4);
    expect(polKb.inline_keyboard.length).toBe(6);
    expect(brdKb.inline_keyboard.length).toBeGreaterThanOrEqual(2);
  });

  it('validates and supports Telegram ID field in worker edit while rejecting non-numeric values', () => {
    // Arrange
    const rawValidTgId = ' 123456789 ';
    const rawInvalidTgId = 'abc123';

    // Act
    const shortMapped = FIELD_KEY_SHORT_MAP.tgid;
    const returnTab = getReturnTab('tgid');
    const validRes = validateFieldValue('telegramId', rawValidTgId);
    const invalidRes = validateFieldValue('telegramId', rawInvalidTgId);
    const kb = WorkerEditKeyboards.workerProfileTabsKeyboard('wrk-1', 'DOCS', true);
    const hasTgButton = kb.inline_keyboard.some(row => row.some(b => b.text.includes('معرف تليجرام')));
    const card = WorkerEditMessages.tab4DocsCard({
      id: 'wrk-1',
      code: 'EMP-01',
      name: 'أحمد محمود',
      telegramId: 987654321n,
    }, true);

    // Assert
    expect(shortMapped).toBe('telegramId');
    expect(returnTab).toBe('DOCS');
    expect(validRes.isValid).toBe(true);
    expect(validRes.cleanValue).toBe('123456789');
    expect(invalidRes.isValid).toBe(false);
    expect(hasTgButton).toBe(true);
    expect(card).toContain('987654321');
  });
});
