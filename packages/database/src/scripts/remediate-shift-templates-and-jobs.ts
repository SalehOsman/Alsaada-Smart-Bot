import { prisma, disconnectDatabase } from '../client.js';

async function main() {
  console.log('🔄 [REMEDIATION] Starting shift templates seeding and job remediation...');

  // 1. Seed standard templates
  const standardTemplates = [
    { code: '40_WORK_10_REST', name: 'دورة قياسية (40+10)', workDays: 40, restDays: 10, isDefault: false },
    { code: '30_WORK_10_REST', name: 'دورة قياسية (30+10)', workDays: 30, restDays: 10, isDefault: false },
    { code: '20_WORK_10_REST', name: 'دورة قياسية (20+10)', workDays: 20, restDays: 10, isDefault: false },
    { code: '26_WORK_4_REST', name: 'دورة حضرية (26+4)', workDays: 26, restDays: 4, isDefault: false },
  ];

  for (const t of standardTemplates) {
    const existing = await prisma.shiftCycleTemplate.findFirst({
      where: { workDays: t.workDays, restDays: t.restDays },
    });
    if (!existing) {
      await prisma.shiftCycleTemplate.create({ data: t });
      console.log(`✅ Created ShiftCycleTemplate: ${t.workDays}/${t.restDays} (${t.name})`);
    } else {
      await prisma.shiftCycleTemplate.update({
        where: { id: existing.id },
        data: { name: t.name, isDefault: t.isDefault },
      });
      console.log(`ℹ️ Updated ShiftCycleTemplate: ${t.workDays}/${t.restDays}`);
    }
  }

  // 2. Remediate legacy / non-standard job titles
  // Any job with (20/30) or (20/20) should be reset to (20/10)
  const jobTitleDelegate = (prisma as any).jobTitle;
  const legacyJobs = typeof jobTitleDelegate?.findMany === 'function'
    ? await jobTitleDelegate.findMany({
        where: {
          OR: [
            { restDays: 30 },
            { restDays: 20 },
            { workDays: { notIn: [20, 26, 30, 40] } },
          ],
        },
      }).catch(() => [])
    : [];

  console.log(`🔍 Found ${legacyJobs.length} legacy job titles to remediate.`);
  for (const j of legacyJobs) {
    await jobTitleDelegate.update({
      where: { id: j.id },
      data: {
        workDays: 20,
        restDays: 10,
        totalCycleDays: 30,
        shiftNature: 'دورة قياسية (20+10)',
      },
    });
    console.log(`🛠️ Remediated job [${j.code}] ${(j as any).name ?? j.title}: 20 work / 10 rest`);
  }

  // 3. Remediate worker records with legacy cycle
  const affectedWorkers = await prisma.worker.findMany({
    where: {
      OR: [
        { shiftSystem: { contains: '30 راحة' } },
        { shiftSystem: { contains: '20 راحة' } },
      ],
    },
  });

  console.log(`🔍 Found ${affectedWorkers.length} workers with legacy shift cycle.`);
  for (const w of affectedWorkers) {
    const basic = Number(w.basicSalary) || 0;
    const additional = Number(w.additionalSalary) || 0;
    const dailyWage = Math.round(((basic + additional) / 30) * 100) / 100;

    await prisma.worker.update({
      where: { id: w.id },
      data: {
        shiftSystem: '20 يوم عمل / 10 راحة',
        dailyWage,
      },
    });
    console.log(`👤 Remediated worker [${w.code}] ${w.name}: shift='20 يوم عمل / 10 راحة', dailyWage=${dailyWage}`);
  }

  console.log('🎉 [REMEDIATION] Completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Remediation error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectDatabase();
  });
