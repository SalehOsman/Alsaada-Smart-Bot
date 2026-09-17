import ExcelJS from 'exceljs';
import type { JobMatrixRepository } from './flow.repository.js';
import type {
  DepartmentDto,
  JobTitleDto,
  JobMatrixEditState,
  MatrixImportResult,
  MatrixImportRow,
  ShiftCycleOption,
} from './flow.types.js';

export class JobMatrixService {
  private readonly pendingEdits = new Map<string, JobMatrixEditState>();

  constructor(private readonly repository: JobMatrixRepository) {}

  setPendingEdit(userId: string | number | bigint, state: JobMatrixEditState): void {
    this.pendingEdits.set(String(userId), state);
  }

  getPendingEdit(userId: string | number | bigint): JobMatrixEditState | undefined {
    return this.pendingEdits.get(String(userId));
  }

  clearPendingEdit(userId: string | number | bigint): void {
    this.pendingEdits.delete(String(userId));
  }

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

  async listDistinctShiftCycles(): Promise<ShiftCycleOption[]> {
    return this.repository.listDistinctShiftCycles();
  }

  async updateJobCycle(jobId: string, workDays: number, restDays: number): Promise<JobTitleDto> {
    return this.repository.updateJobCycle(jobId, workDays, restDays);
  }

  async updateJobCycleWithPolicy(
    jobId: string,
    workDays: number,
    restDays: number,
    policy: 'NEW_HIRES_ONLY' | 'NEXT_CYCLE',
    changedByTelegramId: bigint
  ): Promise<{ affectedWorkersCount: number; job: JobTitleDto }> {
    return this.repository.updateJobCycleWithPolicy(jobId, workDays, restDays, policy, changedByTelegramId);
  }

  async updateJobSalary(jobId: string, salary: number): Promise<void> {
    return this.repository.updateJobSalary(jobId, salary);
  }

  async updateJobBaseSalaryWithPolicy(
    jobId: string,
    newBaseSalary: number,
    scope: 'NEW_HIRES_ONLY' | 'ALL_ACTIVE_WORKERS',
    changedByTelegramId: bigint
  ): Promise<{ affectedWorkers: Array<{ id: string; code: string; name: string; telegramId: bigint | null }>; job: JobTitleDto }> {
    return this.repository.updateJobBaseSalaryWithPolicy(jobId, newBaseSalary, scope, changedByTelegramId);
  }

