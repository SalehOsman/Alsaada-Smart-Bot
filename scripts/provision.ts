import fs from 'node:fs';
import path from 'node:path';

// 1. Ensure .env is loaded before importing prisma client
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {}
  }
}

export interface ProvisionOptions {
  autoDisconnect?: boolean;
}

export async function provision(options: ProvisionOptions = {}): Promise<void> {
  const { autoDisconnect = false } = options;

  console.log('================================================================');
  console.log('🚀 Al-Saada Smart Bot: System Provisioning & Singleton Setup');
  console.log('================================================================');

  const { prisma, disconnectDatabase } = await import('../packages/database/src/client.js');

  try {
    // 1. Seed Singleton Company Profile directly (preventing premature pool disconnect)
    console.log('🏢 [1/3] Ensuring Singleton Company Profile (Al-Saada Enterprise)...');
    const candidates = [
      path.resolve(process.cwd(), 'packages/database/prisma/seed-data/company-profile.json'),
      path.resolve(process.cwd(), 'prisma/seed-data/company-profile.json'),
    ];
    const jsonPath = candidates.find((p) => fs.existsSync(p));
    let seedSettings: Record<string, unknown> = {
      officialWorkingHoursPerDay: 8,
      weeklyRestDays: ['FRIDAY'],
      companyPolicies: {
        advanceNoticeDays: 3,
        maxAdvancePercentageOfSalary: 50,
        ppeMandatory: true,
      },
    };

    if (jsonPath) {
      try {
        const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        if (raw?.profile?.settings) {
          seedSettings = raw.profile.settings;
        }
      } catch {}
    }

    const legalName = process.env.COMPANY_LEGAL_NAME || 'شركة السعادة للمقاولات والتعدين العامة';
    const tradeName = process.env.COMPANY_TRADE_NAME || 'شركة السعادة للمقاولات العامة';
    const baseCurrency = process.env.COMPANY_BASE_CURRENCY || 'EGP';

    const existingProfile = await prisma.companyProfile.findFirst();
    const profileData = {
      legalName,
      tradeName,
      commercialRegistrationNumber: null,
      taxRegistrationNumber: null,
      headquartersAddress: 'جمهورية مصر العربية',
      primaryPhone: null,
      officialEmail: null,
      baseCurrency,
      settings: seedSettings as any,
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

    // 2. Ensure Default Project Exists
    console.log('🏗️ [2/3] Ensuring Default Project...');
    let defaultProject = await prisma.project.findFirst({
      where: { code: 'PRJ-MAIN' },
    });

    if (!defaultProject) {
      defaultProject = await prisma.project.create({
        data: {
          code: 'PRJ-MAIN',
          name: 'المشروع العام والعمليات المركزية',
          status: 'ACTIVE',
        },
      });
      console.log(`✅ Default Project created: ${defaultProject.name} (${defaultProject.code})`);
    } else {
      console.log(`ℹ️ Default Project already exists: ${defaultProject.name} (${defaultProject.code})`);
    }

    // 3. Ensure Super Admin User (if configured)
    console.log('👤 [3/3] Checking Super Admin user setup...');
    const superAdminTelegramIdRaw = process.env.SUPER_ADMIN_TELEGRAM_ID;
    if (superAdminTelegramIdRaw && /^\d+$/.test(superAdminTelegramIdRaw.trim())) {
      const telegramId = BigInt(superAdminTelegramIdRaw.trim());
      const existingUser = await prisma.user.findUnique({
        where: { telegramId },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            telegramId,
            fullName: 'المدير العام (النظام)',
            role: 'SUPER_ADMIN',
            isActive: true,
            assignedSiteId: null,
          },
        });
        console.log(`✅ Super Admin user provisioned with role SUPER_ADMIN for Telegram ID: ${telegramId}`);
      } else {
        console.log(`ℹ️ Super Admin user already exists for Telegram ID: ${telegramId}`);
      }
    } else {
      console.log('ℹ️ SUPER_ADMIN_TELEGRAM_ID not set or non-numeric; skipping admin user seed.');
    }

    console.log('================================================================');
    console.log('🎉 System Provisioning Completed Successfully (Single-Company Architecture).');
    console.log('================================================================');
  } catch (error) {
    console.error('❌ Provisioning failed:', error);
    throw error;
  } finally {
    if (autoDisconnect) {
      await disconnectDatabase();
    }
  }
}

if (process.argv[1]?.endsWith('provision.ts') || process.argv[1]?.endsWith('provision.js')) {
  provision({ autoDisconnect: true })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
