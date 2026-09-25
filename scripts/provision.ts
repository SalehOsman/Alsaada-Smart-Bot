import { prisma, disconnectDatabase } from '../packages/database/src/client.js';
import { seedCompanyProfile } from '../packages/database/src/scripts/seed-company-profile.js';

try {
  process.loadEnvFile('.env');
} catch {}

export async function provision(): Promise<void> {
  console.log('================================================================');
  console.log('🚀 Al-Saada Smart Bot: System Provisioning & Singleton Setup');
  console.log('================================================================');

  try {
    // 1. Seed Singleton Company Profile
    console.log('🏢 [1/3] Ensuring Singleton Company Profile...');
    await seedCompanyProfile();

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
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

if (process.argv[1]?.endsWith('provision.ts') || process.argv[1]?.endsWith('provision.js')) {
  provision()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
