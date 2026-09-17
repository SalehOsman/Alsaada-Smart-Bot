import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/auth';
import { studioProcessManager } from '../../../../../lib/studio-process';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'يرجى تسجيل الدخول أولاً' },
      { status: 401 }
    );
  }

  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'غير مصرح - التحكم في دورة حياة الاستوديو مخصص حصرياً للسوبر أدمن' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const action = body?.action;

    if (!['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json(
        { error: 'INVALID_ACTION', message: 'الإجراء المطلوب غير صالح. الإجراءات المتاحة: start, stop, restart' },
        { status: 400 }
      );
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const actorTelegramId = user.telegramId || '0';

    if (action === 'start') {
      const status = await studioProcessManager.start(actorTelegramId, ipAddress);
      return NextResponse.json({ ok: true, action: 'start', status });
    }

    if (action === 'stop') {
      const status = await studioProcessManager.stop(actorTelegramId, ipAddress, 'MANUAL_STOP');
      return NextResponse.json({ ok: true, action: 'stop', status });
    }

    if (action === 'restart') {
      await studioProcessManager.stop(actorTelegramId, ipAddress, 'MANUAL_RESTART');
      const status = await studioProcessManager.start(actorTelegramId, ipAddress);
      return NextResponse.json({ ok: true, action: 'restart', status });
    }

    return NextResponse.json({ error: 'UNHANDLED_ACTION' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: `فشل تنفيذ العملية: ${String(err)}` },
      { status: 500 }
    );
  }
}
