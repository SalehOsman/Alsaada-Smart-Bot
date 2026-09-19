import { prisma, disconnectDatabase } from '../client.js';

export const DEFAULT_CIGARETTES = [
  { code: 'CAN-CIG-01', name: 'كليوباترا بوكس أبيض', costPrice: 32, sellingPrice: 35 },
  { code: 'CAN-CIG-02', name: 'كليوباترا سوبر', costPrice: 32, sellingPrice: 35 },
  { code: 'CAN-CIG-03', name: 'كليوباترا كينج سايز', costPrice: 32, sellingPrice: 35 },
  { code: 'CAN-CIG-04', name: 'إل إم أزرق (L&M Blue)', costPrice: 65, sellingPrice: 70 },
  { code: 'CAN-CIG-05', name: 'إل إم أحمر (L&M Red)', costPrice: 65, sellingPrice: 70 },
  { code: 'CAN-CIG-06', name: 'وينستون أزرق (Winston Blue)', costPrice: 55, sellingPrice: 60 },
  { code: 'CAN-CIG-07', name: 'وينستون أحمر (Winston Red)', costPrice: 55, sellingPrice: 60 },
  { code: 'CAN-CIG-08', name: 'ميريت أصفر (Merit Yellow)', costPrice: 90, sellingPrice: 95 },
  { code: 'CAN-CIG-09', name: 'تايم (Time)', costPrice: 36, sellingPrice: 40 },
  { code: 'CAN-CIG-10', name: 'تارجت (Target)', costPrice: 32, sellingPrice: 35 },
];

export async function seedCanteenCigarettes(siteId?: string): Promise<number> {
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
      await prisma.canteenItem.upsert({
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
