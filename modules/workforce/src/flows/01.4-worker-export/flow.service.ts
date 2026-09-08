import ExcelJS from 'exceljs';
import type { Prisma } from '@alsaada/database';
import { decryptField } from '@alsaada/database';
import { parseEgyptianNationalId, EGYPTIAN_GOVERNORATES } from '@alsaada/national-id-engine';
import { normalizeDigits, formatDateDMY } from '@alsaada/regional-engine';
import { WorkerExportRepository } from './flow.repository.js';
import { WorkerExportValidators } from './flow.validators.js';
import type {
  WorkerExportFilter,
  WorkerExportResult,
  WorkerImportResult,
  WorkerRowData,
  WorkerExportEntity,
} from './flow.types.js';

export class WorkerExportService {
  constructor(
    private readonly repository: WorkerExportRepository,
    private readonly encryptionKey?: string
  ) {}

  private safeDecrypt(value: string | null | undefined): string {
    if (!value) return '';
    if (!this.encryptionKey) return value;
    try {
      return decryptField(value, this.encryptionKey);
    } catch {
      return value;
    }
  }

  async generateTemplateBuffer(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'شركة السعادة للمقاولات العامة والتعدين';
    workbook.lastModifiedBy = 'منظومة السعادة الذكية';
    workbook.created = new Date();

    const dataSheet = workbook.addWorksheet('بيانات العمال الجدد', {
      views: [{ rightToLeft: true }],
    });

    dataSheet.columns = [
      { header: 'الاسم الرباعي *', key: 'fullName', width: 30 }, { header: 'اسم الشهرة', key: 'nickname', width: 18 },
      { header: 'كود العامل القديم / الأرشيفي (إن وجد)', key: 'legacyCode', width: 26 },
      { header: 'نوع الإثبات (رقم قومي / جواز سفر) *', key: 'idType', width: 28 },
      { header: 'رقم الإثبات (القومي أو الجواز) *', key: 'idNumber', width: 28 },
      { header: 'الجنسية', key: 'nationality', width: 18 },
      { header: 'تاريخ الميلاد (للجواز YYYY-MM-DD)', key: 'birthDate', width: 26 },
      { header: 'النوع (ذكر / أنثى)', key: 'gender', width: 18 },
      { header: 'رقم الهاتف والواتساب *', key: 'phone', width: 22 },
      { header: 'كود الوظيفة *', key: 'jobCode', width: 16 }, { header: 'كود الموقع *', key: 'siteCode', width: 16 },
      { header: 'تاريخ المباشرة (YYYY-MM-DD)', key: 'hireDate', width: 24 },
      { header: 'طريقة استلام الراتب', key: 'paymentMethod', width: 22 },
      { header: 'نوع المحفظة / القناة', key: 'walletType', width: 22 },
      { header: 'رقم المحفظة / الحساب', key: 'accountNumber', width: 24 },
      { header: 'رخصة القيادة', key: 'drivingLicense', width: 22 },
      { header: 'الموقف التجنيدي', key: 'militaryStatus', width: 26 },
      { header: 'هاتف الطوارئ', key: 'emergencyPhone', width: 20 },
      { header: 'التأمين السابق', key: 'previousInsuranceStatus', width: 22 },
      { header: 'الحالة الاجتماعية', key: 'maritalStatus', width: 20 },
      { header: 'ملاحظات', key: 'notes', width: 28 },
    ];

    const headerRow = dataSheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'medium', color: { argb: 'FF0D233A' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });

    const exampleRow = dataSheet.getRow(2);
    exampleRow.values = [
      'محمود السيد أحمد علي',
      'حودة',
      'LEG-1002',
      'رقم قومي',
      '29508202801234',
      'مصري',
      '',
      'ذكر',
      '01012345678',
      'JOB-01',
      'SITE-01',
      '2026-01-01',
      'كاش بالموقع',
      '',
      '',
      'درجة ثانية',
      'إعفاء نهائي',
      '01098765432',
      'ساري',
      'متزوج',
      'مثال توضيحي لكيفية ملء القالب',
    ];
    exampleRow.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF7F8C8D' } };

    const refSheet = workbook.addWorksheet('دليل الأكواد المعتمدة', {
      views: [{ rightToLeft: true }],
    });

