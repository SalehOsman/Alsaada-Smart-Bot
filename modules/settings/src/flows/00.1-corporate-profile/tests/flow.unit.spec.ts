import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CorporateProfileService } from '../flow.service.js';
import type { CorporateProfileRepository } from '../flow.repository.js';
import type { CompanyProfileDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.1 Unit Tests — CorporateProfile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('retrieves company profile record successfully from repository', async () => {
    // Arrange
    const mockRepo = {
      getProfile: vi.fn().mockResolvedValue(sampleProfile),
      updateField: vi.fn(),
    } as unknown as CorporateProfileRepository;
    const service = new CorporateProfileService(mockRepo);

    // Act
    const profile = await service.getProfile();

    // Assert
    expect(profile).toBeDefined();
    expect(profile?.legalName).toBe('شركة السعادة للمقاولات العامة');
    expect(mockRepo.getProfile).toHaveBeenCalledTimes(1);
  });

  it('validates and updates allowed field via repository', async () => {
    // Arrange
    const mockRepo = {
      getProfile: vi.fn().mockResolvedValue(sampleProfile),
      updateField: vi.fn().mockResolvedValue({
        ...sampleProfile,
        tradeName: 'السعادة للإنشاءات',
      }),
    } as unknown as CorporateProfileRepository;
    const service = new CorporateProfileService(mockRepo);

    // Act
    const res = await service.updateField('tradeName', 'السعادة للإنشاءات');

    // Assert
    expect(res.success).toBe(true);
    expect(res.profile?.tradeName).toBe('السعادة للإنشاءات');
    expect(mockRepo.updateField).toHaveBeenCalledWith('tradeName', 'السعادة للإنشاءات');
  });

  it('rejects invalid email format and skips repository update', async () => {
    // Arrange
    const mockRepo = {
      getProfile: vi.fn(),
      updateField: vi.fn(),
    } as unknown as CorporateProfileRepository;
    const service = new CorporateProfileService(mockRepo);

    // Act
    const res = await service.updateField('officialEmail', 'not-an-email');

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain('صيغة البريد الإلكتروني غير صحيحة');
    expect(mockRepo.updateField).not.toHaveBeenCalled();
  });

  it('manages pending edit state lifecycle and confirms clearance', async () => {
    // Arrange
    const mockRepo = {
      getProfile: vi.fn(),
      updateField: vi.fn(),
    } as unknown as CorporateProfileRepository;
    const service = new CorporateProfileService(mockRepo);
    const telegramId = 123456789n;

    // Act
    await service.setPendingEdit(telegramId, 'legalName', 999);
    const pending = await service.getPendingEdit(telegramId);
    await service.clearPendingEdit(telegramId);
    const afterClear = await service.getPendingEdit(telegramId);

    // Assert
    expect(pending).toBeDefined();
    expect(pending?.fieldKey).toBe('legalName');
    expect(pending?.promptMessageId).toBe(999);
    expect(afterClear).toBeNull();
  });
});
