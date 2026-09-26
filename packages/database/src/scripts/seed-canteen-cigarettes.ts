import { prisma, disconnectDatabase } from '../client.js';

export const DEFAULT_CIGARETTES: Array<{
  code: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
}> = [];

export async function seedCanteenCigarettes(siteId?: string): Promise<number> {
  if (DEFAULT_CIGARETTES.length === 0) {
    console.log('ℹ️ No dummy canteen cigarette items seeded (DEFAULT_CIGARETTES is empty).');
    return 0;
  }

  const sites = siteId
    ? await prisma.site.findMany({ where: { id: siteId } })
    : await prisma.site.findMany();

  if (sites.length === 0) {
    console.warn('⚠️ No sites found to seed canteen cigarettes.');
    return 0;
  }

  let count = 0;
  for (const site of sites) {
    for (const cig of DEFAULT_CIGARETTES) {
      const itemCode = `${site.code}-${cig.code}`;
      await (prisma as any).canteenItem?.upsert({
        where: { code: itemCode },
        update: {
          name: cig.name,
          category: 'CIGARETTES',
          costPrice: cig.costPrice,
          sellingPrice: cig.sellingPrice,
          isActive: true,
        },
        create: {
          siteId: site.id,
          code: itemCode,
          name: cig.name,
          category: 'CIGARETTES',
          costPrice: cig.costPrice,
          sellingPrice: cig.sellingPrice,
          currentStock: 100,
          reorderThreshold: 10,
          isActive: true,
        },
      });
      count++;
    }
  }

  console.log(`✅ Seeded ${count} canteen cigarette items across ${sites.length} site(s).`);
  return count;
}

if (process.argv[1] && process.argv[1].includes('seed-canteen-cigarettes')) {
  seedCanteenCigarettes()
    .then(async () => {
      await disconnectDatabase();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Failed to seed canteen cigarettes:', err);
      await disconnectDatabase().catch(() => {});
      process.exit(1);
    });
}
