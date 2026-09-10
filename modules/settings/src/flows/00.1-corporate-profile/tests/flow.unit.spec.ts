import { describe, it, expect, vi } from 'vitest';
import { CorporateProfileService } from '../flow.service.js';
import type { CorporateProfileRepository } from '../flow.repository.js';
import type { CompanyProfileDto } from '../flow.types.js';

describe('Flow 00.1 Unit Tests — CorporateProfile', () => {
  const sampleProfile: CompanyProfileDto = {
    id: 'cp-1',
    tenantId: 'tenant-1',
    legalName: 'شركة السعادة للمقاولات العامة',
    tradeName: 'السعادة للمقاولات',
    commercialRegistrationNumber: '123456',
    taxRegistrationNumber: '987654',
    headquartersAddress: 'القاهرة - مصر',
    primaryPhone: '01000000000',
    officialEmail: 'info@alsaada.com',
    baseCurrency: 'EGP',
  };

  it('should retrieve company profile correctly', async () => {
    const mockRepo = {
      getProfile: vi.fn().mockResolvedValue(sampleProfile),
      updateField: vi.fn(),
    } as unknown as CorporateProfileRepository;

    const service = new CorporateProfileService(mockRepo);
    const profile = await service.getProfile();

    expect(profile).toBeDefined();
    expect(profile?.legalName).toBe('شركة السعادة للمقاولات العامة');
    expect(mockRepo.getProfile).toHaveBeenCalledTimes(1);
  });

  it('should validate and update valid field', async () => {
    const mockRepo = {
      getProfile: vi.fn().mockResolvedValue(sampleProfile),
      updateField: vi.fn().mockResolvedValue({
        ...sampleProfile,
        tradeName: 'السعادة للإنشاءات',
      }),
    } as unknown as CorporateProfileRepository;

    const service = new CorporateProfileService(mockRepo);
    const res = await service.updateField('tradeName', 'السعادة للإنشاءات');

    expect(res.success).toBe(true);
    expect(res.profile?.tradeName).toBe('السعادة للإنشاءات');
    expect(mockRepo.updateField).toHaveBeenCalledWith('tradeName', 'السعادة للإنشاءات');
  });

  it('should reject invalid email format', async () => {
    const mockRepo = {
      getProfile: vi.fn(),
      updateField: vi.fn(),
    } as unknown as CorporateProfileRepository;

    const service = new CorporateProfileService(mockRepo);
    const res = await service.updateField('officialEmail', 'not-an-email');

    expect(res.success).toBe(false);
    expect(res.error).toContain('صيغة البريد الإلكتروني غير صحيحة');
    expect(mockRepo.updateField).not.toHaveBeenCalled();
  });

  it('should handle pending edit state lifecycle', async () => {
    const mockRepo = {
      getProfile: vi.fn(),
      updateField: vi.fn(),
    } as unknown as CorporateProfileRepository;

    const service = new CorporateProfileService(mockRepo);
    const telegramId = 123456789n;

    await service.setPendingEdit(telegramId, 'legalName', 999);
    const pending = await service.getPendingEdit(telegramId);

    expect(pending).toBeDefined();
    expect(pending?.fieldKey).toBe('legalName');
    expect(pending?.promptMessageId).toBe(999);

    await service.clearPendingEdit(telegramId);
    const afterClear = await service.getPendingEdit(telegramId);
    expect(afterClear).toBeNull();
  });
});
