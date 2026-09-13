import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma, decryptField } from '@alsaada/database';
import { getCurrentUser } from '@/lib/auth';
import { getNormalizedEncryptionKey } from '@/lib/data-fetchers';
import { projectSafeWorkerFields } from '@alsaada/rbac';
import { extractTraceId } from '@alsaada/telemetry';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'غير مصرح بتصدير البيانات' }, { status: 403 });
  }

  const traceId = extractTraceId(req);
  const { searchParams } = new URL(req.url);
  const siteParam = searchParams.get('site');
  const statusParam = searchParams.get('status');

  const whereClause: Record<string, any> = { isDeleted: false };

  // Strict Site Boundary: FIELD_ADMIN is strictly locked to their assigned site
  if (user.role === 'FIELD_ADMIN') {
    if (user.assignedSiteId) {
      whereClause.siteId = user.assignedSiteId;
    }
  } else if (siteParam && siteParam !== 'ALL') {
    whereClause.siteId = siteParam;
  }

  if (statusParam && statusParam !== 'ALL') {
    whereClause.status = statusParam;
  }

  const workers = await prisma.worker.findMany({
    where: whereClause,
    include: {
      site: true,
      jobRef: true,
    },
    orderBy: { code: 'asc' },
  });

  const canViewFinances = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);
  const canViewFullNationalId = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);
  const key = getNormalizedEncryptionKey();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'منظومة السعادة سمارت بوت';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('سجل القوى العاملة', {
    views: [{ rightToLeft: true }],
  });

  // Define columns dynamically based on RBAC permissions
  const columns: Partial<ExcelJS.Column>[] = [
    { header: 'كود العامل', key: 'code', width: 14 },
    { header: 'اسم الشهرة', key: 'nickname', width: 16 },
    { header: 'الاسم الكامل', key: 'name', width: 26 },
    { header: 'الموقع / المشروع', key: 'siteName', width: 22 },
    { header: 'المسمى الوظيفي', key: 'jobTitle', width: 20 },
    { header: 'نوع التعاقد', key: 'contractType', width: 16 },
    { header: 'الحالة', key: 'status', width: 16 },
    { header: 'رقم الهاتف', key: 'phone', width: 16 },
    { header: 'الرقم القومي', key: 'nationalId', width: 20 },
  ];

  // Sovereign Gate: Compensation columns ONLY included for SUPER_ADMIN and GENERAL_ADMIN
  if (canViewFinances) {
    columns.push(
      { header: 'الراتب الأساسي (ج.م)', key: 'basicSalary', width: 18 },
      { header: 'الأجر اليومي (ج.م)', key: 'dailyWage', width: 18 },
      { header: 'البدلات الثابتة (ج.م)', key: 'fixedAllowances', width: 18 },
      { header: 'إجمالي الراتب الشهري (ج.م)', key: 'totalMonthlySalary', width: 22 }
    );
  }

  columns.push(
    { header: 'سياسة السجائر', key: 'canteenPolicy', width: 18 },
    { header: 'صنف السجائر', key: 'cigaretteBrand', width: 18 },
    { header: 'الرقم التأميني', key: 'insuranceNumber', width: 18 }
  );

  worksheet.columns = columns;

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFC2410C' }, // Orange-700
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 26;

  // Add Worker Data Rows
  for (const w of workers) {
    let phone = 'غير مسجل';
    let nationalId = '***';

    if (key) {
      if (w.phoneEncrypted) {
        try {
          phone = decryptField(w.phoneEncrypted, key);
        } catch {
          phone = '***';
        }
      }
      if (w.nationalIdEncrypted) {
        try {
          const rawNid = decryptField(w.nationalIdEncrypted, key);
          nationalId = canViewFullNationalId ? rawNid : `**********${rawNid.slice(-4)}`;
        } catch {
          nationalId = '**********';
        }
      }
    }

    const basicSalary = Number(w.basicSalary || 0);
    const fixedAllowances = Number(w.fixedAllowances || 0);
    const totalMonthlySalary = basicSalary + fixedAllowances;
    const dailyWage = Number(w.dailyWage || 0);

    const rowData: Record<string, any> = {
      code: w.code,
      nickname: w.nickname || w.name.split(' ')[0],
      name: w.name,
      siteName: w.site?.name || 'غير مسند',
      jobTitle: w.jobRef?.name || w.jobTitle,
      contractType: w.contractType || 'DAILY_LABOR',
      status: w.status,
      phone,
      nationalId,
      canteenPolicy: w.canteenCigarettePolicy,
      cigaretteBrand: w.cigaretteBrand || '-',
      insuranceNumber: w.insuranceNumber || '-',
    };

    if (canViewFinances) {
      rowData.basicSalary = basicSalary;
      rowData.dailyWage = dailyWage;
      rowData.fixedAllowances = fixedAllowances;
      rowData.totalMonthlySalary = totalMonthlySalary;
    }

    const row = worksheet.addRow(rowData);
    row.alignment = { horizontal: 'right', vertical: 'middle' };
    row.height = 22;
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `workforce_report_${new Date().toISOString().split('T')[0]}_${user.role.toLowerCase()}.xlsx`;

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Trace-Id': traceId,
    },
  });
}
