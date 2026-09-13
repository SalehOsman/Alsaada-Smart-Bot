import { NextRequest, NextResponse } from 'next/server';
import { prisma, decryptField } from '@alsaada/database';
import { getCurrentUser } from '@/lib/auth';
import { getNormalizedEncryptionKey } from '@/lib/data-fetchers';
import { extractTraceId } from '@alsaada/telemetry';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'غير مصرح بتصدير التقرير' }, { status: 403 });
  }

  const traceId = extractTraceId(req);
  const { searchParams } = new URL(req.url);
  const siteParam = searchParams.get('site');
  const statusParam = searchParams.get('status');

  const whereClause: Record<string, any> = { isDeleted: false };

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

  const workerRows = workers
    .map((w) => {
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
      const totalSalary = basicSalary + fixedAllowances;

      return `
        <tr>
          <td class="font-mono">${w.code}</td>
          <td class="font-bold">${w.nickname || w.name.split(' ')[0]}</td>
          <td>${w.name}</td>
          <td>${w.site?.name || 'غير مسند'}</td>
          <td>${w.jobRef?.name || w.jobTitle}</td>
          <td>${w.status === 'ACTIVE' ? 'على رأس العمل' : w.status}</td>
          <td class="font-mono">${phone}</td>
          <td class="font-mono">${nationalId}</td>
          ${
            canViewFinances
              ? `<td class="font-mono">${totalSalary} ج.م</td>`
              : ''
          }
        </tr>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير القوى العاملة الميداني - شركة السعادة</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
    .header { border-bottom: 2px solid #ea580c; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { margin: 0; font-size: 20px; color: #c2410c; }
    .meta { font-size: 11px; color: #64748b; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 16px; }
    th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; color: #334155; }
    td { border: 1px solid #e2e8f0; padding: 8px 10px; }
    tr:nth-child(even) { background: #f8fafc; }
    .font-mono { font-family: monospace; }
    .font-bold { font-weight: bold; }
    .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
    @media print {
      body { padding: 0; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>شركة السعادة للمقاولات والتجارة</h1>
      <div class="meta" style="margin-top: 4px;">كشف وسجل القوى العاملة المعتمد</div>
    </div>
    <div class="meta" style="text-align: left;">
      <div>التاريخ: ${new Date().toISOString().split('T')[0]}</div>
      <div>الصفة المصدرة: ${user.role}</div>
      <div class="font-mono">Trace ID: ${traceId}</div>
    </div>
  </div>

  <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
    <span style="font-size: 12px; font-weight: bold;">إجمالي العاملين المسجلين في هذا الكشف: ${workers.length} عامل</span>
    <button onclick="window.print()" style="padding: 6px 14px; background: #ea580c; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold;">طباعة المستند / حفظ PDF</button>
  </div>

  <table>
    <thead>
      <tr>
        <th>الكود</th>
        <th>اسم الشهرة</th>
        <th>الاسم الكامل</th>
        <th>الموقع</th>
        <th>المهنة</th>
        <th>الحالة</th>
        <th>رقم الهاتف</th>
        <th>الرقم القومي</th>
        ${canViewFinances ? '<th>الراتب الشهري</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${workerRows}
    </tbody>
  </table>

  <div class="footer">
    <span>منظومة السعادة سمارت بوت - التقرير الجنائي المعتمد</span>
    <span>توقيع وختم الإدارة: ________________________</span>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Trace-Id': traceId,
    },
  });
}
