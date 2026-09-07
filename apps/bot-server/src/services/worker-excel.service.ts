import ExcelJS from 'exceljs';
import { prisma } from '../db.js';
import { workerService, CreateWorkerInput } from './worker.service.js';
import { parseEgyptianNationalId } from '@alsaada/national-id-engine';
import { normalizeDigits, formatDate } from '@alsaada/regional-engine';

export interface WorkerRowData {
  rowNumber: number;
  fullName: string;
  nickname?: string;
  legacyCode?: string;
  idType: 'NATIONAL_ID' | 'PASSPORT';
  idNumber: string;
  nationality: string;
  birthDate?: Date;
  gender?: 'MALE' | 'FEMALE';
  phone: string;
  jobCode: string;
  siteCode: string;
  hireDate?: Date;
  paymentMethod: string;
  accountNumber?: string;
  notes?: string;
}

export interface WorkerImportResult {
  success: boolean;
  totalRowsProcessed: number;
  workersCreated: number;
  errors: string[];
  createdWorkers?: { code: string; name: string }[];
}

export class WorkerExcelService {
  /**
   * 📥 توليد قالب إكسيل معتمد لتسجيل واستيراد العمالة (XLSX Buffer)
   */
  async generateTemplateBuffer(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'شركة السعادة للمقاولات العامة والتعدين';
    workbook.lastModifiedBy = 'منظومة السعادة الذكية';
    workbook.created = new Date();

    // 1. ورقة إدخال بيانات العمال (Data Sheet)
    const dataSheet = workbook.addWorksheet('بيانات العمال الجدد', {
      views: [{ rightToLeft: true }],
    });

    dataSheet.columns = [
      { header: 'الاسم الرباعي *', key: 'fullName', width: 30 },
      { header: 'اسم الشهرة', key: 'nickname', width: 18 },
      { header: 'كود العامل القديم / الأرشيفي (إن وجد)', key: 'legacyCode', width: 26 },
      { header: 'نوع الإثبات (رقم قومي / جواز سفر) *', key: 'idType', width: 28 },
      { header: 'رقم الإثبات (القومي أو الجواز) *', key: 'idNumber', width: 28 },
      { header: 'الجنسية', key: 'nationality', width: 18 },
      { header: 'تاريخ الميلاد (للجواز YYYY-MM-DD)', key: 'birthDate', width: 26 },
      { header: 'النوع (ذكر / أنثى)', key: 'gender', width: 18 },
      { header: 'رقم الهاتف والواتساب *', key: 'phone', width: 22 },
      { header: 'كود الوظيفة *', key: 'jobCode', width: 16 },
      { header: 'كود الموقع *', key: 'siteCode', width: 16 },
      { header: 'تاريخ المباشرة (YYYY-MM-DD)', key: 'hireDate', width: 24 },
      { header: 'طريقة استلام الراتب', key: 'paymentMethod', width: 22 },
      { header: 'رقم المحفظة / الحساب', key: 'accountNumber', width: 24 },
      { header: 'ملاحظات', key: 'notes', width: 28 },
    ];

    // تنسيق صف الترويسة
    const headerRow = dataSheet.getRow(1);
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

    // إضافة صفوف نموذجية توضيحية
    dataSheet.addRow({
      fullName: 'محمد أحمد إبراهيم علي (نموذج مصري)',
      nickname: 'أبو حميد',
      legacyCode: '106',
      idType: 'رقم قومي',
      idNumber: '29505121401234',
      nationality: 'مصر',
      birthDate: '',
      gender: 'ذكر',
      phone: '01012345678',
      jobCode: 'DRV',
      siteCode: 'STE-01',
      hireDate: '2026-09-01',
      paymentMethod: 'استلام نقدي بالخزينة',
      accountNumber: '-',
      notes: 'سائق لودر ممتاز',
    });

    dataSheet.addRow({
      fullName: 'عمر بابكر يعقوب إدريس (نموذج وافد)',
      nickname: 'عمر',
      legacyCode: '101',
      idType: 'جواز سفر',
      idNumber: 'P10492837',
      nationality: 'السودان',
      birthDate: '1992-04-15',
      gender: 'ذكر',
      phone: '01298765432',
      jobCode: 'HLP',
      siteCode: 'STE-01',
      hireDate: '2026-09-01',
      paymentMethod: 'فودافون كاش',
      accountNumber: '01298765432',
      notes: 'عامل تشغيل وخدمات',
    });

    // 2. ورقة الأكواد المعتمدة بالمنظومة (Reference Codes Sheet)
    const refSheet = workbook.addWorksheet('دليل الأكواد المعتمدة', {
      views: [{ rightToLeft: true }],
    });

    refSheet.columns = [
      { header: 'نوع الكود', key: 'type', width: 18 },
      { header: 'الكود المعتمد', key: 'code', width: 18 },
      { header: 'الاسم والبيان الرسمي', key: 'name', width: 32 },
      { header: 'القسم / المشروع التابع له', key: 'parent', width: 28 },
    ];

    const refHeader = refSheet.getRow(1);
    refHeader.height = 28;
    refHeader.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF134E5E' }, // تيل / بترولي
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
      };
    });

    // جلب الوظائف والمواقع الحية من قاعدة البيانات
    const [jobs, sites] = await Promise.all([
      prisma.jobTitle.findMany({
        where: { isActive: true },
        include: { department: true },
        orderBy: [{ department: { order: 'asc' } }, { order: 'asc' }],
      }),
      prisma.site.findMany({
        where: { status: 'ACTIVE' },
        include: { project: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    // تعبئة الأكواد المرجعية
    for (const job of jobs) {
      refSheet.addRow({
        type: 'وظيفة',
        code: job.code,
        name: job.name,
        parent: `${job.department.name} (${job.department.code})`,
      });
    }

    for (const site of sites) {
      refSheet.addRow({
        type: 'موقع عمل',
        code: site.code,
        name: site.name,
        parent: site.project?.name || 'عام',
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  /**
   * 📤 فحص وتحليل ملف الإكسيل المرفوع واستيراد العمالة
   */
  async parseAndImportExcel(buffer: Buffer): Promise<WorkerImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        success: false,
        totalRowsProcessed: 0,
        workersCreated: 0,
        errors: ['الملف المرفوع لا يحتوي على أي ورقة عمل صالحة.'],
      };
    }

    // جلب الأكواد المعتمدة في الذاكرة للتحقق فائق السرعة
    const [jobsList, sitesList] = await Promise.all([
      prisma.jobTitle.findMany({
        where: { isActive: true },
        include: { department: true },
      }),
      prisma.site.findMany({
        where: { status: 'ACTIVE' },
      }),
    ]);

    const jobsMap = new Map(jobsList.map((j) => [j.code.toUpperCase(), j]));
    const sitesMap = new Map(sitesList.map((s) => [s.code.toUpperCase(), s]));

    const rowsToProcess: WorkerRowData[] = [];
    const errors: string[] = [];
    const seenIdsInFile = new Set<string>();

    const rowCount = worksheet.rowCount;
    if (rowCount <= 1) {
      return {
        success: false,
        totalRowsProcessed: 0,
        workersCreated: 0,
        errors: ['الملف فارغ ولا يحتوي على أي صفوف بيانات للعمال.'],
      };
    }

    // قراءة الصفوف بدءاً من الصف 2
    for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (!row || !row.hasValues) continue;

      const rawFullName = row.getCell(1).text?.trim();
      // تجاهل صفوف النماذج التوضيحية إن تركت دون تعديل
      if (!rawFullName || rawFullName.includes('(نموذج مصري)') || rawFullName.includes('(نموذج وافد)')) {
        continue;
      }

      const nickname = row.getCell(2).text?.trim();
      const legacyCode = row.getCell(3).text?.trim();
      const rawIdType = row.getCell(4).text?.trim().toLowerCase() || '';
      const rawIdNumber = row.getCell(5).text?.trim();
      const nationality = row.getCell(6).text?.trim() || (rawIdType.includes('جواز') || rawIdType.includes('pass') ? 'وافد' : 'مصر');
      const rawBirthDate = row.getCell(7).text?.trim();
      const rawGender = row.getCell(8).text?.trim().toLowerCase();
      const rawPhone = row.getCell(9).text?.trim();
      const rawJobCode = row.getCell(10).text?.trim().toUpperCase();
      const rawSiteCode = row.getCell(11).text?.trim().toUpperCase();
      const rawHireDate = row.getCell(12).text?.trim();
      const paymentMethod = row.getCell(13).text?.trim() || 'CASH_SITE';
      const accountNumber = row.getCell(14).text?.trim() || '-';
      const notes = row.getCell(15).text?.trim();

      const lineRef = `السطر ${rowNumber} [${rawFullName}]`;

      // 1. التحقق من الاسم
      if (rawFullName.length < 5) {
        errors.push(`${lineRef}: الاسم قصير جداً (يجب أن يكون الاسم رباعياً).`);
        continue;
      }

      // 2. نوع ورقم الإثبات
      const isPassport = rawIdType.includes('جواز') || rawIdType.includes('pass');
      const idType: 'NATIONAL_ID' | 'PASSPORT' = isPassport ? 'PASSPORT' : 'NATIONAL_ID';
      const cleanId = normalizeDigits(rawIdNumber.replace(/[\s-]/g, '').toUpperCase());

      if (!cleanId) {
        errors.push(`${lineRef}: رقم الإثبات (القومي / الجواز) فارغ.`);
        continue;
      }

      // فحص التكرار داخل نفس الملف
      if (seenIdsInFile.has(cleanId)) {
        errors.push(`${lineRef}: رقم الإثبات (${cleanId}) مكرر في نفس الملف.`);
        continue;
      }
      seenIdsInFile.add(cleanId);

      // التحقق من صحة الرقم القومي أو الجواز
      let parsedBirthDate: Date | undefined;
      let parsedGender: 'MALE' | 'FEMALE' | undefined = rawGender.includes('أنثى') || rawGender.includes('female') ? 'FEMALE' : 'MALE';

      if (idType === 'NATIONAL_ID') {
        const nidParsed = parseEgyptianNationalId(cleanId);
        if (!nidParsed.isValid || !nidParsed.info) {
          errors.push(`${lineRef}: الرقم القومي (${cleanId}) غير صالح (${nidParsed.error || 'صيغة خاطئة'}).`);
        } else {
          parsedBirthDate = nidParsed.info.birthDate;
          parsedGender = nidParsed.info.gender;
        }
      } else {
        // جواز سفر
        if (cleanId.length < 5 || cleanId.length > 20) {
          errors.push(`${lineRef}: رقم جواز السفر (${cleanId}) غير صالح (يجب أن يكون بين 5 و 20 رمزاً).`);
        }
        if (!rawBirthDate) {
          errors.push(`${lineRef}: تاريخ الميلاد إلزامي لبيانات جواز السفر (صيغة: YYYY-MM-DD).`);
        } else {
          const bDate = new Date(rawBirthDate);
          if (isNaN(bDate.getTime())) {
            errors.push(`${lineRef}: تاريخ الميلاد (${rawBirthDate}) غير صالح تقويمياً.`);
          } else {
            parsedBirthDate = bDate;
          }
        }
      }

      // 3. التحقق من رقم الهاتف
      const cleanPhone = normalizeDigits(rawPhone.replace(/[\s-]/g, ''));
      if (!cleanPhone || cleanPhone.length < 8) {
        errors.push(`${lineRef}: رقم الهاتف (${rawPhone}) غير صحيح.`);
      }

      // 4. التحقق من كود الوظيفة
      if (!rawJobCode || !jobsMap.has(rawJobCode)) {
        errors.push(`${lineRef}: كود الوظيفة (${rawJobCode}) غير مسجل بالنظام. راجع ورقة [دليل الأكواد المعتمدة].`);
      }

      // 5. التحقق من كود الموقع
      if (!rawSiteCode || !sitesMap.has(rawSiteCode)) {
        errors.push(`${lineRef}: كود الموقع (${rawSiteCode}) غير مسجل بالنظام. راجع ورقة [دليل الأكواد المعتمدة].`);
      }

      // 6. تاريخ المباشرة
      let hireDate: Date | undefined;
      if (rawHireDate) {
        const hDate = new Date(rawHireDate);
        if (!isNaN(hDate.getTime())) {
          hireDate = hDate;
        }
      }

      rowsToProcess.push({
        rowNumber,
        fullName: rawFullName,
        nickname,
        legacyCode,
        idType,
        idNumber: cleanId,
        nationality,
        birthDate: parsedBirthDate,
        gender: parsedGender,
        phone: cleanPhone,
        jobCode: rawJobCode,
        siteCode: rawSiteCode,
        hireDate,
        paymentMethod,
        accountNumber,
        notes,
      });
    }

    // إذا وُجدت أخطاء في التنسيق أو البيانات، نوقف العملية ونعرض الأخطاء لمنع الإدخال الجزئي المشوه
    if (errors.length > 0) {
      return {
        success: false,
        totalRowsProcessed: rowsToProcess.length + errors.length,
        workersCreated: 0,
        errors,
      };
    }

    if (rowsToProcess.length === 0) {
      return {
        success: false,
        totalRowsProcessed: 0,
        workersCreated: 0,
        errors: ['لم يتم العثور على أي صفوف صالحة للتسجيل بالملف.'],
      };
    }

    // 7. فحص الازدواجية ضد قاعدة البيانات لجميع الأسطر قبل الحفظ
    for (const r of rowsToProcess) {
      const dupCheck = await workerService.checkDuplicate(r.idType, r.idNumber);
      if (dupCheck.isDuplicate && dupCheck.existingWorker) {
        errors.push(
          `السطر ${r.rowNumber}: العامل (${r.fullName}) رقم إثباته (${r.idNumber}) مسجل مسبقاً للعامل (${dupCheck.existingWorker.name}) كود (${dupCheck.existingWorker.code}).`
        );
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        totalRowsProcessed: rowsToProcess.length,
        workersCreated: 0,
        errors,
      };
    }

    // 8. الحفظ والتسجيل الفعلي لجميع العمال
    const createdWorkers: { code: string; name: string }[] = [];
    for (const r of rowsToProcess) {
      const job = jobsMap.get(r.jobCode)!;
      const site = sitesMap.get(r.siteCode)!;

      const created = await workerService.createWorker({
        name: r.fullName,
        nickname: r.nickname,
        legacyCode: r.legacyCode,
        idType: r.idType,
        idNumber: r.idNumber,
        nationality: r.nationality,
        birthDate: r.birthDate,
        gender: r.gender,
        phone: r.phone,
        jobTitleId: job.id,
        jobTitleName: job.name,
        departmentId: job.departmentId,
        siteId: site.id,
        siteName: site.name,
        hireDate: r.hireDate,
        dailyWage: Number(job.baseSalary) > 0 ? Number(job.baseSalary) / 30 : 0,
        basicSalary: Number(job.baseSalary),
        fixedAllowances: Number(job.additionalSalary),
        paymentMethod: r.paymentMethod,
        accountNumber: r.accountNumber,
        notes: r.notes,
      });

      createdWorkers.push({ code: created.worker.code, name: created.worker.name });
    }

    return {
      success: true,
      totalRowsProcessed: rowsToProcess.length,
      workersCreated: createdWorkers.length,
      errors: [],
      createdWorkers,
    };
  }
}

export const workerExcelService = new WorkerExcelService();
