import { prisma } from '@alsaada/database';
import { extractTraceId, TelemetryLogger } from '@alsaada/telemetry';
import { NextRequest, NextResponse } from 'next/server';
import { getVersionInfo } from '../../../lib/version';

const logger = new TelemetryLogger({
  service: 'admin-dashboard',
  defaultComponent: 'readiness',
});

function healthHeaders(traceId: string): Record<string, string> {
  return {
    'cache-control': 'no-store',
    'x-trace-id': traceId,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = extractTraceId(request);
  const versionInfo = getVersionInfo();

  try {
    await Promise.all([
      prisma.$queryRawUnsafe('SELECT 1'),
      prisma.auditLog.findFirst({
        select: { traceId: true },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.systemErrorLog.findFirst({
        select: { traceId: true, service: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return NextResponse.json(
      {
        status: 'ready',
        service: 'admin-dashboard',
        version: versionInfo.version,
        commitSha: versionInfo.commitSha,
        buildTime: versionInfo.buildTime,
        traceId,
      },
      { status: 200, headers: healthHeaders(traceId) },
    );
  } catch (error) {
    logger.error('Dashboard readiness check failed', {
      traceId,
      component: 'readiness',
      action: 'health.readiness',
      error,
    });

    return NextResponse.json(
      {
        status: 'unavailable',
        service: 'admin-dashboard',
        version: versionInfo.version,
        commitSha: versionInfo.commitSha,
        buildTime: versionInfo.buildTime,
        traceId,
      },
      { status: 503, headers: healthHeaders(traceId) },
    );
  }
}
