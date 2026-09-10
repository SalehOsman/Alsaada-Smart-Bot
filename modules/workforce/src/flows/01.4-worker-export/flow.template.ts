import ExcelJS from 'exceljs';
import type { WorkerExportRepository } from './flow.repository.js';

export async function generateWorkerTemplateBuffer(
  repository: WorkerExportRepository
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'شركة السعادة للمقاولات العامة والتعدين';
  workbook.lastModifiedBy = 'منظومة السعادة الذكية';
  workbook.created = new Date();

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
    { header: 'نوع المحفظة / القناة', key: 'walletType', width: 22 },
    { header: 'رقم المحفظة / الحساب', key: 'accountNumber', width: 24 },
    { header: 'اسم صاحب المحفظة', key: 'walletOwnerName', width: 22 },
    { header: 'معرف إنستاباي', key: 'instaPayHandle', width: 22 },
    { header: 'رخصة القيادة', key: 'drivingLicense', width: 22 },
    { header: 'الموقف التجنيدي', key: 'militaryStatus', width: 26 },
    { header: 'هاتف الطوارئ', key: 'emergencyPhone', width: 20 },
    { header: 'التأمين السابق', key: 'previousInsuranceStatus', width: 22 },
    { header: 'الحالة الاجتماعية', key: 'maritalStatus', width: 20 },
    { header: 'وحدة السكن / العنبر', key: 'barracksUnit', width: 20 },
    { header: 'رقم السرير', key: 'bedNumber', width: 16 },
    { header: 'الرقم التأميني', key: 'insuranceNumber', width: 22 },
    { header: 'حالة التأمين الاجتماعي', key: 'insuranceStatus', width: 22 },
    { header: 'مقاس السيفتي (الحذاء)', key: 'ppeShoeSize', width: 22 },
    { header: 'مقاس الزي (الأفرول)', key: 'ppeUniformSize', width: 20 },
    { header: 'ملاحظات طبية', key: 'medicalNotes', width: 24 },
    { header: 'ملاحظات إدارية', key: 'notes', width: 28 },
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
    '',
    '',
    'درجة ثانية',
    'إعفاء نهائي',
    '01098765432',
    'ساري',
    'متزوج',
    'عنبر أ - 2',
    '14',
    '12345678',
    'ساري',
    '43',
    'XL',
    'لا يوجد أمراض مزمنة',
    'مثال توضيحي لكيفية ملء القالب',
  ];
  exampleRow.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF7F8C8D' } };

  const refSheet = workbook.addWorksheet('دليل الأكواد المعتمدة', {
    views: [{ rightToLeft: true }],
  });

  const activeJobs = await repository.getActiveJobs();
  const activeSites = await repository.getActiveSites();

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
