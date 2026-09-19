import { prisma } from '../client.js';
import fs from 'node:fs';
import path from 'node:path';

try {
  process.loadEnvFile('.env');
} catch {}

export async function seedCompanyProfile(): Promise<void> {
  console.log('================================================================');
  console.log('🏢 Seeding/Updating Al-Saada Company Profile...');
  console.log('================================================================');

  try {
    const jsonPath = path.resolve(process.cwd(), 'prisma/seed-data/company-profile.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Profile seed file not found at: ${jsonPath}`);
    }

    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);

    // 1. Ensure Tenant exists
    const tenant = await prisma.tenant.upsert({
      where: { code: data.tenantCode },
      update: { name: data.tenantName },
      create: {
        code: data.tenantCode,
        name: data.tenantName,
        isActive: true,
      },
    });

    console.log(`✅ Tenant verified: ${tenant.name} (${tenant.code}) [ID: ${tenant.id}]`);

    // 2. Ensure Company Profile exists
    const existingProfile = await prisma.companyProfile.findFirst({
      where: { tenantId: tenant.id },
    });

    if (existingProfile) {
      await prisma.companyProfile.update({
        where: { id: existingProfile.id },
        data: {
          legalName: data.profile.legalName,
          tradeName: data.profile.tradeName,
          commercialRegistrationNumber: data.profile.commercialRegistrationNumber,
          taxRegistrationNumber: data.profile.taxRegistrationNumber,
          headquartersAddress: data.profile.headquartersAddress,
          primaryPhone: data.profile.primaryPhone,
          officialEmail: data.profile.officialEmail,
          baseCurrency: data.profile.baseCurrency || 'EGP',
          settings: data.profile.settings || {},
        },
      });
      console.log(`✅ Company Profile updated successfully for: ${data.profile.tradeName}`);
    } else {
      await prisma.companyProfile.create({
        data: {
          tenantId: tenant.id,
          legalName: data.profile.legalName,
          tradeName: data.profile.tradeName,
          commercialRegistrationNumber: data.profile.commercialRegistrationNumber,
          taxRegistrationNumber: data.profile.taxRegistrationNumber,
          headquartersAddress: data.profile.headquartersAddress,
          primaryPhone: data.profile.primaryPhone,
          officialEmail: data.profile.officialEmail,
          baseCurrency: data.profile.baseCurrency || 'EGP',
          settings: data.profile.settings || {},
        },
      });
      console.log(`✅ Company Profile created successfully for: ${data.profile.tradeName}`);
    }

    console.log('================================================================');
    console.log('🎉 Company Profile Seed Completed Successfully.');
    console.log('================================================================');
  } catch (error) {
    console.error('❌ Failed to seed company profile:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith('seed-company-profile.ts')) {
  seedCompanyProfile();
}
