import { NextRequest, NextResponse } from 'next/server';
import { prisma, decryptField, encryptField } from '@alsaada/database';
import { getCurrentUser } from '@/lib/auth';
import { getNormalizedEncryptionKey } from '@/lib/data-fetchers';
import { projectSafeWorkerFields, type CanonicalRole } from '@alsaada/rbac';
import { extractTraceId } from '@alsaada/telemetry';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول أولاً' }, { status: 401 });
  }
  const { id } = await context.params;


  const worker = await prisma.worker.findUnique({
    where: { id, isDeleted: false },
    include: { site: true, jobRef: true },
  });

  if (!worker) {
    return NextResponse.json({ error: 'العامل غير موجود أو تم حذفه' }, { status: 404 });
  }

  // If FIELD_ADMIN, ensure worker belongs to their assigned site
  if (user.role === 'FIELD_ADMIN' && user.assignedSiteId && worker.siteId !== user.assignedSiteId) {
    return NextResponse.json({ error: 'غير مصرح لك بالوصول لبيانات عمال هذا الموقع' }, { status: 403 });
  }

  const key = getNormalizedEncryptionKey();
  let phone = '***';
  let nationalId = '***';

  if (key) {
    if (worker.phoneEncrypted) {
      try {
        phone = decryptField(worker.phoneEncrypted, key);
      } catch {}
    }
    if (worker.nationalIdEncrypted) {
      try {
        const rawNid = decryptField(worker.nationalIdEncrypted, key);
        nationalId = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role)
          ? rawNid
          : `**********${rawNid.slice(-4)}`;
      } catch {}
    }
  }

  const workerData = {
    id: worker.id,
    code: worker.code,
    name: worker.name,
    nickname: worker.nickname || worker.name.split(' ')[0],
    phone,
    nationalId,
    siteId: worker.siteId,
    siteName: worker.site?.name || 'غير مسند',
    jobTitle: worker.jobRef?.name || worker.jobTitle,
    jobTitleId: worker.jobTitleId,
    status: worker.status,
    basicSalary: ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role) ? Number(worker.basicSalary || 0) : undefined,
    fixedAllowances: ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role) ? Number(worker.fixedAllowances || 0) : undefined,
    canteenCigarettePolicy: worker.canteenCigarettePolicy,
    cigaretteBrand: worker.cigaretteBrand,
    cigarettesQuota: worker.canteenCigarettePolicy === 'ONE_PACK_DAILY' ? 1 : 0,
    insuranceNumber: worker.insuranceNumber,
    contractType: worker.contractType || 'DAILY',
  };

  const safeData = projectSafeWorkerFields(workerData, user.role);
  return NextResponse.json({ success: true, data: safeData });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول أولاً' }, { status: 401 });
  }
  const { id } = await context.params;

  const traceId = extractTraceId(req);

  const existing = await prisma.worker.findUnique({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    return NextResponse.json({ error: 'العامل غير موجود' }, { status: 404 });
  }

  if (user.role === 'FIELD_ADMIN' && user.assignedSiteId && existing.siteId !== user.assignedSiteId) {
    return NextResponse.json({ error: 'غير مصرح لك بتعديل عمال هذا الموقع' }, { status: 403 });
  }

  const body = await req.json();

  // Strict Sovereign Gate: Compensation modification is strictly restricted to SUPER_ADMIN
  const touchesCompensation =
    body.basicSalary !== undefined ||
    body.dailyWage !== undefined ||
    body.fixedAllowances !== undefined;

  if (touchesCompensation && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'تعديل الرواتب والمستحقات التعاقدية مقصور حصرياً على مدير عام المنظومة (سوبر أدمن)' },
      { status: 403 }
    );
  }

  const key = getNormalizedEncryptionKey();
  const updateData: Record<string, any> = {};

  if (body.name) updateData.name = body.name.trim();
  if (body.nickname !== undefined) updateData.nickname = body.nickname?.trim() || null;
  if (body.phone && key) {
    updateData.phoneEncrypted = encryptField(body.phone.trim(), key);
  }
  if (body.siteId) updateData.siteId = body.siteId;
  if (body.jobTitleId) updateData.jobTitleId = body.jobTitleId;
  if (body.jobTitle) updateData.jobTitle = body.jobTitle.trim();
  if (body.status) updateData.status = body.status;
  if (body.cigarettesQuota !== undefined) {
    updateData.canteenCigarettePolicy = Number(body.cigarettesQuota) > 0 ? 'ONE_PACK_DAILY' : 'NONE';
  }
  if (body.canteenCigarettePolicy !== undefined) updateData.canteenCigarettePolicy = body.canteenCigarettePolicy;
  if (body.cigaretteBrand !== undefined) updateData.cigaretteBrand = body.cigaretteBrand;
  if (body.insuranceNumber !== undefined) updateData.insuranceNumber = body.insuranceNumber;
  if (body.contractType !== undefined) updateData.contractType = body.contractType;

  if (user.role === 'SUPER_ADMIN') {
    if (body.basicSalary !== undefined) updateData.basicSalary = body.basicSalary;
    if (body.fixedAllowances !== undefined) updateData.fixedAllowances = body.fixedAllowances;
    if (body.dailyWage !== undefined) updateData.dailyWage = body.dailyWage;
  }

  const updated = await prisma.worker.update({
    where: { id },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      actorTelegramId: BigInt(user.telegramId || '0'),
      action: 'WORKER_UPDATED',
      entityType: 'Worker',
      entityId: id,
      beforePayload: {
        name: existing.name,
        nickname: existing.nickname,
        siteId: existing.siteId,
        status: existing.status,
      },
      afterPayload: {
        traceId,
        updatedFields: Object.keys(updateData),
        editorRole: user.role,
      },
    },
  });

  return NextResponse.json({ success: true, message: 'تم حفظ التعديلات بنجاح' });
}
