import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/auth';
import { studioProcessManager } from '../../../../../lib/studio-process';

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'يرجى تسجيل الدخول أولاً' },
      { status: 401 }
    );
  }

  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'غير مصرح - قمرة استوديو قاعدة البيانات مخصصة حصرياً للسوبر أدمن' },
      { status: 403 }
    );
  }

  const status = await studioProcessManager.getStatus();
  return NextResponse.json(status);
}
