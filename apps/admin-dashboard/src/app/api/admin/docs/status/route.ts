import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/auth';

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
      { error: 'FORBIDDEN', message: 'غير مصرح - بوابة التوثيق والمعمارية مخصصة للسوبر أدمن' },
      { status: 403 }
    );
  }

  const port = Number(process.env.DOCS_PORT) || 4321;
  const tunnelUrl = process.env.DOCS_TUNNEL_URL || null;

  return NextResponse.json({
    ok: true,
    pageCount: 137,
    adrCount: 37,
    port,
    tunnelUrl,
    timestamp: new Date().toISOString(),
  });
}
