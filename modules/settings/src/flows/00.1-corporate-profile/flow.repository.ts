import type { PrismaClient } from '@alsaada/database';
import type { CompanyProfileDto, CompanyFieldKey } from './flow.types.js';

type CompanySettings = { socialInsuranceNumber?: string; vatRegistrationNumber?: string; logoPath?: string; logoFileId?: string };

export class CorporateProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getProfile(): Promise<CompanyProfileDto | null> {
    const profile = await this.prisma.companyProfile.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!profile) return null;
    const settings = (profile.settings && typeof profile.settings === 'object' && !Array.isArray(profile.settings) ? profile.settings : {}) as CompanySettings;
    return {
      id: profile.id, tenantId: profile.tenantId, legalName: profile.legalName, tradeName: profile.tradeName,
      commercialRegistrationNumber: profile.commercialRegistrationNumber,
      socialInsuranceNumber: settings.socialInsuranceNumber ?? null,
      taxRegistrationNumber: profile.taxRegistrationNumber,
      vatRegistrationNumber: settings.vatRegistrationNumber ?? null,
      logoPath: settings.logoPath ?? null,
      logoFileId: settings.logoFileId ?? null,
      headquartersAddress: profile.headquartersAddress, primaryPhone: profile.primaryPhone,
      officialEmail: profile.officialEmail, baseCurrency: profile.baseCurrency,
    };
  }

  private async ensureProfile() {
    const existing = await this.prisma.companyProfile.findFirst();
    if (existing) return existing;
    const tenant = await this.prisma.tenant.findFirst() || await this.prisma.tenant.create({ data: { code: 'ALSAADA_MAIN', name: 'شركة السعادة للمقاولات العامة' } });
    return this.prisma.companyProfile.create({ data: { tenantId: tenant.id, legalName: 'شركة السعادة للمقاولات العامة', tradeName: 'السعادة للمقاولات' } });
  }

  async updateLogo(path: string, fileId: string): Promise<CompanyProfileDto> {
    const existing = await this.ensureProfile();
    const settings = (existing.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings) ? existing.settings : {}) as CompanySettings;
    await this.prisma.companyProfile.update({ where: { id: existing.id }, data: { settings: { ...settings, logoPath: path, logoFileId: fileId } } });
    return (await this.getProfile())!;
  }

  async updateField(field: CompanyFieldKey, value: string): Promise<CompanyProfileDto> {
    const existing = await this.ensureProfile();
    if (field === 'socialInsuranceNumber' || field === 'vatRegistrationNumber' || field === 'logoPath') {
      const settings = (existing.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings) ? existing.settings : {}) as CompanySettings;
      await this.prisma.companyProfile.update({ where: { id: existing.id }, data: { settings: { ...settings, [field]: value } } });
    } else {
      await this.prisma.companyProfile.update({ where: { id: existing.id }, data: { [field]: value } });
    }
    return (await this.getProfile())!;
  }
}
