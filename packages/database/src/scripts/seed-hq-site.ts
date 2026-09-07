import { PrismaClient } from '@prisma/client';

try {
  process.loadEnvFile('.env');
} catch {}

const prisma = new PrismaClient();

export async function seedHqSite(): Promise<void> {
  console.log('================================================================');
  console.log('🏢 Seeding/Ensuring Headquarters Site (STE-HQ)...');
  console.log('================================================================');

  try {
    let tenant = await prisma.tenant.findFirst({ where: { code: 'ALSAADA' } });
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { code: 'ALSAADA', name: 'شركة السعادة للمقاولات العامة والتعدين' },
      });
    }

    let adminProject = await prisma.project.findFirst({
      where: { code: 'PRJ-MAIN-01' },
    });

    if (!adminProject) {
      adminProject = await prisma.project.create({
        data: {
          tenantId: tenant.id,
          code: 'PRJ-MAIN-01',
          name: 'المشروع العام والعمليات الإدارية والمقاولات',
          status: 'ACTIVE',
        },
      });
    }

    const hqSite = await prisma.site.upsert({
      where: { code: 'STE-HQ' },
      update: {
        name: 'المقر الرئيسي - الإدارة العامة (القاهرة)',
        governorateCode: 'القاهرة',
        status: 'ACTIVE',
        geofenceRadiusMeters: 500,
      },
      create: {
        projectId: adminProject.id,
        code: 'STE-HQ',
        name: 'المقر الرئيسي - الإدارة العامة (القاهرة)',
        governorateCode: 'القاهرة',
        status: 'ACTIVE',
        geofenceRadiusMeters: 500,
      },
    });

    console.log(`✅ Headquarters Site verified: ${hqSite.name} (${hqSite.code})`);
  } catch (err) {
    console.error('❌ Error seeding HQ site:', err);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes('seed-hq-site')) {
  seedHqSite();
}
