import { NextResponse } from 'next/server';
import { prisma } from '@alsaada/database';
import { getCurrentUser } from '@/lib/auth';
import { notifyRbacSync } from '@/lib/redis-sync';

export async function POST(request: Request) {
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
        { error: 'غير مصرح لك بإدارة دورة حياة المشرفين' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { supervisorId, actionType, targetSiteId, notes } = body as {
      supervisorId: string;
      actionType: 'LEAVE_START' | 'LEAVE_RETURN' | 'SITE_TRANSFER' | 'TERMINATION';
      targetSiteId?: string;
      notes?: string;
    };

    if (!supervisorId || !actionType) {
      return NextResponse.json(
        { error: 'بيانات المشرف أو نوع الإجراء مفقودة' },
        { status: 400 }
      );
    }

    const supervisor = await prisma.user.findUnique({
      where: { id: supervisorId },
      include: { assignedSite: true },
    });

    if (!supervisor) {
      return NextResponse.json(
        { error: 'المشرف غير موجود بالمنظومة' },
        { status: 404 }
      );
    }

    // Protection: Prevent non-Super-Admin from modifying a Super Admin
    if (supervisor.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'لا يمكن تعديل دورة حياة المشرف العام الأعلى إلا من قبله' },
        { status: 403 }
      );
    }

    const actorTelegramId = BigInt(user.telegramId || 0);

    let resultMessage = '';

    if (actionType === 'LEAVE_START') {
      await prisma.$transaction(async (tx) => {
        await tx.supervisorLifecycleLog.create({
          data: {
            userId: supervisor.id,
            workerId: supervisor.workerId,
            actionType: 'LEAVE_START',
            previousSiteId: supervisor.assignedSiteId,
            telegramGroupId: supervisor.assignedSite?.telegramGroupId ?? null,
            telegramTopicId: supervisor.assignedSite?.telegramTopicId ?? null,
            actorTelegramId,
            notes: notes || 'تسجيل بدء إجازة من لوحة التحكم',
          },
        });

        if (supervisor.freezeBotAccessOnLeave) {
          await tx.user.update({
            where: { id: supervisor.id },
            data: { isActive: false },
          });
        }

        if (supervisor.ejectTelegramOnLeave && supervisor.assignedSite?.telegramGroupId) {
          await tx.telegramEnforcementTask.create({
            data: {
              siteId: supervisor.assignedSiteId || '',
              telegramId: supervisor.telegramId,
              chatId: supervisor.assignedSite.telegramGroupId,
              taskType: 'KICK_MEMBER',
              status: 'PENDING',
            },
          });
        }
      });
      resultMessage = 'تم تسجيل بدء الإجازة وتطبيق سياسات الحجب بنجاح';
    } else if (actionType === 'LEAVE_RETURN') {
      await prisma.$transaction(async (tx) => {
        await tx.supervisorLifecycleLog.create({
          data: {
            userId: supervisor.id,
            workerId: supervisor.workerId,
            actionType: 'LEAVE_RETURN',
            newSiteId: supervisor.assignedSiteId,
            telegramGroupId: supervisor.assignedSite?.telegramGroupId ?? null,
            telegramTopicId: supervisor.assignedSite?.telegramTopicId ?? null,
            actorTelegramId,
            notes: notes || 'استئناف العمل والعودة من الإجازة',
          },
        });

        await tx.user.update({
          where: { id: supervisor.id },
          data: { isActive: true },
        });

        if (supervisor.assignedSite?.telegramGroupId) {
          await tx.telegramEnforcementTask.create({
            data: {
              siteId: supervisor.assignedSiteId || '',
              telegramId: supervisor.telegramId,
              chatId: supervisor.assignedSite.telegramGroupId,
              taskType: 'GENERATE_INVITE',
              status: 'PENDING',
            },
          });
        }
      });
      resultMessage = 'تم استئناف العمل وتفعيل صلاحيات المشرف وإرسال رابط الجروب بنجاح';
    } else if (actionType === 'SITE_TRANSFER') {
      if (!targetSiteId) {
        return NextResponse.json(
          { error: 'يرجى تحديد الموقع الجديد المراد نقل المشرف إليه' },
          { status: 400 }
        );
      }

      const targetSite = await prisma.site.findUnique({
        where: { id: targetSiteId },
      });

      if (!targetSite) {
        return NextResponse.json(
          { error: 'الموقع المستهدف غير موجود' },
          { status: 404 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.supervisorLifecycleLog.create({
          data: {
            userId: supervisor.id,
            workerId: supervisor.workerId,
            actionType: 'SITE_TRANSFER',
            previousSiteId: supervisor.assignedSiteId,
            newSiteId: targetSite.id,
            telegramGroupId: targetSite.telegramGroupId ?? null,
            telegramTopicId: targetSite.telegramTopicId ?? null,
            actorTelegramId,
            notes: notes || `نقل المشرف من ${supervisor.assignedSite?.name || 'موقع سابق'} إلى ${targetSite.name}`,
          },
        });

        // Kick from previous group if applicable
        if (supervisor.assignedSite?.telegramGroupId && supervisor.assignedSite.telegramGroupId !== targetSite.telegramGroupId) {
          await tx.telegramEnforcementTask.create({
            data: {
              siteId: supervisor.assignedSiteId || '',
              telegramId: supervisor.telegramId,
              chatId: supervisor.assignedSite.telegramGroupId,
              taskType: 'KICK_MEMBER',
              status: 'PENDING',
            },
          });
        }

        // Generate invite for new group
        if (targetSite.telegramGroupId) {
          await tx.telegramEnforcementTask.create({
            data: {
              siteId: targetSite.id,
              telegramId: supervisor.telegramId,
              chatId: targetSite.telegramGroupId,
              taskType: 'GENERATE_INVITE',
              status: 'PENDING',
            },
          });
        }

        await tx.user.update({
          where: { id: supervisor.id },
          data: { assignedSiteId: targetSite.id },
        });
      });
      resultMessage = `تم نقل المشرف بنجاح إلى موقع ${targetSite.name}`;
    } else if (actionType === 'TERMINATION') {
      await prisma.$transaction(async (tx) => {
        await tx.supervisorLifecycleLog.create({
          data: {
            userId: supervisor.id,
            workerId: supervisor.workerId,
            actionType: 'TERMINATION',
            previousSiteId: supervisor.assignedSiteId,
            telegramGroupId: supervisor.assignedSite?.telegramGroupId ?? null,
            telegramTopicId: supervisor.assignedSite?.telegramTopicId ?? null,
            actorTelegramId,
            notes: notes || 'إنهاء خدمة وحظر المشرف نهائياً',
          },
        });

        if (supervisor.assignedSite?.telegramGroupId) {
          await tx.telegramEnforcementTask.create({
            data: {
              siteId: supervisor.assignedSiteId || '',
              telegramId: supervisor.telegramId,
              chatId: supervisor.assignedSite.telegramGroupId,
              taskType: 'BAN_MEMBER',
              status: 'PENDING',
            },
          });
        }

        await tx.botMenuPermission.deleteMany({
          where: {
            scopeType: 'USER',
            scopeId: supervisor.id,
          },
        });

        await tx.user.update({
          where: { id: supervisor.id },
          data: {
            isActive: false,
            isBanned: true,
            assignedSiteId: null,
          },
        });
      });
      resultMessage = 'تم إنهاء خدمة المشرف، حظره من المنظومة، وطرد المجموعات وسحب كافة الصلاحيات بنجاح';
    } else {
      return NextResponse.json(
        { error: 'نوع الإجراء غير مدعوم' },
        { status: 400 }
      );
    }

    await notifyRbacSync({
      eventType: 'SUPERVISOR_LIFECYCLE',
      userId: supervisor.id,
      actionType,
    });

    return NextResponse.json({ ok: true, message: resultMessage });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء معالجة دورة الحياة';
    console.error('Supervisor lifecycle error:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
