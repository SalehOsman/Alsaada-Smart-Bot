import { NextResponse } from 'next/server';
import { prisma } from '@alsaada/database';
import { getCurrentUser } from '@/lib/auth';
import { hasAccess } from '@/lib/rbac';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'غير مصرح - يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    // Check RBAC: Strictly restricted to SUPER_ADMIN and GENERAL_ADMIN
    const canApprove = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);

    if (!canApprove) {
      return NextResponse.json(
        { error: 'غير مصرح لك باتخاذ قرارات الاعتماد' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, type, decision, notes } = body as {
      id: string;
      type: 'CLEARANCE' | 'ADVANCE' | 'LEAVE' | 'GENERAL';
      decision: 'APPROVED' | 'REJECTED';
      notes?: string;
    };

    if (!id || !decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json(
        { error: 'بيانات الاعتماد غير مكتملة' },
        { status: 400 }
      );
    }


    if (type === 'CLEARANCE') {
      await prisma.workerClearance.update({
        where: { id },
        data: {
          status: decision === 'APPROVED' ? 'APPROVED' : 'CANCELLED',
        },
      });
    } else if (type === 'ADVANCE') {
      await prisma.advanceRequest.update({
        where: { id },
        data: {
          status: decision,
          rejectionReason: decision === 'REJECTED' ? notes : undefined,
          approvedByUserId: BigInt(user.telegramId || 0),
        },
      });
    } else if (type === 'LEAVE') {
      await prisma.leave.update({
        where: { id },
        data: {
          status: decision,
          supervisorNotes: notes,
          approvedByUserId: BigInt(user.telegramId || 0),
        },
      });
    } else {
      // General ApprovalTicket
      await prisma.approvalTicket.update({
        where: { id },
        data: {
          status: decision,
          reviewDecisionNotes: notes,
          reviewedByTelegramId: BigInt(user.telegramId || 0),
          reviewedAt: new Date(),
        },
      });
    }

    // Write audit log
    try {
      await prisma.auditLog.create({
        data: {
          actorTelegramId: BigInt(user.telegramId || 0),
          action: `DECISION_${decision}`,
          entityType: `APPROVAL_${type}`,
          entityId: id,
          afterPayload: {
            decision,
            notes: notes || null,
            reviewer: user.name,
            role: user.role,
          },
        },
      });
    } catch (auditErr) {
      console.warn('Audit log write warning:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: decision === 'APPROVED' ? 'تم الاعتماد بنجاح' : 'تم تسجيل الرفض بنجاح',
    });
  } catch (err: unknown) {
    console.error('Approvals API error:', err);
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل القرار';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

