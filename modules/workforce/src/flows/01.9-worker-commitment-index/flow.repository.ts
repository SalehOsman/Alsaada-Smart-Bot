import { PrismaClient, Prisma } from '@alsaada/database';
import type { WorkerCommitmentInput, WorkerCommitmentResult } from './flow.types.js';

export class WorkerCommitmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findWorkerByIdOrCode(identifier: string) {
    return this.prisma.worker.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { id: identifier },
          { code: identifier },
          { legacyCode: identifier },
        ],
      },
      include: {
        site: true,
        department: true,
      },
    });
  }

  async findWorkerByTelegramId(telegramId: bigint) {
    return this.prisma.worker.findFirst({
      where: {
        isDeleted: false,
        telegramId,
      },
      include: {
        site: true,
        department: true,
      },
    });
  }

  async getWorkerEvaluationData(workerId: string, periodDays = 90): Promise<WorkerCommitmentInput | null> {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        site: true,
        department: true,
        leaves: {
          where: {
            departureDate: {
              gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
            },
          },
        },
        disciplinaryAndBonuses: {
          where: {
            decisionDate: {
              gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
            },
          },
        },
        ppeAssets: true,
        advanceRequests: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    });

    if (!worker) return null;

    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    return {
      workerId: worker.id,
      workerName: worker.name,
      nickname: worker.nickname,
      workerCode: worker.code,
      contractType: worker.contractType,
      hireDate: worker.hireDate,
      siteId: worker.siteId ?? null,
      siteName: worker.site?.name ?? null,
      jobTitle: worker.jobTitle ?? null,
      evaluationDate: periodEnd,
      periodStart,
      periodEnd,
      leaves: worker.leaves.map((l) => ({
        departureDate: l.departureDate,
        expectedReturnDate: l.expectedReturnDate,
        actualReturnDate: l.actualReturnDate ?? null,
        overdueDays: l.overdueDays,
        isOverstayPardoned: l.isOverstayPardoned,
        overstayPardonReason: l.overstayPardonReason ?? null,
        status: l.status,
      })),
      disciplinaryRecords: worker.disciplinaryAndBonuses.map((d) => ({
        type: d.type,
        decisionDate: d.decisionDate,
        reason: d.reason ?? null,
        amount: d.amount ? Number(d.amount) : null,
        daysEquivalent: d.daysEquivalent ? Number(d.daysEquivalent) : null,
      })),
      ppeAssets: worker.ppeAssets.map((p) => ({
        assetType: p.assetType,
        condition: p.condition,
        status: p.status,
        isDeductedFromWorker: p.isDeductedFromWorker,
      })),
      advanceRecords: worker.advanceRequests.map((a) => ({
        amountRequested: Number(a.amountRequested),
        approvedAmount: a.approvedAmount ? Number(a.approvedAmount) : null,
        status: a.status,
      })),
    };
  }

  async getAllWorkersForEvaluation(siteId?: string, periodDays = 90): Promise<WorkerCommitmentInput[]> {
    const where: Prisma.WorkerWhereInput = {
      isDeleted: false,
      status: 'ACTIVE',
    };
    if (siteId) {
      where.siteId = siteId;
    }

    const workers = await this.prisma.worker.findMany({
      where,
      include: {
        site: true,
        leaves: {
          where: {
            departureDate: {
              gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
            },
          },
        },
        disciplinaryAndBonuses: {
          where: {
            decisionDate: {
              gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
            },
          },
        },
        ppeAssets: true,
        advanceRequests: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    return workers.map((worker) => ({
      workerId: worker.id,
      workerName: worker.name,
      nickname: worker.nickname ?? null,
      workerCode: worker.code,
      contractType: worker.contractType,
      hireDate: worker.hireDate,
      siteId: worker.siteId ?? null,
      siteName: worker.site?.name ?? null,
      jobTitle: worker.jobTitle ?? null,
      evaluationDate: periodEnd,
      periodStart,
      periodEnd,
      leaves: worker.leaves.map((l) => ({
        departureDate: l.departureDate,
        expectedReturnDate: l.expectedReturnDate,
        actualReturnDate: l.actualReturnDate ?? null,
        overdueDays: l.overdueDays,
        isOverstayPardoned: l.isOverstayPardoned,
        overstayPardonReason: l.overstayPardonReason ?? null,
        status: l.status,
      })),
      disciplinaryRecords: worker.disciplinaryAndBonuses.map((d) => ({
        type: d.type,
        decisionDate: d.decisionDate,
        reason: d.reason ?? null,
        amount: d.amount ? Number(d.amount) : null,
        daysEquivalent: d.daysEquivalent ? Number(d.daysEquivalent) : null,
      })),
      ppeAssets: worker.ppeAssets.map((p) => ({
        assetType: p.assetType,
        condition: p.condition,
        status: p.status,
      })),
      advanceRecords: worker.advanceRequests.map((a) => ({
        amountRequested: Number(a.amountRequested),
        approvedAmount: a.approvedAmount ? Number(a.approvedAmount) : null,
        status: a.status,
      })),
    }));
  }

  async saveCommitmentScore(score: WorkerCommitmentResult, calculatedBy = 'SYSTEM', snapshotKey?: string) {
    const scoreNumber = `WCS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (snapshotKey) {
      return this.prisma.workerCommitmentScore.upsert({
        where: {
          workerId_snapshotKey: {
            workerId: score.workerId,
            snapshotKey,
          },
        },
        create: {
          scoreNumber,
          workerId: score.workerId,
          siteId: score.siteId ?? null,
          evaluationDate: score.evaluationDate,
          periodStart: score.periodStart,
          periodEnd: score.periodEnd,
          totalScore: score.totalScore,
          tier: score.tier,
          contractTypeEvaluated: score.contractTypeEvaluated,
          leaveShiftScore: score.leaveShiftScore,
          disciplinaryScore: score.disciplinaryScore,
          ppeScore: score.ppeScore,
          financialScore: score.financialScore,
          breakdown: score.breakdown as unknown as Prisma.InputJsonValue,
          recoveryGuidance: score.recoveryGuidance,
          sha256Checksum: score.sha256Checksum,
          snapshotKey,
          calculatedBy,
        },
        update: {
          totalScore: score.totalScore,
          tier: score.tier,
          leaveShiftScore: score.leaveShiftScore,
          disciplinaryScore: score.disciplinaryScore,
          ppeScore: score.ppeScore,
          financialScore: score.financialScore,
          breakdown: score.breakdown as unknown as Prisma.InputJsonValue,
          recoveryGuidance: score.recoveryGuidance,
          sha256Checksum: score.sha256Checksum,
          evaluationDate: score.evaluationDate,
          calculatedBy,
        },
      });
    }

    return this.prisma.workerCommitmentScore.create({
      data: {
        scoreNumber,
        workerId: score.workerId,
        siteId: score.siteId ?? null,
        evaluationDate: score.evaluationDate,
        periodStart: score.periodStart,
        periodEnd: score.periodEnd,
        totalScore: score.totalScore,
        tier: score.tier,
        contractTypeEvaluated: score.contractTypeEvaluated,
        leaveShiftScore: score.leaveShiftScore,
        disciplinaryScore: score.disciplinaryScore,
        ppeScore: score.ppeScore,
        financialScore: score.financialScore,
        breakdown: score.breakdown as unknown as Prisma.InputJsonValue,
        recoveryGuidance: score.recoveryGuidance,
        sha256Checksum: score.sha256Checksum,
        calculatedBy,
      },
    });
  }

  async getSites() {
    return this.prisma.site.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async getWorkersForPicker(siteId?: string) {
    const where: Prisma.WorkerWhereInput = {
      isDeleted: false,
      status: 'ACTIVE',
    };
    if (siteId) {
      where.siteId = siteId;
    }

    return this.prisma.worker.findMany({
      where,
      select: {
        id: true,
        code: true,
        legacyCode: true,
        aliases: true,
        name: true,
        nickname: true,
        jobTitle: true,
        siteId: true,
        site: {
          select: {
            id: true,
            name: true,
          },
        },
        commitmentScores: {
          take: 1,
          orderBy: { evaluationDate: 'desc' },
          select: {
            totalScore: true,
            tier: true,
          },
        },
      },
      orderBy: [{ nickname: 'asc' }, { name: 'asc' }],
    });
  }
}

