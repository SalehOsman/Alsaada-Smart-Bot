import { prisma, disconnectDatabase } from '../client.js';
import type { Prisma } from '../generated/client/index.js';

try {
  process.loadEnvFile('.env');
} catch {}

export async function remediateJobMatrixAndCycles(): Promise<void> {
  console.log('================================================================');
  console.log('🔧 Starting Data Remediation for Job Matrix, Shift Cycles & Profile');
  console.log('================================================================');

  try {
    // 1. Remediate Job Titles where workDays > 60
    const corruptedJobs = await prisma.jobTitle.findMany({
      where: {
        workDays: { gt: 60 },
      },
    });

    console.log(`🔍 Found ${corruptedJobs.length} job titles with corrupted workDays (> 60).`);

    for (const job of corruptedJobs) {
      const corruptedValue = job.workDays;
      const targetAdditionalSalary = Number(job.additionalSalary) > 0 ? Number(job.additionalSalary) : corruptedValue;

      await prisma.jobTitle.update({
        where: { id: job.id },
        data: {
          additionalSalary: targetAdditionalSalary,
          workDays: 20,
          restDays: 10,
          totalCycleDays: 30,
          shiftNature: 'دورة قياسية (20+10)',
        },
      });

      console.log(`  ✅ Fixed job [${job.code}] ${job.name}: additionalSalary=${targetAdditionalSalary}, workDays=20, restDays=10`);
    }

    // 2. Remediate Workers where shiftSystem contains corrupted numbers
    const allWorkers = await prisma.worker.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        shiftSystem: true,
        basicSalary: true,
        additionalSalary: true,
        dailyWage: true,
      },
    });

    let fixedWorkersCount = 0;
    for (const worker of allWorkers) {
      let isCorrupted = false;
      if (worker.shiftSystem) {
        const match = worker.shiftSystem.match(/(\d+)\s*يوم عمل/);
        if (match && match[1] && parseInt(match[1], 10) > 60) {
          isCorrupted = true;
        } else if (worker.shiftSystem.includes('3000') || worker.shiftSystem.includes('4000') || worker.shiftSystem.includes('5000')) {
          isCorrupted = true;
        }
      }

      if (isCorrupted) {
        const bSal = Number(worker.basicSalary || 0);
        const aSal = Number(worker.additionalSalary || 0);
        const newDailyWage = Number(((bSal + aSal) / 30).toFixed(2));

        await prisma.worker.update({
          where: { id: worker.id },
          data: {
            shiftSystem: '20 يوم عمل / 10 راحة',
            dailyWage: newDailyWage,
          },
        });

        fixedWorkersCount++;
        console.log(`  ✅ Fixed worker [${worker.code}] ${worker.name}: shiftSystem="20 يوم عمل / 10 راحة", dailyWage=${newDailyWage}`);
      }
    }
    console.log(`🔍 Remediated ${fixedWorkersCount} workers with corrupted shiftSystem.`);

    // 3. Purge defaultShiftSystem from company_profiles.settings
    const profiles = await prisma.companyProfile.findMany();
    let fixedProfilesCount = 0;
    for (const p of profiles) {
      if (p.settings && typeof p.settings === 'object') {
        const settingsObj = { ...(p.settings as Record<string, unknown>) };
        if ('defaultShiftSystem' in settingsObj) {
          delete settingsObj.defaultShiftSystem;
          await prisma.companyProfile.update({
            where: { id: p.id },
            data: { settings: settingsObj as Prisma.InputJsonObject },
          });
          fixedProfilesCount++;
          console.log(`  ✅ Purged defaultShiftSystem from company profile [${p.id}] ${p.tradeName}`);
        }
      }
    }
    console.log(`🔍 Purged defaultShiftSystem from ${fixedProfilesCount} company profile(s).`);

    console.log('================================================================');
    console.log('🎉 Data Remediation Completed Successfully.');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Data remediation error:', err);
    throw err;
  } finally {
    await disconnectDatabase();
  }
}

if (process.argv[1]?.endsWith('remediate-job-matrix-and-cycles.ts')) {
  remediateJobMatrixAndCycles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