  async updateJobAdditionalSalaryWithPolicy(
    jobId: string,
    newAdditionalSalary: number,
    scope: 'NEW_HIRES_ONLY' | 'ALL_ACTIVE_WORKERS',
    changedByTelegramId: bigint
  ): Promise<{ affectedWorkers: Array<{ id: string; code: string; name: string; telegramId: bigint | null }>; job: JobTitleDto }> {
    return this.repository.updateJobAdditionalSalaryWithPolicy(jobId, newAdditionalSalary, scope, changedByTelegramId);
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
      { header: 'الراتب الإضافي (ج.م)', key: 'additionalSalary', width: 20 },
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
            additionalSalary: j.allowance,
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
          additionalSalary: 0,
          workDays: 20,
          restDays: 10,
          minHeadcount: 1,
        });
      }
    }

    const uint8 = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8);
  }

  async parseAndImportExcel(buffer: Buffer): Promise<MatrixImportResult> {
    const errors: string[] = [];
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return {
          success: false,
          departmentsUpserted: 0,
          jobsUpserted: 0,
          errors: ['الملف المرفوع فارغ أو لا يحتوي على أي ورقة عمل (Worksheet).'],
        };
      }

      // Strict Header Validation
      const headerRow = worksheet.getRow(1);
      const h1 = this.extractCellValue(headerRow.getCell(1).value);
      const h2 = this.extractCellValue(headerRow.getCell(2).value);
      const h3 = this.extractCellValue(headerRow.getCell(3).value);
      const h4 = this.extractCellValue(headerRow.getCell(4).value);
      const h5 = this.extractCellValue(headerRow.getCell(5).value);
      const h6 = this.extractCellValue(headerRow.getCell(6).value);
      const h7 = this.extractCellValue(headerRow.getCell(7).value);
      const h8 = this.extractCellValue(headerRow.getCell(8).value);

      const isHeaderValid =
        h1.includes('كود القسم') &&
        h2.includes('اسم القسم') &&
        h3.includes('كود الوظيفة') &&
        h4.includes('المسمى الوظيفي') &&
        h5.includes('الأساسي') &&
        h6.includes('الإضافي') &&
        h7.includes('أيام العمل') &&
        h8.includes('أيام الراحة');

      if (!isHeaderValid) {
        return {
          success: false,
          departmentsUpserted: 0,
          jobsUpserted: 0,
          errors: [
            'عناوين أعمدة ملف الإكسيل غير مطابقة للقالب الرسمي المعتمد. يرجى تنزيل القالب المحدث متضمناً عمود «الراتب الإضافي (ج.م)» وإعادة المحاولة.',
          ],
        };
      }

      const rowsToImport: MatrixImportRow[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const deptCode = this.extractCellValue(row.getCell(1).value);
        const deptName = this.extractCellValue(row.getCell(2).value);
        const jobCode = this.extractCellValue(row.getCell(3).value);
        const jobTitle = this.extractCellValue(row.getCell(4).value);
        const baseSalary = this.extractCellNumber(row.getCell(5).value, 0);
        const additionalSalary = this.extractCellNumber(row.getCell(6).value, 0);
        const workDays = this.extractCellNumber(row.getCell(7).value, 20);
        const restDays = this.extractCellNumber(row.getCell(8).value, 10);
        const minHeadcount = this.extractCellNumber(row.getCell(9).value, 1);

        // If completely empty row, ignore
        if (!deptCode && !deptName && !jobCode && !jobTitle) return;

        if (!deptCode || !deptName) {
          errors.push(`السطر ${rowNumber}: يجب تحديد كود القسم واسم القسم.`);
          return;
        }

        if ((jobCode && !jobTitle) || (!jobCode && jobTitle)) {
          errors.push(`السطر ${rowNumber}: يجب تحديد كود الوظيفة واسم الوظيفة معاً.`);
          return;
        }

        // Sanity range checks
        if (workDays < 1 || workDays > 60) {
          errors.push(`السطر ${rowNumber}: أيام العمل غير منطقية (${workDays}). يجب أن تكون بين 1 و 60 يوماً.`);
          return;
        }

        if (restDays < 0 || restDays > 30) {
          errors.push(`السطر ${rowNumber}: أيام الراحة غير منطقية (${restDays}). يجب أن تكون بين 0 و 30 يوماً.`);
          return;
        }

        if (baseSalary < 0) {
          errors.push(`السطر ${rowNumber}: الراتب الأساسي لا يمكن أن يكون سالباً.`);
          return;
        }

        if (additionalSalary < 0) {
          errors.push(`السطر ${rowNumber}: الراتب الإضافي لا يمكن أن يكون سالباً.`);
          return;
        }

        rowsToImport.push({
          deptCode,
          deptName,
          jobCode,
          jobTitle,
          baseSalary: Math.max(0, baseSalary),
          additionalSalary: Math.max(0, additionalSalary),
          workDays,
          restDays,
          minHeadcount: Math.max(1, minHeadcount),
        });
      });

      if (errors.length > 0) {
        return {
          success: false,
          departmentsUpserted: 0,
          jobsUpserted: 0,
          errors,
        };
      }

      if (rowsToImport.length === 0) {
        return {
          success: false,
          departmentsUpserted: 0,
          jobsUpserted: 0,
          errors: ['لم يتم العثور على أي صفوف صالحة للاستيراد في الملف.'],
        };
      }

      const result = await this.repository.importMatrixRowsAtomic(rowsToImport);

      return {
        success: true,
        departmentsUpserted: result.departmentsUpserted,
        jobsUpserted: result.jobsUpserted,
        errors,
      };
    } catch (err) {
      return {
        success: false,
        departmentsUpserted: 0,
        jobsUpserted: 0,
        errors: [`حدث خطأ أثناء قراءة ملف الإكسيل: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }

  private extractCellValue(val: ExcelJS.CellValue): string {
    if (val == null) return '';
    if (typeof val === 'object') {
      if ('text' in val && typeof val.text === 'string') return val.text.trim();
      if ('result' in val && val.result != null) return String(val.result).trim();
    }
    return String(val).trim();
  }

  private extractCellNumber(val: ExcelJS.CellValue, fallback: number): number {
    if (val == null) return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    if (typeof val === 'object' && 'result' in val && typeof val.result === 'number') {
      return isNaN(val.result) ? fallback : val.result;
    }
    const str = this.extractCellValue(val);
    const parsed = parseFloat(str.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? fallback : parsed;
  }
}