    const activeJobs = await this.repository.getActiveJobs();
    const activeSites = await this.repository.getActiveSites();

    refSheet.getCell('A1').value = 'كود الوظيفة';
    refSheet.getCell('B1').value = 'مسمى الوظيفة';
    refSheet.getCell('D1').value = 'كود الموقع';
    refSheet.getCell('E1').value = 'اسم الموقع';

    ['A1', 'B1', 'D1', 'E1'].forEach((cellRef) => {
      const cell = refSheet.getCell(cellRef);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A4B7C' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });

    activeJobs.forEach((job, idx) => {
      refSheet.getCell(`A${idx + 2}`).value = job.code;
      refSheet.getCell(`B${idx + 2}`).value = job.name;
    });

    activeSites.forEach((site, idx) => {
      refSheet.getCell(`D${idx + 2}`).value = site.code;
      refSheet.getCell(`E${idx + 2}`).value = site.name;
    });

    refSheet.columns = [{ width: 16 }, { width: 30 }, { width: 6 }, { width: 16 }, { width: 30 }];

    const rawBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(rawBuffer);
  }

  async parseAndImportExcel(buffer: Buffer): Promise<WorkerImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const worksheet = workbook.getWorksheet('بيانات العمال الجدد') || workbook.worksheets[0];
    if (!worksheet) {
      return { success: false, totalRowsProcessed: 0, workersCreated: 0, errors: ['ملف الإكسيل لا يحتوي على ورقة عمل صالحة.'] };
    }

    const activeJobs = await this.repository.getActiveJobs();
    const activeSites = await this.repository.getActiveSites();
    const validJobCodes = new Set(activeJobs.map((j) => j.code));
    const validSiteCodes = new Set(activeSites.map((s) => s.code));

    const rowsToProcess: WorkerRowData[] = [];
    const allErrors: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const fullNameCell = row.getCell(1).text.trim();
      if (!fullNameCell || fullNameCell.includes('محمود السيد أحمد علي')) return;

      const rawIdType = row.getCell(4).text.trim();
      const idType: 'NATIONAL_ID' | 'PASSPORT' =
        rawIdType.includes('جواز') || rawIdType.toUpperCase() === 'PASSPORT' ? 'PASSPORT' : 'NATIONAL_ID';

      const birthDateRaw = row.getCell(7).value;
      let birthDate: Date | undefined;
      if (birthDateRaw instanceof Date) {
        birthDate = birthDateRaw;
      } else if (typeof birthDateRaw === 'string' && birthDateRaw.trim()) {
        birthDate = new Date(birthDateRaw.trim());
      }

      const genderRaw = row.getCell(8).text.trim();
      const gender: 'MALE' | 'FEMALE' = genderRaw === 'أنثى' || genderRaw === 'FEMALE' ? 'FEMALE' : 'MALE';

      const rowData: WorkerRowData = {
        rowNumber,
        fullName: fullNameCell,
        nickname: row.getCell(2).text.trim() || undefined,
        legacyCode: row.getCell(3).text.trim() || undefined,
        idType,
        idNumber: row.getCell(5).text.trim(),
        nationality: row.getCell(6).text.trim() || 'مصري',
        birthDate,
        gender,
        phone: row.getCell(9).text.trim(),
        jobCode: row.getCell(10).text.trim(),
        siteCode: row.getCell(11).text.trim(),
        paymentMethod: row.getCell(13).text.trim() || 'CASH_SITE',
        walletType: row.getCell(14).text.trim() || undefined,
        accountNumber: row.getCell(15).text.trim() || undefined,
        drivingLicense: row.getCell(16).text.trim() || undefined,
        militaryStatus: row.getCell(17).text.trim() || undefined,
        emergencyPhone: row.getCell(18).text.trim() || undefined,
        maritalStatus: row.getCell(20).text.trim() || undefined,
        notes: row.getCell(21).text.trim() || undefined,
      };

      const rowErrors = WorkerExportValidators.validateWorkerRow(rowData, validJobCodes, validSiteCodes);
      if (rowErrors.length > 0) {
        allErrors.push(...rowErrors);
      } else {
        rowsToProcess.push(rowData);
      }
    });

    if (allErrors.length > 0) {
      return { success: false, totalRowsProcessed: rowsToProcess.length, workersCreated: 0, errors: allErrors };
    }

    if (rowsToProcess.length === 0) {
      return { success: false, totalRowsProcessed: 0, workersCreated: 0, errors: ['الملف فارغ ولا يحتوي على صفوف بيانات جديدة.'] };
    }

    const jobMap = new Map(activeJobs.map((j) => [j.code, j.id]));
    const siteMap = new Map(activeSites.map((s) => [s.code, s.id]));

    const workersToCreate: Array<{
      worker: Prisma.WorkerCreateInput;
      auditPayload: Prisma.InputJsonValue;
    }> = [];

    const createdWorkers: Array<{ code: string; name: string }> = [];

    rowsToProcess.forEach((r, idx) => {
      const code = `W-${Date.now().toString().slice(-4)}-${idx + 1}`;
      const cleanPhone = normalizeDigits(r.phone);
      const cleanId = normalizeDigits(r.idNumber);
      const jobTitleId = jobMap.get(r.jobCode) || '';
      const siteId = siteMap.get(r.siteCode) || '';

      let derivedBirthDate = r.birthDate;
      let derivedGender = r.gender || 'MALE';
      let governorateCode: string | undefined;

      if (r.idType === 'NATIONAL_ID') {
        const nid = parseEgyptianNationalId(cleanId);
        if (nid.isValid && nid.info) {
          derivedBirthDate = nid.info.birthDate;
          derivedGender = nid.info.gender || 'MALE';
          governorateCode = nid.info.governorateCode;
        }
      }

      workersToCreate.push({
        worker: {
          code,
          name: r.fullName,
          nickname: r.nickname,
          legacyCode: r.legacyCode,
          phoneEncrypted: cleanPhone,
          idType: r.idType,
          nationalIdEncrypted: r.idType === 'NATIONAL_ID' ? cleanId : null,
          passportNumberEncrypted: r.idType === 'PASSPORT' ? cleanId : null,
          birthDate: derivedBirthDate || new Date(),
          gender: derivedGender,
          governorateCode: governorateCode || '01',
          jobTitle: r.jobCode,
          dailyWage: 0,
          jobRef: { connect: { id: jobTitleId } },
          site: { connect: { id: siteId } },
          paymentMethod: r.paymentMethod,
          walletType: r.walletType,
          accountNumberEncrypted: r.accountNumber,
          drivingLicense: r.drivingLicense,
          militaryStatus: r.militaryStatus,
          emergencyPhoneEncrypted: r.emergencyPhone,
          maritalStatus: r.maritalStatus,
        },
        auditPayload: {
          source: 'EXCEL_IMPORT',
          rowNumber: r.rowNumber,
          fullName: r.fullName,
          code,
        },
      });

      createdWorkers.push({ code, name: r.fullName });
    });

    const result = await this.repository.saveImportedWorkersAtomic(workersToCreate);
    return {
      success: true,
      totalRowsProcessed: rowsToProcess.length,
      workersCreated: result.createdCount,
      errors: [],
      createdWorkers,
    };
  }

  async generateWorkersExportBuffer(
    filter: WorkerExportFilter,
    isSuperAdmin: boolean,
    siteScopeWhere?: Prisma.WorkerWhereInput
  ): Promise<WorkerExportResult> {
    const where: Prisma.WorkerWhereInput = {
      ...(siteScopeWhere || {}),
      isDeleted: false,
      status: 'ACTIVE',
    };

    let filterLabel = 'كافة العاملين بالمنظومة';
    let fileName = 'كشف_العاملين_الشامل.xlsx';

    if (filter.type === 'DEPARTMENT' && filter.departmentId) {
      where.departmentId = filter.departmentId;
      const dept = await this.repository.getDepartmentById(filter.departmentId);
      const deptName = dept?.name || filter.departmentId;
      filterLabel = `قسم: ${deptName}`;
      fileName = `كشف_عمال_قسم_${deptName.replace(/\s+/g, '_')}.xlsx`;
    } else if (filter.type === 'JOB_TITLE' && filter.jobTitleId) {
      where.jobTitleId = filter.jobTitleId;
      const job = await this.repository.getJobTitleById(filter.jobTitleId);
      const jobName = job?.name || filter.jobTitleId;
      filterLabel = `مهنة: ${jobName}`;
      fileName = `كشف_عمال_مهنة_${jobName.replace(/\s+/g, '_')}.xlsx`;
    } else if (filter.type === 'GOVERNORATE' && filter.governorateCode) {
      where.governorateCode = filter.governorateCode;
      const govName = EGYPTIAN_GOVERNORATES[filter.governorateCode]?.nameAr || filter.governorateCode;
      filterLabel = `محافظة: ${govName}`;
      fileName = `كشف_عمال_محافظة_${govName.replace(/\s+/g, '_')}.xlsx`;
    }

    const workers = await this.repository.getWorkersForExport(where);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'شركة السعادة للمقاولات العامة والتعدين';
    workbook.lastModifiedBy = 'منظومة السعادة الذكية';
    workbook.created = new Date();

    const dataSheet = workbook.addWorksheet('كشف العاملين', {
      views: [{ rightToLeft: true, state: 'frozen', xSplit: 0, ySplit: 4 }],
    });

    const columns: Array<{ header: string; key: string; width: number }> = [
      { header: 'م', key: 'seq', width: 6 }, { header: 'كود العامل', key: 'code', width: 16 },
      { header: 'كود قديم', key: 'legacyCode', width: 14 }, { header: 'الاسم الرباعي', key: 'fullName', width: 28 },
      { header: 'اسم الشهرة', key: 'nickname', width: 18 }, { header: 'القسم الوظيفي', key: 'department', width: 22 },
      { header: 'المسمى الوظيفي', key: 'jobTitle', width: 22 }, { header: 'الموقع الميداني', key: 'site', width: 22 },
      { header: 'نوع الإثبات', key: 'idType', width: 16 }, { header: 'رقم الإثبات (القومي/الجواز)', key: 'idNumber', width: 24 },
      { header: 'تاريخ الميلاد', key: 'birthDate', width: 16 }, { header: 'النوع', key: 'gender', width: 10 },
      { header: 'المحافظة', key: 'governorate', width: 16 }, { header: 'محل الإقامة / العنوان', key: 'address', width: 26 },
      { header: 'رقم الهاتف', key: 'phone', width: 18 }, { header: 'هاتف الطوارئ', key: 'emergencyPhone', width: 18 },
      { header: 'جهة اتصال الطوارئ', key: 'emergencyContact', width: 20 }, { header: 'تاريخ المباشرة', key: 'hireDate', width: 16 },
      { header: 'نظام العمل / الدورة', key: 'shiftSystem', width: 20 }, { header: 'نوع العقد', key: 'contractType', width: 16 },
      { header: 'رخصة القيادة', key: 'drivingLicense', width: 18 }, { header: 'الموقف التجنيدي', key: 'militaryStatus', width: 18 },
      { header: 'الحالة الاجتماعية', key: 'maritalStatus', width: 16 }, { header: 'تاريخ انتهاء البطاقة', key: 'idExpiryDate', width: 18 },
      { header: 'حالة القيد', key: 'status', width: 14 },
    ];

    if (isSuperAdmin) {
      columns.push(
        { header: 'الأجر اليومي (ج.م)', key: 'dailyWage', width: 18 },
        { header: 'الراتب الأساسي (ج.م)', key: 'basicSalary', width: 18 },
        { header: 'البدلات الثابتة (ج.م)', key: 'fixedAllowances', width: 18 },
        { header: 'إجمالي الاستحقاق الشهري (ج.م)', key: 'totalSalary', width: 22 },
        { header: 'طريقة صرف الراتب', key: 'paymentMethod', width: 20 },
        { header: 'نوع المحفظة / القناة', key: 'walletType', width: 20 },
        { header: 'رقم الحساب / المحفظة', key: 'accountNumber', width: 24 },
        { header: 'سياسة مسحوبات الكانتين', key: 'canteenPolicy', width: 22 }
      );
    }

    dataSheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = dataSheet.getCell(1, 1);
    titleCell.value = 'شركة السعادة للمقاولات العامة والتعدين — كشف قيد وبيانات العاملين المعتمد';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    dataSheet.getRow(1).height = 36;

    dataSheet.mergeCells(2, 1, 2, columns.length);
    const metaCell = dataSheet.getCell(2, 1);
    const classification = isSuperAdmin
      ? 'نسخة الإدارة العليا (مالية وإدارية شاملة)'
      : 'نسخة إدارية وميدانية (بيانات تشغيلية - بدون أجور)';
    metaCell.value = `📅 تاريخ التصدير: ${formatDateDMY(new Date())}   |   🎯 نطاق التصفية: ${filterLabel}   |   👥 العدد: ${workers.length} عامل   |   🔒 التصنيف: ${classification}`;
    metaCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF2C3E50' }, bold: true };
    metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
    dataSheet.getRow(2).height = 24;

    dataSheet.getRow(3).height = 8;

    columns.forEach((col, idx) => {
      const cell = dataSheet.getCell(4, idx + 1);
      cell.value = col.header;
      const isFinancial = isSuperAdmin && idx >= 25;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isFinancial ? 'FF1E7E34' : 'FF2A4B7C' },
      };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'medium', color: { argb: 'FF1F4E79' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });
    dataSheet.getRow(4).height = 30;

    workers.forEach((w: WorkerExportEntity, index: number) => {
      const rowIdx = index + 5;
      const row = dataSheet.getRow(rowIdx);
      row.height = 24;

      const idNumberRaw = this.safeDecrypt(w.nationalIdEncrypted);
      const govName =
        (w.governorateCode && EGYPTIAN_GOVERNORATES[w.governorateCode]?.nameAr) ||
        w.governorateCode ||
        '-';

      const birthDateStr = w.birthDate ? formatDateDMY(new Date(w.birthDate)) : '-';
      const hireDateStr = w.hireDate ? formatDateDMY(new Date(w.hireDate)) : '-';
      const expiryDateStr = w.idCardExpiryDate ? formatDateDMY(new Date(w.idCardExpiryDate)) : '-';

      const contractTypeStr =
        w.contractType === 'PERMANENT' ? 'دائم' : w.contractType === 'SEASONAL' ? 'موسمي' : 'عمالة يومية';

      const statusStr =
        w.status === 'ACTIVE'
          ? 'نشط'
          : w.status === 'ON_LEAVE'
          ? 'في إجازة'
          : w.status === 'TERMINATED'
          ? 'منتهي الخدمة'
          : w.status;

      const rowValues: Array<string | number> = [
        index + 1,
        w.code,
        w.legacyCode || '-',
        w.name || w.fullName || '-',
        w.nickname || '-',
        w.department?.name || '-',
        w.jobTitle || w.jobRef?.name || '-',
        w.site?.name || '-',
        w.idType === 'PASSPORT' ? 'جواز سفر' : 'رقم قومي',
        idNumberRaw || '-',
        birthDateStr,
        w.gender === 'FEMALE' ? 'أنثى' : 'ذكر',
        govName,
        w.address || '-',
        this.safeDecrypt(w.phoneEncrypted) || '-',
        this.safeDecrypt(w.emergencyPhoneEncrypted) || '-',
        w.emergencyContactName || '-',
        hireDateStr,
        w.shiftSystem || '-',
        contractTypeStr,
        w.drivingLicense || 'لا يوجد',
        w.militaryStatus || '-',
        w.maritalStatus || '-',
        expiryDateStr,
        statusStr,
      ];

      if (isSuperAdmin) {
        const dailyWageNum = Number(w.dailyWage || 0);
        const basicSalaryNum = Number(w.basicSalary || 0);
        const fixedAllowancesNum = Number(w.fixedAllowances || 0);
        const totalSalaryNum = basicSalaryNum + fixedAllowancesNum;

        const canteenPolicyStr =
          w.canteenCigarettePolicy === 'ONE_PACK_DAILY'
            ? 'علبة يومياً'
            : w.canteenCigarettePolicy === 'FULL_COVERAGE'
            ? 'تغطية كاملة'
            : w.canteenCigarettePolicy || '-';

        rowValues.push(
          dailyWageNum,
          basicSalaryNum,
          fixedAllowancesNum,
          totalSalaryNum,
          w.paymentMethod || '-',
          w.walletType || '-',
          this.safeDecrypt(w.accountNumberEncrypted) || '-',
          canteenPolicyStr
        );
      }

      row.values = rowValues;
      row.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const rawBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(rawBuffer),
      fileName,
      workerCount: workers.length,
      filterLabel,
    };
  }
}
