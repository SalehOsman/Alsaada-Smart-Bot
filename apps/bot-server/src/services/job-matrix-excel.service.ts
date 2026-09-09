import ExcelJS from 'exceljs';
import { prisma } from '../db.js';
import { systemDataService } from './system-data.service.js';

export interface ParsedJobRow {
  deptCode: string;
  deptName: string;
  jobCode: string;
  jobTitle: string;
  baseSalary: number;
  additionalSalary: number;
  workDays: number;
  restDays: number;
  shiftNature: string;
  minHeadcount: number;
  notes?: string | undefined;
  rowNumber: number;
}

export interface ImportResult {
  success: boolean;
  totalRowsProcessed: number;
  departmentsCreated: number;
  departmentsUpdated: number;
  jobsCreated: number;
  jobsUpdated: number;
  errors: string[];
}

export class JobMatrixExcelService {
  /**
   * 📥 توليد قالب إكسيل رسمي ومعتمد لمصفوفة الأقسام والوظائف (XLSX Buffer)
   */
  async generateTemplateBuffer(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'شركة السعادة للمقاولات العامة والتعدين';
    workbook.lastModifiedBy = 'منظومة السعادة الذكية';
    workbook.created = new Date();

    // 1. ورقة البيانات الرئيسية (Data Sheet)
    const worksheet = workbook.addWorksheet('دليل الأقسام والوظائف', {
      views: [{ rightToLeft: true }],
    });

    // تعريف الأعمدة
    worksheet.columns = [
      { header: 'كود القسم *', key: 'deptCode', width: 16 },
      { header: 'اسم القسم الوظيفي *', key: 'deptName', width: 28 },
      { header: 'كود الوظيفة *', key: 'jobCode', width: 16 },
      { header: 'المسمى الوظيفي *', key: 'jobTitle', width: 32 },
      { header: 'الراتب الأساسي (ج.م)', key: 'baseSalary', width: 20 },
      { header: 'الراتب الإضافي / البدلات (ج.م)', key: 'additionalSalary', width: 24 },
      { header: 'أيام العمل بالموقع (W)', key: 'workDays', width: 20 },
      { header: 'أيام الراحة والإجازة (R)', key: 'restDays', width: 20 },
      { header: 'طبيعة الوردية', key: 'shiftNature', width: 26 },
      { header: 'حد كفاية الموقع', key: 'minHeadcount', width: 18 },
      { header: 'ملاحظات واشتراطات', key: 'notes', width: 30 },
    ];

    // تنسيق صف الترويسة (Header Styling)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' }, // كحلي إداري فخم
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      };
    });

    // إضافة صفوف نموذجية معتمدة من واقع مشاريع شركة السعادة
    const sampleRows = [
      {
        deptCode: 'OP',
        deptName: 'إدارة التشغيل والمعدات',
        jobCode: 'DRV',
        jobTitle: 'سائق لودر ومعدات ثقيلة',
        baseSalary: 7500,
        additionalSalary: 2500,
        workDays: 20,
        restDays: 10,
        shiftNature: 'دورة قياسية (20+10)',
        minHeadcount: 3,
        notes: 'رخصة درجة أولى أو معدات ثقيلة',
      },
      {
        deptCode: 'OP',
        deptName: 'إدارة التشغيل والمعدات',
        jobCode: 'OPR',
        jobTitle: 'مشغل كسارة وخط فرز',
        baseSalary: 6500,
        additionalSalary: 2000,
        workDays: 20,
        restDays: 10,
        shiftNature: 'دورة قياسية (20+10)',
        minHeadcount: 2,
        notes: 'خبرة في كسارات الفوسفات',
      },
      {
        deptCode: 'OP',
        deptName: 'إدارة التشغيل والمعدات',
        jobCode: 'HLP',
        jobTitle: 'عامل موقع وتعدين',
        baseSalary: 5000,
        additionalSalary: 1500,
        workDays: 20,
        restDays: 10,
        shiftNature: 'دورة قياسية (20+10)',
        minHeadcount: 5,
        notes: 'عمالة خدمات ومواقع',
      },
      {
        deptCode: 'MNT',
        deptName: 'إدارة الصيانة والدعم الفني',
        jobCode: 'MCH',
        jobTitle: 'فني ميكانيكا وهيدروليك',
        baseSalary: 8500,
        additionalSalary: 3000,
        workDays: 24,
        restDays: 6,
        shiftNature: 'دورة ممتدة (24+6)',
        minHeadcount: 2,
        notes: 'صيانة دورية للمعدات والمولدات',
      },
      {
        deptCode: 'SEC',
        deptName: 'إدارة الأمن والحراسة',
        jobCode: 'GRD',
        jobTitle: 'مشرف أمن وحراسة منجم',
        baseSalary: 5500,
        additionalSalary: 1000,
        workDays: 20,
        restDays: 10,
        shiftNature: 'دورة قياسية (20+10)',
        minHeadcount: 4,
        notes: 'حراسة البوابات والكسارات',
      },
      {
        deptCode: 'ADM',
        deptName: 'الشؤون الإدارية والهندسية',
        jobCode: 'ENG',
        jobTitle: 'مهندس موقع ومناجم',
        baseSalary: 12000,
        additionalSalary: 4000,
        workDays: 20,
        restDays: 10,
        shiftNature: 'دورة قياسية (20+10)',
        minHeadcount: 1,
        notes: 'بكالوريوس هندسة تعدين أو مدني',
      },
    ];

    sampleRows.forEach((row, index) => {
      const addedRow = worksheet.addRow(row);
      addedRow.height = 24;
      const isEven = index % 2 === 0;
      addedRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 3, 5, 6, 7, 8, 10].includes(colNumber) ? 'center' : 'right',
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF9FAFB' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    // 2. ورقة إرشادات التعبئة (Instructions Sheet)
    const instructionsSheet = workbook.addWorksheet('تعليمات التعبئة', {
      views: [{ rightToLeft: true }],
    });
    instructionsSheet.columns = [
      { header: 'البند', key: 'item', width: 22 },
      { header: 'القاعدة والاشتراطات', key: 'rule', width: 65 },
    ];
    instructionsSheet.getRow(1).height = 28;
    instructionsSheet.getRow(1).eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
      c.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const instructions = [
      ['كود القسم (Dept Code)', 'أحرف إنجليزية مختصرة (2-4 أحرف) بدون مسافات، مثال: OP, MNT, SEC, ADM.'],
      ['اسم القسم الوظيفي', 'الاسم الرسمي للقسم بالعربية، وسيتم تجميع كافة وظائف القسم تحته تلقائياً.'],
      ['كود الوظيفة (Job Code)', 'أحرف إنجليزية فريدة داخل نفس القسم (2-4 أحرف)، مثال: DRV, OPR, HLP, ENG.'],
      ['المسمى الوظيفي', 'اسم الوظيفة الواضح بالعربية كما يظهر في عقود العمالة وكشوف الرواتب.'],
      ['الراتب الأساسي والإضافي', 'أرقام صحيحة بالجنيه المصري (EGP). الراتب الإجمالي يُحسب تلقائياً (أساسي + إضافي).'],
      ['أيام العمل والراحة', 'أيام العمل بالموقع (W) وأيام الإجازة (R). إجمالي الدورة يُحسب تلقائياً كحاصل جمعهما.'],
      ['حد كفاية الموقع', 'الحد الأدنى لعدد العمال المطلوب تواجدهم بالوردية لضمان عدم توقف العمل.'],
      ['تحديث البيانات', 'إذا كان كود الوظيفة والقسم مسجلاً مسبقاً، سيقوم النظام بتحديث بياناته دون تكرار.'],
    ];

    instructions.forEach(([item, rule]) => {
      const r = instructionsSheet.addRow({ item, rule });
      r.height = 22;
      r.eachCell((c) => {
        c.font = { name: 'Segoe UI', size: 10 };
        c.alignment = { vertical: 'middle', horizontal: 'right' };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * 📤 قراءة وفحص واستيراد ملف الإكسيل المرفوع وتحديث قاعدة البيانات ذرياً
   */
  async parseAndImportExcel(fileBuffer: Buffer): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet =
      workbook.getWorksheet('دليل الأقسام والوظائف') || workbook.worksheets[0];

    if (!worksheet) {
      return {
        success: false,
        totalRowsProcessed: 0,
        departmentsCreated: 0,
        departmentsUpdated: 0,
        jobsCreated: 0,
        jobsUpdated: 0,
        errors: ['الملف المرفوع لا يحتوي على أي صفحات بيانات صالحة.'],
      };
    }

    const errors: string[] = [];
    const validRows: ParsedJobRow[] = [];

    // التحقق وقراءة الصفوف بدءاً من الصف 2
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Header

      const deptCodeRaw = String(row.getCell(1).value || '').trim().toUpperCase();
      const deptName = String(row.getCell(2).value || '').trim();
      const jobCodeRaw = String(row.getCell(3).value || '').trim().toUpperCase();
      const jobTitle = String(row.getCell(4).value || '').trim();

      // تجاهل الصفوف الفارغة بالكامل
      if (!deptCodeRaw && !deptName && !jobCodeRaw && !jobTitle) {
        return;
      }

      // التحقق من الحقول الإلزامية
      if (!deptCodeRaw) {
        errors.push(`صف ${rowNumber}: كود القسم مفقود.`);
        return;
      }
      if (!deptName) {
        errors.push(`صف ${rowNumber}: اسم القسم مفقود.`);
        return;
      }
      if (!jobCodeRaw) {
        errors.push(`صف ${rowNumber}: كود الوظيفة مفقود.`);
        return;
      }
      if (!jobTitle) {
        errors.push(`صف ${rowNumber}: مسمى الوظيفة مفقود.`);
        return;
      }

      // تطهير الأكواد
      const deptCode = deptCodeRaw.replace(/[^A-Z0-9_-]/g, '');
      const jobCode = jobCodeRaw.replace(/[^A-Z0-9_-]/g, '');

      if (!deptCode || deptCode.length < 2) {
        errors.push(`صف ${rowNumber}: كود القسم (${deptCodeRaw}) غير صالح (يجب أن يكون حرفين لاتينيين على الأقل).`);
        return;
      }
      if (!jobCode || jobCode.length < 2) {
        errors.push(`صف ${rowNumber}: كود الوظيفة (${jobCodeRaw}) غير صالح.`);
        return;
      }

      // قراءة الأرقام مع قيم افتراضية آمنة
      const baseSalary = Math.max(0, parseFloat(String(row.getCell(5).value || '0').replace(/[^0-9.]/g, '')) || 0);
      const additionalSalary = Math.max(0, parseFloat(String(row.getCell(6).value || '0').replace(/[^0-9.]/g, '')) || 0);
      const workDays = Math.max(1, parseInt(String(row.getCell(7).value || '20').replace(/[^0-9]/g, ''), 10) || 20);
      const restDays = Math.max(0, parseInt(String(row.getCell(8).value || '10').replace(/[^0-9]/g, ''), 10) || 10);
      const shiftNature = String(row.getCell(9).value || '').trim() || `دورة (${workDays}+${restDays})`;
      const minHeadcount = Math.max(1, parseInt(String(row.getCell(10).value || '1').replace(/[^0-9]/g, ''), 10) || 1);
      const notes = String(row.getCell(11).value || '').trim() || undefined;

      validRows.push({
        deptCode,
        deptName,
        jobCode,
        jobTitle,
        baseSalary,
        additionalSalary,
        workDays,
        restDays,
        shiftNature,
        minHeadcount,
        notes,
        rowNumber,
      });
    });

    if (validRows.length === 0) {
      return {
        success: false,
        totalRowsProcessed: 0,
        departmentsCreated: 0,
        departmentsUpdated: 0,
        jobsCreated: 0,
        jobsUpdated: 0,
        errors: errors.length > 0 ? errors : ['لم يتم العثور على أي صفوف بيانات صالحة في الملف المرفوع.'],
      };
    }

    // تجميع الأقسام الفريدة لتنفيذها ذرياً
    const uniqueDeptsMap = new Map<string, string>();
    validRows.forEach((r) => {
      uniqueDeptsMap.set(r.deptCode, r.deptName);
    });

    let departmentsCreated = 0;
    let departmentsUpdated = 0;
    let jobsCreated = 0;
    let jobsUpdated = 0;

    // تنفيذ المعاملة الذرية (Atomic Upsert Transaction)
    await prisma.$transaction(async (tx) => {
      // 1. مزامنة الأقسام
      const deptDbMap = new Map<string, string>(); // code -> id

      for (const [code, name] of uniqueDeptsMap.entries()) {
        const existing = await tx.department.findUnique({ where: { code } });
        if (existing) {
          const updated = await tx.department.update({
            where: { code },
            data: { name, isActive: true },
          });
          deptDbMap.set(code, updated.id);
          departmentsUpdated++;
        } else {
          const created = await tx.department.create({
            data: { code, name, isActive: true },
          });
          deptDbMap.set(code, created.id);
          departmentsCreated++;
        }
      }

      // 2. مزامنة الوظائف
      for (const r of validRows) {
        const departmentId = deptDbMap.get(r.deptCode);
        if (!departmentId) continue;

        const totalCycleDays = r.workDays + r.restDays;
        const totalSalary = r.baseSalary + r.additionalSalary;

        const existingJob = await tx.jobTitle.findUnique({
          where: {
            departmentId_code: {
              departmentId,
              code: r.jobCode,
            },
          },
        });

        if (existingJob) {
          await tx.jobTitle.update({
            where: { id: existingJob.id },
            data: {
              name: r.jobTitle,
              baseSalary: r.baseSalary,
              additionalSalary: r.additionalSalary,
              baseWageGuideline: totalSalary,
              workDays: r.workDays,
              restDays: r.restDays,
              totalCycleDays,
              shiftNature: r.shiftNature,
              minHeadcount: r.minHeadcount,
              notes: r.notes ?? null,
              isActive: true,
            },
          });
          jobsUpdated++;
        } else {
          await tx.jobTitle.create({
            data: {
              departmentId,
              code: r.jobCode,
              name: r.jobTitle,
              baseSalary: r.baseSalary,
              additionalSalary: r.additionalSalary,
              baseWageGuideline: totalSalary,
              workDays: r.workDays,
              restDays: r.restDays,
              totalCycleDays,
              shiftNature: r.shiftNature,
              minHeadcount: r.minHeadcount,
              notes: r.notes ?? null,
              isActive: true,
            },
          });
          jobsCreated++;
        }
      }
    });

    // تطهير كاش L1 و L2
    await systemDataService.invalidateDepartmentsAndJobs();

    return {
      success: true,
      totalRowsProcessed: validRows.length,
      departmentsCreated,
      departmentsUpdated,
      jobsCreated,
      jobsUpdated,
      errors,
    };
  }
}

export const jobMatrixExcelService = new JobMatrixExcelService();
