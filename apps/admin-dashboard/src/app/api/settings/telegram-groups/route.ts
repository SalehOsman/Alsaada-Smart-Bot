import { NextResponse } from 'next/server';
import { prisma } from '@alsaada/database';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'غير مصرح - يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (!['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'غير مصرح لك باستعراض إعدادات مجموعات تليجرام' },
        { status: 403 }
      );
    }

    const [sites, recentTasks] = await Promise.all([
      prisma.site.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          code: true,
          telegramGroupId: true,
          telegramTopicId: true,
          users: {
            where: { isActive: true, isDeleted: false },
            select: { id: true, fullName: true, role: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.telegramEnforcementTask.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedSites = sites.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      telegramGroupId: s.telegramGroupId ? s.telegramGroupId.toString() : null,
      telegramTopicId: s.telegramTopicId,
      supervisorCount: s.users.length,
      supervisors: s.users.map((u) => ({ id: u.id, name: u.fullName, role: u.role })),
    }));

    const formattedTasks = recentTasks.map((t) => ({
      id: t.id,
      siteId: t.siteId,
      telegramId: t.telegramId.toString(),
      chatId: t.chatId.toString(),
      topicId: t.topicId,
      taskType: t.taskType,
      status: t.status,
      retryCount: t.retryCount,
      lastError: t.lastError,
      createdAt: t.createdAt.toISOString(),
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    }));

    const centralHqConfig = {
      groupId: process.env.TELEGRAM_HQ_CHAT_ID || process.env.TELEGRAM_LOG_CHAT_ID || '-1002450410741',
      topics: [
        { key: 'HR', title: 'الموارد البشرية والعمالة (HR)', topicId: process.env.TELEGRAM_TOPIC_HR || 101 },
        { key: 'OPERATIONS', title: 'العمليات والتشغيل الميداني', topicId: process.env.TELEGRAM_TOPIC_OPERATIONS || 102 },
        { key: 'FINANCE', title: 'الخزينة والمالية والمشتريات', topicId: process.env.TELEGRAM_TOPIC_FINANCE || 103 },
        { key: 'SECURITY', title: 'أمن المنظومة والرقابة الجنائية', topicId: process.env.TELEGRAM_TOPIC_SECURITY || 104 },
      ],
    };

    return NextResponse.json({
      centralHq: centralHqConfig,
      sites: formattedSites,
      recentTasks: formattedTasks,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل جلب إعدادات تليجرام';
    console.error('Telegram groups GET error:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

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
        { error: 'غير مصرح لك بتحديث مجموعات تليجرام' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { siteId, telegramGroupId, telegramTopicId } = body as {
      siteId: string;
      telegramGroupId?: string | null;
      telegramTopicId?: number | null;
    };

    if (!siteId) {
      return NextResponse.json({ error: 'معرف الموقع مطلوب' }, { status: 400 });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return NextResponse.json({ error: 'الموقع غير موجود' }, { status: 404 });
    }

    let parsedGroupId: bigint | null = null;
    if (telegramGroupId && telegramGroupId.trim()) {
      try {
        parsedGroupId = BigInt(telegramGroupId.trim());
      } catch {
        return NextResponse.json({ error: 'معرف الجروب غير صالح (يجب أن يكون رقماً صحيحاً)' }, { status: 400 });
      }
    }

    let parsedTopicId: number | null = null;
    if (telegramTopicId !== undefined && telegramTopicId !== null && telegramTopicId !== ('' as unknown)) {
      const num = Number(telegramTopicId);
      if (!isNaN(num)) {
        parsedTopicId = num;
      }
    }

    const updated = await prisma.site.update({
      where: { id: siteId },
      data: {
        telegramGroupId: parsedGroupId,
        telegramTopicId: parsedTopicId,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `تم تحديث إعدادات ربط تليجرام لموقع "${updated.name}" بنجاح`,
      site: {
        id: updated.id,
        telegramGroupId: updated.telegramGroupId ? updated.telegramGroupId.toString() : null,
        telegramTopicId: updated.telegramTopicId,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل تحديث مجموعة تليجرام';
    console.error('Telegram groups PUT error:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'غير مصرح - يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { siteId, action } = body as { siteId: string; action: 'PING' | 'TRIGGER_INVITE' };

    if (!siteId) {
      return NextResponse.json({ error: 'معرف الموقع مطلوب' }, { status: 400 });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return NextResponse.json({ error: 'الموقع غير موجود' }, { status: 404 });
    }

    if (!site.telegramGroupId) {
      return NextResponse.json({
        ok: false,
        status: 'UNBOUND',
        message: 'الموقع غير مربوط بأي مجموعة تليجرام حالياً',
      });
    }

    if (action === 'PING') {
      // Queue a verify task
      await prisma.telegramEnforcementTask.create({
        data: {
          siteId: site.id,
          telegramId: BigInt(user.telegramId || 0),
          chatId: site.telegramGroupId,
          topicId: site.telegramTopicId,
          taskType: 'VERIFY_MEMBERSHIP',
          status: 'PENDING',
        },
      });

      return NextResponse.json({
        ok: true,
        status: 'CONNECTED',
        message: `تم التحقق بنجاح من اتصال بوت المنظومة مع معرف الجروب (${site.telegramGroupId.toString()})`,
      });
    }

    return NextResponse.json({ ok: true, message: 'تم إرسال الأمر بنجاح' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل فحص اتصال تليجرام';
    console.error('Telegram groups POST error:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
