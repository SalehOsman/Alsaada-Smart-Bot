import type { PrismaClient } from '@alsaada/database';
import type { CompanyProfileDto, CompanyFieldKey } from './flow.types.js';

export class CorporateProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getProfile(): Promise<CompanyProfileDto | null> {
    const profile = await this.prisma.companyProfile.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!profile) return null;

    return {
      id: profile.id,
      tenantId: profile.tenantId,
      legalName: profile.legalName,
      tradeName: profile.tradeName,
      commercialRegistrationNumber: profile.commercialRegistrationNumber,
      taxRegistrationNumber: profile.taxRegistrationNumber,
      headquartersAddress: profile.headquartersAddress,
      primaryPhone: profile.primaryPhone,
      officialEmail: profile.officialEmail,
      baseCurrency: profile.baseCurrency,
    };
  }

  async updateField(field: CompanyFieldKey, value: string): Promise<CompanyProfileDto> {
    const existing = await this.prisma.companyProfile.findFirst();
    if (!existing) {
      const tenant = await this.prisma.tenant.findFirst() || await this.prisma.tenant.create({
        data: { code: 'ALSAADA_MAIN', name: 'شركة السعادة للمقاولات العامة' }
      });
      const created = await this.prisma.companyProfile.create({
        data: {
          tenantId: tenant.id,
          legalName: field === 'legalName' ? value : 'شركة السعادة للمقاولات العامة',
          tradeName: field === 'tradeName' ? value : 'السعادة للمقاولات',
          [field]: value,
        },
      });
      return created as CompanyProfileDto;
    }

    const updated = await this.prisma.companyProfile.update({
      where: { id: existing.id },
      data: {
        [field]: value,
      },
    });

    return updated as CompanyProfileDto;
  }
}
