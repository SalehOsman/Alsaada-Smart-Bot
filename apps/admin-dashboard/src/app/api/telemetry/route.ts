import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@alsaada/database';
import { getApmTelemetryData } from '@/lib/data-fetchers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('timeRange') as 'all' | '24h' | '7d' | '1h' | null;
    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');
    const tier = searchParams.get('tier');
    const search = searchParams.get('search');
    const lastTimestamp = searchParams.get('lastTimestamp');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    // 1. If client provided lastTimestamp and no forceRefresh, check if new logs exist within requested window
    if (lastTimestamp && !forceRefresh && !search && (!tier || tier === 'ALL') && pageNum === 1) {
      const where: Record<string, unknown> = {};
      if (timeRange && timeRange !== 'all') {
        const durationMs =
          timeRange === '1h'
            ? 60 * 60 * 1000
            : timeRange === '7d'
              ? 7 * 24 * 60 * 60 * 1000
              : 24 * 60 * 60 * 1000;
        where.timestamp = { gte: new Date(Date.now() - durationMs) };
      }

      const latestLog = await prisma.botPerformanceLog.findFirst({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });

      if (latestLog && latestLog.timestamp.toISOString() === lastTimestamp) {
        return NextResponse.json(
          { unchanged: true, timestamp: lastTimestamp },
          { headers: { 'cache-control': 'no-store' } }
        );
      }
    }

    // 2. Fetch fresh telemetry data
    const data = await getApmTelemetryData({
      timeRange: timeRange || 'all',
      page: pageNum,
      pageSize: pageSizeNum,
      tier: tier || undefined,
      search: search || undefined,
      forceRefresh,
    });

    const latestTs = data.latestOps.length > 0 ? data.latestOps[0].timestamp : null;

    return NextResponse.json(
      {
        unchanged: false,
        timestamp: latestTs,
        data,
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (error) {
    console.error('API /api/telemetry error:', error);
    return NextResponse.json(
      { error: 'فشل في استرداد بيانات مرصد الأداء اللحظي' },
      { status: 500 }
    );
  }
}
