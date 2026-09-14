import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@alsaada/database';
import { getCurrentUser } from '@/lib/auth';
import { extractTraceId } from '@alsaada/telemetry';

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

  const delegation = await prisma.workerDelegation.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!delegation) {
    return NextResponse.json({ error: 'التفويض غير موجود' }, { status: 404 });
  }

  const body = await req.json();
  const { action, reason } = body; // 'APPROVE' | 'REJECT' | 'REVOKE'

  const actorTelegramId = BigInt(user.telegramId || '0');

  if (action === 'APPROVE' || action === 'REJECT') {
    // Strict Sovereign Rule: Only SUPER_ADMIN and GENERAL_ADMIN can approve/reject.
    // Self-approval by FIELD_ADMIN is strictly prohibited.
    if (!['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'حظر الاعتماد الذاتي: اعتماد أو رفض التفويضات مقصور حصرياً على الإدارة العليا' },
        { status: 403 }
      );
    }

    const newStatus = action === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
    const updated = await prisma.workerDelegation.update({
      where: { id },
      data: {
        status: newStatus,
        approvedByTelegramId: action === 'APPROVE' ? actorTelegramId : delegation.approvedByTelegramId,
        revokedByTelegramId: action === 'REJECT' ? actorTelegramId : null,
      },
    });

    if (action === 'APPROVE') {
      // Automatic role escalation: User role becomes WORKER_SUPERVISOR upon first active delegation
      await prisma.user.update({
        where: { id: delegation.userId },
        data: { role: 'WORKER_SUPERVISOR' },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorTelegramId,
        action: `WORKER_DELEGATION_${action}`,
        entityType: 'WorkerDelegation',
        entityId: id,
        afterPayload: {
          delegationId: id,
          action,
          userId: delegation.userId,
          traceId,
        },
      },
    });

    return NextResponse.json({ success: true, status: newStatus });
  }

  if (action === 'REVOKE') {
    if (user.role === 'FIELD_ADMIN' && user.assignedSiteId && delegation.siteId !== user.assignedSiteId) {
      return NextResponse.json({ error: 'غير مصرح لك بإلغاء تفويضات خارج موقعك' }, { status: 403 });
    }

    const updated = await prisma.workerDelegation.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedByTelegramId: actorTelegramId,
        reason: reason?.trim() || delegation.reason,
      },
    });

    // Check if worker user has any remaining active delegations
    const activeCount = await prisma.workerDelegation.count({
      where: {
        userId: delegation.userId,
        status: 'ACTIVE',
      },
    });

    // Automatic demotion: When last active delegation is revoked, revert role to WORKER
    if (activeCount === 0) {
      await prisma.user.update({
        where: { id: delegation.userId },
        data: { role: 'WORKER' },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorTelegramId,
        action: 'WORKER_DELEGATION_REVOKED',
        entityType: 'WorkerDelegation',
        entityId: id,
        afterPayload: {
          delegationId: id,
          userId: delegation.userId,
          remainingActiveDelegations: activeCount,
          traceId,
        },
      },
    });

    return NextResponse.json({ success: true, status: 'REVOKED', activeCount });
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
