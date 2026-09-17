import type { PrismaClient } from '@alsaada/database';
import type { DepartmentDto, JobTitleDto, MatrixImportRow, ShiftCycleOption } from './flow.types.js';

export class JobMatrixRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listDepartments(): Promise<DepartmentDto[]> {
    const depts = await this.prisma.department.findMany({
      orderBy: { code: 'asc' },
      include: {
        jobs: {
          select: { id: true, isActive: true },
        },
      },
    });

    return depts.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      isActive: d.isActive,
      jobsCount: d.jobs.length,
      activeJobsCount: d.jobs.filter((j) => j.isActive).length,
    }));
  }

  async getDepartmentWithJobs(code: string): Promise<{ dept: DepartmentDto; jobs: JobTitleDto[] } | null> {
    const dept = await this.prisma.department.findUnique({
      where: { code },
      include: {
        jobs: {
          orderBy: { code: 'asc' },
          include: {
            workers: { where: { status: 'ACTIVE' }, select: { id: true } },
          },
        },
      },
    });
    if (!dept) return null;

    const deptDto: DepartmentDto = {
      id: dept.id,
      code: dept.code,
      name: dept.name,
      isActive: dept.isActive,
      jobsCount: dept.jobs.length,
      activeJobsCount: dept.jobs.filter((j) => j.isActive).length,
    };

    const jobsDto: JobTitleDto[] = dept.jobs.map((j) => ({
      id: j.id,
      code: j.code,
      title: j.name,
      departmentId: j.departmentId,
      departmentName: dept.name,
      departmentCode: dept.code,
      isActive: j.isActive,
      minHeadcount: j.minHeadcount,
      baseSalary: Number(j.baseSalary),
      allowance: Number(j.additionalSalary),
      workDays: j.workDays,
      restDays: j.restDays,
      workerCount: j.workers.length,
    }));

    return { dept: deptDto, jobs: jobsDto };
  }

  async getJob(deptCode: string, jobCode: string): Promise<JobTitleDto | null> {
    const dept = await this.prisma.department.findUnique({ where: { code: deptCode } });
    if (!dept) return null;

    const job = await this.prisma.jobTitle.findFirst({
      where: { departmentId: dept.id, code: jobCode },
      include: {
        workers: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    });
    if (!job) return null;

    return {
      id: job.id,
      code: job.code,
      title: job.name,
      departmentId: dept.id,
      departmentName: dept.name,
      departmentCode: dept.code,
      isActive: job.isActive,
      minHeadcount: job.minHeadcount,
      baseSalary: Number(job.baseSalary),
      allowance: Number(job.additionalSalary),
      workDays: job.workDays,
      restDays: job.restDays,
      workerCount: job.workers.length,
    };
  }

  async updateJobHeadcountDelta(jobId: string, delta: number): Promise<JobTitleDto> {
    const job = await this.prisma.jobTitle.findUniqueOrThrow({ where: { id: jobId } });
    const newCount = Math.max(0, job.minHeadcount + delta);
    const updated = await this.prisma.jobTitle.update({
      where: { id: jobId },
      data: { minHeadcount: newCount },
      include: { department: true, workers: { where: { status: 'ACTIVE' }, select: { id: true } } },
    });

    return {
      id: updated.id,
      code: updated.code,
      title: updated.name,
      departmentId: updated.departmentId,
      departmentName: updated.department.name,
      departmentCode: updated.department.code,
      isActive: updated.isActive,
      minHeadcount: updated.minHeadcount,
      baseSalary: Number(updated.baseSalary),
      allowance: Number(updated.additionalSalary),
      workDays: updated.workDays,
      restDays: updated.restDays,
      workerCount: updated.workers.length,
    };
  }

  async toggleJobActive(jobId: string): Promise<JobTitleDto> {
    const job = await this.prisma.jobTitle.findUniqueOrThrow({ where: { id: jobId } });
    const updated = await this.prisma.jobTitle.update({
      where: { id: jobId },
      data: { isActive: !job.isActive },
      include: { department: true, workers: { where: { status: 'ACTIVE' }, select: { id: true } } },
    });

    return {
      id: updated.id,
      code: updated.code,
      title: updated.name,
      departmentId: updated.departmentId,
      departmentName: updated.department.name,
      departmentCode: updated.department.code,
      isActive: updated.isActive,
      minHeadcount: updated.minHeadcount,
      baseSalary: Number(updated.baseSalary),
      allowance: Number(updated.additionalSalary),
      workDays: updated.workDays,
      restDays: updated.restDays,
      workerCount: updated.workers.length,
    };
  }

  async updateJobCycle(jobId: string, workDays: number, restDays: number): Promise<JobTitleDto> {
    const updated = await this.prisma.jobTitle.update({
      where: { id: jobId },
      data: {
        workDays,
        restDays,
        totalCycleDays: workDays + restDays,
      },
      include: { department: true, workers: { where: { status: 'ACTIVE' }, select: { id: true } } },
    });

    return {
      id: updated.id,
      code: updated.code,
      title: updated.name,
      departmentId: updated.departmentId,
      departmentName: updated.department.name,
      departmentCode: updated.department.code,
      isActive: updated.isActive,
      minHeadcount: updated.minHeadcount,
      baseSalary: Number(updated.baseSalary),
      allowance: Number(updated.additionalSalary),
      workDays: updated.workDays,
      restDays: updated.restDays,
      workerCount: updated.workers.length,
    };
  }

  async updateJobSalary(jobId: string, salary: number): Promise<void> {
    await this.prisma.jobTitle.update({
      where: { id: jobId },
      data: { baseSalary: salary },
    });
  }

  async listDistinctShiftCycles(): Promise<ShiftCycleOption[]> {
    const templates = await this.prisma.shiftCycleTemplate.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    if (templates.length > 0) {
      return templates.map((t) => ({
        workDays: t.workDays,
        restDays: t.restDays,
        totalCycleDays: t.totalCycleDays,
        shiftNature: t.name,
      }));
    }

    return [
      { workDays: 40, restDays: 10, totalCycleDays: 50, shiftNature: 'دورة قياسية (40+10)' },
      { workDays: 30, restDays: 10, totalCycleDays: 40, shiftNature: 'دورة قياسية (30+10)' },
      { workDays: 20, restDays: 10, totalCycleDays: 30, shiftNature: 'دورة قياسية (20+10)' },
      { workDays: 26, restDays: 4, totalCycleDays: 30, shiftNature: 'دورة حضرية (26+4)' },
    ];
  }

  async updateJobBaseSalaryWithPolicy(
    jobId: string,
    newBaseSalary: number,
    scope: 'NEW_HIRES_ONLY' | 'ALL_ACTIVE_WORKERS',
    changedByTelegramId: bigint
  ): Promise<{ affectedWorkers: Array<{ id: string; code: string; name: string; telegramId: bigint | null }>; job: JobTitleDto }> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.jobTitle.findUniqueOrThrow({
        where: { id: jobId },
        include: {
          department: true,
          workers: { where: { status: 'ACTIVE' }, select: { id: true, code: true, name: true, telegramId: true, basicSalary: true, additionalSalary: true } },
        },
      });

      const prevBase = Number(job.baseSalary);
      const prevAdd = Number(job.additionalSalary);

      await tx.jobSalaryHistory.create({
        data: {
          jobTitleId: job.id,
          previousBaseSalary: prevBase,
          previousAdditionalSalary: prevAdd,
          newBaseSalary: newBaseSalary,
          newAdditionalSalary: prevAdd,
          scope,
          affectedWorkersCount: scope === 'ALL_ACTIVE_WORKERS' ? job.workers.length : 0,
          effectiveDate: new Date(),
          changedByTelegramId,
          notes: `تعديل الراتب الأساسي للمهنة عبر مصفوفة الوظائف (${scope === 'ALL_ACTIVE_WORKERS' ? 'تطبيق على الحاليين' : 'الجدد فقط'})`,
        },
      });

      const updatedJob = await tx.jobTitle.update({
        where: { id: jobId },
        data: { baseSalary: newBaseSalary },
        include: { department: true, workers: { where: { status: 'ACTIVE' }, select: { id: true } } },
      });

      const affectedWorkers: Array<{ id: string; code: string; name: string; telegramId: bigint | null }> = [];

      if (scope === 'ALL_ACTIVE_WORKERS') {
        const now = new Date();
        const effectiveMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        for (const w of job.workers) {
          const wPrevBasic = Number(w.basicSalary || 0);
          const wPrevAdd = Number(w.additionalSalary || 0);
          const newGross = newBaseSalary + wPrevAdd;
          const newDaily = Number((newGross / 30).toFixed(2));

          await tx.worker.update({
            where: { id: w.id },
            data: {
              basicSalary: newBaseSalary,
              dailyWage: newDaily,
            },
          });

          await tx.salaryHistory.create({
            data: {
              changeId: `SAL-${Date.now().toString().slice(-6)}-${w.code.replace(/[^a-zA-Z0-9]/g, '').slice(-4)}`,
              workerId: w.id,
              previousBasicSalary: wPrevBasic,
              previousAdditionalSalary: wPrevAdd,
              previousGrossSalary: wPrevBasic + wPrevAdd,
              newBasicSalary: newBaseSalary,
              newAdditionalSalary: wPrevAdd,
              newGrossSalary: newGross,
              effectiveMonth,
              effectiveDate: now,
              reason: `تعديل سلم الراتب الأساسي لمهنة (${job.name})`,
              approvedByTelegramId: changedByTelegramId,
            },
          });

          affectedWorkers.push({
            id: w.id,
            code: w.code,
            name: w.name,
            telegramId: w.telegramId,
          });
        }
      }

      const jobDto: JobTitleDto = {
        id: updatedJob.id,
        code: updatedJob.code,
        title: updatedJob.name,
        departmentId: updatedJob.departmentId,
        departmentName: updatedJob.department.name,
        departmentCode: updatedJob.department.code,
        isActive: updatedJob.isActive,
        minHeadcount: updatedJob.minHeadcount,
        baseSalary: Number(updatedJob.baseSalary),
        allowance: Number(updatedJob.additionalSalary),
        workDays: updatedJob.workDays,
        restDays: updatedJob.restDays,
        workerCount: updatedJob.workers.length,
      };

      return { affectedWorkers, job: jobDto };
    });
  }

  async updateJobAdditionalSalaryWithPolicy(
    jobId: string,
    newAdditionalSalary: number,
    scope: 'NEW_HIRES_ONLY' | 'ALL_ACTIVE_WORKERS',
    changedByTelegramId: bigint
  ): Promise<{ affectedWorkers: Array<{ id: string; code: string; name: string; telegramId: bigint | null }>; job: JobTitleDto }> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.jobTitle.findUniqueOrThrow({
        where: { id: jobId },
        include: {
          department: true,
          workers: { where: { status: 'ACTIVE' }, select: { id: true, code: true, name: true, telegramId: true, basicSalary: true, additionalSalary: true } },
        },
      });

      const prevBase = Number(job.baseSalary);
      const prevAdd = Number(job.additionalSalary);

      await tx.jobSalaryHistory.create({
        data: {
          jobTitleId: job.id,
          previousBaseSalary: prevBase,
          previousAdditionalSalary: prevAdd,
          newBaseSalary: prevBase,
          newAdditionalSalary: newAdditionalSalary,
          scope,
          affectedWorkersCount: scope === 'ALL_ACTIVE_WORKERS' ? job.workers.length : 0,
          effectiveDate: new Date(),
          changedByTelegramId,
          notes: `تعديل الراتب الإضافي للمهنة عبر مصفوفة الوظائف (${scope === 'ALL_ACTIVE_WORKERS' ? 'تطبيق على الحاليين' : 'الجدد فقط'})`,
        },
      });

      const updatedJob = await tx.jobTitle.update({
        where: { id: jobId },
        data: { additionalSalary: newAdditionalSalary },
        include: { department: true, workers: { where: { status: 'ACTIVE' }, select: { id: true } } },
      });

      const affectedWorkers: Array<{ id: string; code: string; name: string; telegramId: bigint | null }> = [];

      if (scope === 'ALL_ACTIVE_WORKERS') {
        const now = new Date();
        const effectiveMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        for (const w of job.workers) {
          const wPrevBasic = Number(w.basicSalary || 0);
          const wPrevAdd = Number(w.additionalSalary || 0);
          const newGross = wPrevBasic + newAdditionalSalary;
          const newDaily = Number((newGross / 30).toFixed(2));

          await tx.worker.update({
            where: { id: w.id },
            data: {
              additionalSalary: newAdditionalSalary,
              dailyWage: newDaily,
            },
          });

          await tx.salaryHistory.create({
            data: {
              changeId: `SAL-${Date.now().toString().slice(-6)}-${w.code.replace(/[^a-zA-Z0-9]/g, '').slice(-4)}`,
              workerId: w.id,
              previousBasicSalary: wPrevBasic,
              previousAdditionalSalary: wPrevAdd,
              previousGrossSalary: wPrevBasic + wPrevAdd,
              newBasicSalary: wPrevBasic,
              newAdditionalSalary: newAdditionalSalary,
              newGrossSalary: newGross,
              effectiveMonth,
              effectiveDate: now,
              reason: `تعديل سلم الراتب الإضافي لمهنة (${job.name})`,
              approvedByTelegramId: changedByTelegramId,
            },
          });

          affectedWorkers.push({
            id: w.id,
            code: w.code,
            name: w.name,
            telegramId: w.telegramId,
          });
        }
      }

      const jobDto: JobTitleDto = {
        id: updatedJob.id,
        code: updatedJob.code,
        title: updatedJob.name,
        departmentId: updatedJob.departmentId,
        departmentName: updatedJob.department.name,
        departmentCode: updatedJob.department.code,
        isActive: updatedJob.isActive,
        minHeadcount: updatedJob.minHeadcount,
        baseSalary: Number(updatedJob.baseSalary),
        allowance: Number(updatedJob.additionalSalary),
        workDays: updatedJob.workDays,
        restDays: updatedJob.restDays,
        workerCount: updatedJob.workers.length,
      };

      return { affectedWorkers, job: jobDto };
    });
  }

  async updateJobCycleWithPolicy(
    jobId: string,
    workDays: number,
    restDays: number,
    policy: 'NEW_HIRES_ONLY' | 'NEXT_CYCLE',
    changedByTelegramId: bigint
  ): Promise<{ affectedWorkersCount: number; job: JobTitleDto }> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.jobTitle.findUniqueOrThrow({
        where: { id: jobId },
        include: {
          department: true,
          workers: { where: { status: 'ACTIVE' }, select: { id: true } },
        },
      });

      const totalCycleDays = workDays + restDays;
      const shiftNature = `دورة قياسية (${workDays}+${restDays})`;

      await tx.cycleTransitionHistory.create({
        data: {
          targetType: 'JOB_TITLE',
          targetId: job.id,
          targetCode: job.code,
          targetName: job.name,
          previousWorkDays: job.workDays,
          previousRestDays: job.restDays,
          previousRatio: Number((job.restDays / (job.workDays || 1)).toFixed(4)),
          newWorkDays: workDays,
          newRestDays: restDays,
          newRatio: Number((restDays / (workDays || 1)).toFixed(4)),
          transitionPolicy: policy,
          effectiveDate: new Date(),
          appliedByAdminId: changedByTelegramId,
          notes: `تحديث دورة عمل المهنة (${policy === 'NEXT_CYCLE' ? 'تطبيق على العاملين بالدورة القادمة' : 'المعينون الجدد فقط'})`,
        },
      });

      const updated = await tx.jobTitle.update({
        where: { id: jobId },
        data: {
          workDays,
          restDays,
          totalCycleDays,
          shiftNature,
        },
        include: { department: true, workers: { where: { status: 'ACTIVE' }, select: { id: true } } },
      });

      let affectedCount = 0;
      if (policy === 'NEXT_CYCLE') {
        const result = await tx.worker.updateMany({
          where: { jobTitleId: jobId, status: 'ACTIVE' },
          data: {
            shiftSystem: `${workDays} يوم عمل / ${restDays} راحة`,
          },
        });
        affectedCount = result.count;
      }

      const jobDto: JobTitleDto = {
        id: updated.id,
        code: updated.code,
        title: updated.name,
        departmentId: updated.departmentId,
        departmentName: updated.department.name,
        departmentCode: updated.department.code,
        isActive: updated.isActive,
        minHeadcount: updated.minHeadcount,
        baseSalary: Number(updated.baseSalary),
        allowance: Number(updated.additionalSalary),
        workDays: updated.workDays,
        restDays: updated.restDays,
        workerCount: updated.workers.length,
      };

      return { affectedWorkersCount: affectedCount, job: jobDto };
    });
  }

  async toggleDeptActive(deptId: string): Promise<boolean> {
    const dept = await this.prisma.department.findUniqueOrThrow({ where: { id: deptId } });
    const updated = await this.prisma.department.update({
      where: { id: deptId },
      data: { isActive: !dept.isActive },
    });
    return updated.isActive;
  }

  async importMatrixRowsAtomic(rows: MatrixImportRow[]): Promise<{ departmentsUpserted: number; jobsUpserted: number }> {
    return this.prisma.$transaction(async (tx) => {
      let deptCount = 0;
      let jobCount = 0;
      const tenant = await tx.tenant.findFirst({ where: { code: 'ALSAADA' } });
      const tenantId = tenant ? tenant.id : undefined;

      const deptMap = new Map<string, string>();

      for (const row of rows) {
        if (!row.deptCode || !row.deptName) continue;

        let deptId = deptMap.get(row.deptCode);
        if (!deptId) {
          const dept = await tx.department.upsert({
            where: { code: row.deptCode },
            update: { name: row.deptName, isActive: true },
            create: {
              code: row.deptCode,
              name: row.deptName,
              ...(tenantId ? { tenantId } : {}),
              isActive: true,
            },
          });
          deptId = dept.id;
          deptMap.set(row.deptCode, deptId);
          deptCount++;
        }

        if (row.jobCode && row.jobTitle) {
          const workDays = row.workDays > 0 ? row.workDays : 20;
          const restDays = row.restDays >= 0 ? row.restDays : 10;
          const totalCycleDays = workDays + restDays;
          const shiftNature = `دورة قياسية (${workDays}+${restDays})`;

          await tx.jobTitle.upsert({
            where: {
              departmentId_code: {
                departmentId: deptId,
                code: row.jobCode,
              },
            },
            update: {
              name: row.jobTitle,
              baseSalary: row.baseSalary,
              additionalSalary: row.additionalSalary,
              workDays,
              restDays,
              totalCycleDays,
              shiftNature,
              minHeadcount: row.minHeadcount,
              isActive: true,
            },
            create: {
              departmentId: deptId,
              code: row.jobCode,
              name: row.jobTitle,
              baseSalary: row.baseSalary,
              additionalSalary: row.additionalSalary,
              workDays,
              restDays,
              totalCycleDays,
              shiftNature,
              minHeadcount: row.minHeadcount,
              isActive: true,
            },
          });
          jobCount++;
        }
      }

      return { departmentsUpserted: deptCount, jobsUpserted: jobCount };
    });
  }
}

