import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@alsaada/database';
import { getCurrentUser } from '@/lib/auth';
import { isNonDelegatable } from '@alsaada/rbac';
import { extractTraceId } from '@alsaada/telemetry';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول أولاً' }, { status: 401 });
  }

  if (!['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const whereClause: Record<string, unknown> = {};
  if (user.role === 'FIELD_ADMIN' && user.assignedSiteId) {
    whereClause.siteId = user.assignedSiteId;
  }

  const delegations = await prisma.workerDelegation.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, fullName: true, telegramId: true, role: true } },
      worker: { select: { id: true, code: true, name: true, nickname: true } },
      site: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const serialized = delegations.map((d) => ({
    ...d,
    requestedByTelegramId: d.requestedByTelegramId ? d.requestedByTelegramId.toString() : null,
    approvedByTelegramId: d.approvedByTelegramId ? d.approvedByTelegramId.toString() : null,
    revokedByTelegramId: d.revokedByTelegramId ? d.revokedByTelegramId.toString() : null,
    user: d.user
      ? { ...d.user, name: d.user.fullName, telegramId: d.user.telegramId ? d.user.telegramId.toString() : null }
      : null,
  }));

  return NextResponse.json({ success: true, data: serialized });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول أولاً' }, { status: 401 });
  }

  if (!['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'غير مصرح بإنشاء تفويضات' }, { status: 403 });
  }


  const traceId = extractTraceId(req);
  const body = await req.json();
  const { workerId, permissionKey, siteId, reason, endsAt } = body;

  if (!workerId || !permissionKey || !siteId) {
    return NextResponse.json({ error: 'جميع الحقول الأساسية مطلوبة (العامل، الصلاحية، الموقع)' }, { status: 400 });
  }

  // 1. Sovereign Gate: Non-delegatable permissions cannot be delegated to workers
  if (isNonDelegatable(permissionKey)) {
    return NextResponse.json(
      { error: 'لا يمكن تفويض الوظائف والصلاحيات السيادية لعامل مشرف' },
      { status: 403 }
    );
  }

  // 2. Field Admin Site Boundary check
  if (user.role === 'FIELD_ADMIN' && user.assignedSiteId && siteId !== user.assignedSiteId) {
    return NextResponse.json(
      { error: 'مشرف الموقع مقيد بتفويض عمال موقعه المسجل فقط' },
      { status: 403 }
    );
  }

  // Find worker and associated user
  const worker = await prisma.worker.findUnique({
    where: { id: workerId, isDeleted: false },
    include: { user: true },
  });

  if (!worker) {
    return NextResponse.json({ error: 'العامل غير موجود' }, { status: 404 });
  }

  if (worker.siteId !== siteId) {
    return NextResponse.json({ error: 'العامل غير مسجل في هذا الموقع' }, { status: 400 });
  }

  // Ensure worker has a user account
  let targetUserId = worker.user?.id;
  if (!targetUserId) {
    // If worker doesn't have a linked user account, find or create one
    const newUser = await prisma.user.create({
      data: {
        telegramId: worker.telegramId || BigInt(Math.floor(Math.random() * 1000000000)),
        fullName: worker.name,
        role: 'WORKER',
        assignedSiteId: worker.siteId,
        isActive: true,
      },
    });
    targetUserId = newUser.id;
  }

  const actorTelegramId = BigInt(user.telegramId || '0');
  const isDirectApproval = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);
  const initialStatus = isDirectApproval ? 'ACTIVE' : 'PENDING';

  const delegation = await prisma.workerDelegation.create({
    data: {
      userId: targetUserId,
      workerId: worker.id,
      permissionKey,
      siteId,
      reason: reason?.trim() || 'تفويض تشغيلي ميداني',
      endsAt: endsAt ? new Date(endsAt) : null,
      status: initialStatus,
      requestedByTelegramId: actorTelegramId,
      approvedByTelegramId: isDirectApproval ? actorTelegramId : 0n,
    },
  });

  // If approved immediately by Super/General Admin, promote user role to WORKER_SUPERVISOR
  if (initialStatus === 'ACTIVE') {
    await prisma.user.update({
      where: { id: targetUserId },
      data: { role: 'WORKER_SUPERVISOR' },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorTelegramId,
      action: 'WORKER_DELEGATION_CREATED',
      entityType: 'WorkerDelegation',
      entityId: delegation.id,
      afterPayload: {
        delegationId: delegation.id,
        workerId: worker.id,
        status: initialStatus,
        permissionKey,
        siteId,
        traceId,
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      ...delegation,
      requestedByTelegramId: delegation.requestedByTelegramId.toString(),
      approvedByTelegramId: delegation.approvedByTelegramId?.toString() || null,
    },
  });
}
