import type { PrismaClient } from '@alsaada/database';
import type { DepartmentDto, JobTitleDto } from './flow.types.js';

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

  async toggleDeptActive(deptId: string): Promise<boolean> {
    const dept = await this.prisma.department.findUniqueOrThrow({ where: { id: deptId } });
    const updated = await this.prisma.department.update({
      where: { id: deptId },
      data: { isActive: !dept.isActive },
    });
    return updated.isActive;
  }
}
