import ExcelJS from 'exceljs';
import type { JobMatrixRepository } from './flow.repository.js';
import type { DepartmentDto, JobTitleDto } from './flow.types.js';

export class JobMatrixService {
  constructor(private readonly repository: JobMatrixRepository) {}

  async listDepartments(): Promise<DepartmentDto[]> {
    return this.repository.listDepartments();
  }

  async getDepartmentWithJobs(code: string): Promise<{ dept: DepartmentDto; jobs: JobTitleDto[] } | null> {
    return this.repository.getDepartmentWithJobs(code);
  }

  async getJob(deptCode: string, jobCode: string): Promise<JobTitleDto | null> {
    return this.repository.getJob(deptCode, jobCode);
  }

  async updateHeadcountDelta(jobId: string, delta: number): Promise<JobTitleDto> {
    return this.repository.updateJobHeadcountDelta(jobId, delta);
  }

  async toggleJobActive(jobId: string): Promise<JobTitleDto> {
    return this.repository.toggleJobActive(jobId);
  }

  async updateJobCycle(jobId: string, workDays: number, restDays: number): Promise<JobTitleDto> {
    return this.repository.updateJobCycle(jobId, workDays, restDays);
  }

  async updateJobSalary(jobId: string, salary: number): Promise<void> {
    return this.repository.updateJobSalary(jobId, salary);
  }

  async toggleDeptActive(deptId: string): Promise<boolean> {
    return this.repository.toggleDeptActive(deptId);
  }

  async generateExcelTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'شركة السعادة للمقاولات العامة';
    const worksheet = workbook.addWorksheet('دليل الأقسام والوظائف', { views: [{ rightToLeft: true }] });

    worksheet.columns = [
      { header: 'كود القسم *', key: 'deptCode', width: 16 },
      { header: 'اسم القسم الوظيفي *', key: 'deptName', width: 28 },
      { header: 'كود الوظيفة *', key: 'jobCode', width: 16 },
      { header: 'المسمى الوظيفي *', key: 'jobTitle', width: 32 },
      { header: 'الراتب الأساسي (ج.م)', key: 'baseSalary', width: 20 },
      { header: 'أيام العمل بالموقع (W)', key: 'workDays', width: 20 },
      { header: 'أيام الراحة والإجازة (R)', key: 'restDays', width: 20 },
      { header: 'حد كفاية الموقع', key: 'minHeadcount', width: 18 },
    ];

    const depts = await this.repository.listDepartments();
    for (const d of depts) {
      const full = await this.repository.getDepartmentWithJobs(d.code);
      if (full && full.jobs.length > 0) {
        for (const j of full.jobs) {
          worksheet.addRow({
            deptCode: d.code,
            deptName: d.name,
            jobCode: j.code,
            jobTitle: j.title,
            baseSalary: j.baseSalary,
            workDays: j.workDays,
            restDays: j.restDays,
            minHeadcount: j.minHeadcount,
          });
        }
      } else {
        worksheet.addRow({
          deptCode: d.code,
          deptName: d.name,
          jobCode: '',
          jobTitle: '',
          baseSalary: 0,
          workDays: 30,
          restDays: 10,
          minHeadcount: 1,
        });
      }
    }

    const uint8 = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8);
  }
}
