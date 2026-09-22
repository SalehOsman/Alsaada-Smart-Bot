import type { PrismaClient } from '@alsaada/database';
import type { CompanyProfileDto, CompanyFieldKey } from './flow.types.js';

type CompanySettings = { commercialRegistrationIssueDate?: string; commercialRegistrationExpiryDate?: string; socialInsuranceNumber?: string; vatRegistrationNumber?: string; logoPath?: string; logoFileId?: string; socialLinks?: string; headerImagePath?: string; headerImageFileId?: string; footerImagePath?: string; footerImageFileId?: string; primaryColor?: string; secondaryColor?: string; reportShortName?: string; bankName?: string; bankAccountHolder?: string; bankAccountNumber?: string; bankIban?: string; bankSwift?: string };

export class CorporateProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getProfile(): Promise<CompanyProfileDto | null> {
    const profile = await this.prisma.companyProfile.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!profile) return null;
    const settings = (profile.settings && typeof profile.settings === 'object' && !Array.isArray(profile.settings) ? profile.settings : {}) as CompanySettings;
    return {
      id: profile.id, tenantId: profile.tenantId, legalName: profile.legalName, tradeName: profile.tradeName,
      commercialRegistrationNumber: profile.commercialRegistrationNumber,
      commercialRegistrationIssueDate: settings.commercialRegistrationIssueDate ?? null,
      commercialRegistrationExpiryDate: settings.commercialRegistrationExpiryDate ?? null,
      socialInsuranceNumber: settings.socialInsuranceNumber ?? null,
      taxRegistrationNumber: profile.taxRegistrationNumber,
      vatRegistrationNumber: settings.vatRegistrationNumber ?? null,
      logoPath: settings.logoPath ?? null,
      logoFileId: settings.logoFileId ?? null,
      socialLinks: settings.socialLinks ?? null,
      headerImagePath: settings.headerImagePath ?? null,
      headerImageFileId: settings.headerImageFileId ?? null,
      footerImagePath: settings.footerImagePath ?? null,
      footerImageFileId: settings.footerImageFileId ?? null,
      primaryColor: settings.primaryColor ?? null,
      secondaryColor: settings.secondaryColor ?? null,
      reportShortName: settings.reportShortName ?? null,
      bankName: settings.bankName ?? null,
      bankAccountHolder: settings.bankAccountHolder ?? null,
      bankAccountNumber: settings.bankAccountNumber ?? null,
      bankIban: settings.bankIban ?? null,
      bankSwift: settings.bankSwift ?? null,
      headquartersAddress: profile.headquartersAddress, primaryPhone: profile.primaryPhone,
      officialEmail: profile.officialEmail, baseCurrency: profile.baseCurrency,
    };
  }

  private async ensureProfile() {
    const existing = await this.prisma.companyProfile.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (existing) return existing;
    const tenant = await this.prisma.tenant.findFirst() || await this.prisma.tenant.create({ data: { code: 'ALSAADA_MAIN', name: 'شركة السعادة للمقاولات العامة' } });
    return this.prisma.companyProfile.create({ data: { tenantId: tenant.id, legalName: '', tradeName: '' } });
  }

  async updateImage(field: 'logoPath' | 'headerImagePath' | 'footerImagePath', path: string, fileId: string): Promise<CompanyProfileDto> {
    const existing = await this.ensureProfile();
    const settings = (existing.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings) ? existing.settings : {}) as CompanySettings;
    await this.prisma.companyProfile.update({ where: { id: existing.id }, data: { settings: { ...settings, [field]: path, [field.replace('Path', 'FileId')]: fileId } } });
    return (await this.getProfile())!;
  }

  async updateField(field: CompanyFieldKey, value: string): Promise<CompanyProfileDto> {
    const existing = await this.ensureProfile();
    if (field !== 'legalName' && field !== 'tradeName' && field !== 'commercialRegistrationNumber' && field !== 'taxRegistrationNumber' && field !== 'headquartersAddress' && field !== 'primaryPhone' && field !== 'officialEmail' && field !== 'baseCurrency') {
      const settings = (existing.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings) ? existing.settings : {}) as CompanySettings;
      await this.prisma.companyProfile.update({ where: { id: existing.id }, data: { settings: { ...settings, [field]: value } } });
    } else {
      await this.prisma.companyProfile.update({ where: { id: existing.id }, data: { [field]: value } });
    }
    return (await this.getProfile())!;
  }
}
