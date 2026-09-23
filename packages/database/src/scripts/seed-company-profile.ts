import { prisma, disconnectDatabase } from '../client.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  process.loadEnvFile('.env');
} catch {}

export async function seedCompanyProfile(): Promise<void> {
  console.log('================================================================');
  console.log('🏢 Seeding/Updating Default White-Label Company Profile...');
  console.log('================================================================');

  try {
    const candidates = [
      path.resolve(__dirname, '../../prisma/seed-data/company-profile.json'),
      path.resolve(process.cwd(), 'prisma/seed-data/company-profile.json'),
      path.resolve(process.cwd(), 'packages/database/prisma/seed-data/company-profile.json'),
    ];
    const jsonPath = candidates.find((p) => fs.existsSync(p));
    if (!jsonPath) {
      throw new Error(`Profile seed file not found in any of: ${candidates.join(', ')}`);
    }

    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);

    const tenantCode = process.env.TENANT_CODE || data.tenantCode || 'DEFAULT';
    const tenantName = process.env.TENANT_NAME || data.tenantName || 'المنظومة المؤسسية';
    const legalName = process.env.COMPANY_LEGAL_NAME || data.profile?.legalName || tenantName;
    const tradeName = process.env.COMPANY_TRADE_NAME || data.profile?.tradeName || tenantName;
    const baseCurrency = process.env.COMPANY_BASE_CURRENCY || data.profile?.baseCurrency || 'EGP';

    // 1. Ensure Tenant exists
    const tenant = await prisma.tenant.upsert({
      where: { code: tenantCode },
      update: { name: tenantName },
      create: {
        code: tenantCode,
        name: tenantName,
        isActive: true,
      },
    });

    console.log(`✅ Tenant verified: ${tenant.name} (${tenant.code}) [ID: ${tenant.id}]`);

    // 2. Ensure Company Profile exists
    const existingProfile = await prisma.companyProfile.findFirst({
      where: { tenantId: tenant.id },
    });

    const profileData = {
      tenantId: tenant.id,
      legalName,
      tradeName,
      commercialRegistrationNumber: data.profile?.commercialRegistrationNumber || null,
      taxRegistrationNumber: data.profile?.taxRegistrationNumber || null,
      headquartersAddress: data.profile?.headquartersAddress || null,
      primaryPhone: data.profile?.primaryPhone || null,
      officialEmail: data.profile?.officialEmail || null,
      baseCurrency,
      settings: data.profile?.settings || {},
    };

    if (existingProfile) {
      await prisma.companyProfile.update({
        where: { id: existingProfile.id },
        data: profileData,
      });
      console.log(`✅ Company Profile updated successfully for: ${tradeName}`);
    } else {
      await prisma.companyProfile.create({
        data: profileData,
      });
      console.log(`✅ Company Profile created successfully for: ${tradeName}`);
    }

    console.log('================================================================');
    console.log('🎉 Default Company Profile Seed Completed Successfully.');
    console.log('================================================================');
  } catch (error) {
    console.error('❌ Failed to seed company profile:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

if (process.argv[1]?.endsWith('seed-company-profile.ts')) {
  seedCompanyProfile()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
