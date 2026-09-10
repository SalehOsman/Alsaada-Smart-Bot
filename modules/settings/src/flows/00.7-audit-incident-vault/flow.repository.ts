import type { PrismaClient } from '@alsaada/database';
import type { UserJourneyStep, UnresolvedErrorDto, PurgeResultDto } from './flow.types.js';

export class AuditIncidentVaultRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findTelegramIdByWorkerCode(workerCode: string): Promise<bigint | null> {
    const worker = await this.prisma.worker.findFirst({
      where: {
        code: { equals: workerCode.trim(), mode: 'insensitive' },
      },
      include: { user: true },
    });

    return worker?.user?.telegramId ?? null;
  }

  async getUserJourneySteps(telegramId: bigint, limit = 10): Promise<UserJourneyStep[]> {
    const logs = await this.prisma.botPerformanceLog.findMany({
      where: { actorTelegramId: telegramId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return logs.map((l) => ({
      action: l.callbackQueryOrCommand,
      executionTimeMs: l.executionTimeMs,
      performanceTier: l.performanceTier,
      errorMessage: l.errorMessage,
      createdAt: l.timestamp,
    }));

  }

  async listUnresolvedErrors(page = 1, pageSize = 5): Promise<{ total: number; errors: UnresolvedErrorDto[] }> {
    const where = { isResolved: false };
    const total = await this.prisma.systemErrorLog.count({ where });

    const rows = await this.prisma.systemErrorLog.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const errors: UnresolvedErrorDto[] = rows.map((r) => ({
      id: r.id,
      errorReference: r.errorReference,
      errorHash: r.errorHash,
      occurrenceCount: r.occurrenceCount,
      severity: r.severity,
      errorMessage: r.errorMessage,
      stackTrace: r.stackTrace,
      sourceLocation: r.sourceLocation,
      actorTelegramId: r.actorTelegramId,
      actorRole: r.actorRole,
      actionTrigger: r.actionTrigger,
      lastSeenAt: r.lastSeenAt,
      createdAt: r.createdAt,
    }));

    return { total, errors };
  }

  async getErrorById(id: string): Promise<UnresolvedErrorDto | null> {
    const r = await this.prisma.systemErrorLog.findUnique({ where: { id } });
    if (!r) return null;

    return {
      id: r.id,
      errorReference: r.errorReference,
      errorHash: r.errorHash,
      occurrenceCount: r.occurrenceCount,
      severity: r.severity,
      errorMessage: r.errorMessage,
      stackTrace: r.stackTrace,
      sourceLocation: r.sourceLocation,
      actorTelegramId: r.actorTelegramId,
      actorRole: r.actorRole,
      actionTrigger: r.actionTrigger,
      lastSeenAt: r.lastSeenAt,
      createdAt: r.createdAt,
    };
  }

  async resolveError(errorId: string, resolvedById: bigint): Promise<boolean> {
    await this.prisma.systemErrorLog.update({
      where: { id: errorId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedById,
      },
    });
    return true;
  }

  async purgeLogsOlderThan(days = 30): Promise<PurgeResultDto> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const errorResult = await this.prisma.systemErrorLog.deleteMany({
      where: {
        isResolved: true,
        createdAt: { lt: cutoff },
      },
    });

    const perfResult = await this.prisma.botPerformanceLog.deleteMany({
      where: {
        timestamp: { lt: cutoff },
      },
    });


    return {
      purgedErrorsCount: errorResult.count,
      purgedPerformanceLogsCount: perfResult.count,
    };
  }
}
