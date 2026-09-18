import { NextResponse } from 'next/server';
import { prisma } from '@alsaada/database';
import { getCurrentUser } from '@/lib/auth';
import { notifyRbacSync } from '@/lib/redis-sync';

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'غير مصرح - يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (!['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'غير مصرح لك بتعديل سياسات الإشراف' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { supervisorId, freezeBotAccessOnLeave, ejectTelegramOnLeave } = body as {
      supervisorId: string;
      freezeBotAccessOnLeave?: boolean;
      ejectTelegramOnLeave?: boolean;
    };

    if (!supervisorId) {
      return NextResponse.json(
        { error: 'معرف المشرف مطلوب' },
        { status: 400 }
      );
    }

    const supervisor = await prisma.user.findUnique({
      where: { id: supervisorId },
    });

    if (!supervisor) {
      return NextResponse.json(
        { error: 'المشرف غير موجود' },
        { status: 404 }
      );
    }

    if (supervisor.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'لا يمكن تعديل سياسات السوبر أدمن' },
        { status: 403 }
      );
    }

    const updateData: { freezeBotAccessOnLeave?: boolean; ejectTelegramOnLeave?: boolean } = {};
    if (typeof freezeBotAccessOnLeave === 'boolean') {
      updateData.freezeBotAccessOnLeave = freezeBotAccessOnLeave;
    }
    if (typeof ejectTelegramOnLeave === 'boolean') {
      updateData.ejectTelegramOnLeave = ejectTelegramOnLeave;
    }

    const updated = await prisma.user.update({
      where: { id: supervisorId },
      data: updateData,
    });

    await notifyRbacSync({
      eventType: 'SUPERVISOR_POLICY_UPDATED',
      userId: supervisor.id,
      freezeBotAccessOnLeave: updated.freezeBotAccessOnLeave,
      ejectTelegramOnLeave: updated.ejectTelegramOnLeave,
    });

    return NextResponse.json({
      ok: true,
      message: 'تم تحديث سياسات المشرف بنجاح',
      data: {
        id: updated.id,
        freezeBotAccessOnLeave: updated.freezeBotAccessOnLeave,
        ejectTelegramOnLeave: updated.ejectTelegramOnLeave,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
    console.error('Update supervisor policy error:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
