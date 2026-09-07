import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/redis.js', () => ({
  redis: {
    on: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  },
  getPendingCompanyEdit: vi.fn().mockResolvedValue(null),
  setPendingCompanyEdit: vi.fn().mockResolvedValue(undefined),
  clearPendingCompanyEdit: vi.fn().mockResolvedValue(undefined),
}));

import {
  COMPANY_FIELD_LABELS,
  renderCompanyProfileCard,
  handleCompanyFieldTextInput,
} from '../src/handlers/company-profile.handler.js';
import { MyContext } from '../src/types/context.js';
import { fastCache } from '../src/services/fast-cache.service.js';

describe('Company Profile Handler & Field Labels', () => {
  beforeEach(() => {
    fastCache.clearL1();
  });
  it('should define all 8 official corporate fields with Arabic labels', () => {
    expect(COMPANY_FIELD_LABELS.legalName).toBe('اسم الشركة القانوني');
    expect(COMPANY_FIELD_LABELS.tradeName).toBe('الاسم التجاري المختصر');
    expect(COMPANY_FIELD_LABELS.commercialRegistrationNumber).toBe('رقم السجل التجاري');
    expect(COMPANY_FIELD_LABELS.taxRegistrationNumber).toBe('رقم البطاقة الضريبية');
    expect(COMPANY_FIELD_LABELS.headquartersAddress).toBe('المقر الرئيسي والإداري');
    expect(COMPANY_FIELD_LABELS.primaryPhone).toBe('هاتف الإدارة والتواصل');
    expect(COMPANY_FIELD_LABELS.officialEmail).toBe('البريد الإلكتروني الرسمي');
    expect(COMPANY_FIELD_LABELS.baseCurrency).toContain('العملة الأساسية');
  });

  it('should block non-super-admin users from viewing or editing company profile', async () => {
    const mockAnswerCallbackQuery = vi.fn();
    const mockCtx = {
      isRealSuperAdmin: false,
      callbackQuery: { data: 'action:settings:company_profile' },
      answerCallbackQuery: mockAnswerCallbackQuery,
    } as unknown as MyContext;

    await renderCompanyProfileCard(mockCtx, true);

    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        show_alert: true,
        text: expect.stringContaining('حصرياً للمدير العام'),
      })
    );
  });

  it('should return false when a regular text message arrives without a pending edit state', async () => {
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 999999 },
      message: { text: 'مرحبا' },
    } as unknown as MyContext;

    const handled = await handleCompanyFieldTextInput(mockCtx);
    expect(handled).toBe(false);
  });
});
