import { createHash } from 'node:crypto';
import type { PrismaClient } from '@alsaada/database';
import type {
  ClearanceProfile,
  ClearancePPEAsset,
  PendingDisciplinaryRecord,
  FinalizeClearanceData,
  FieldClearanceReportData,
  PendingClearanceReport,
  WorkerClearanceResult,
  WorkerOffboardingInput,
  WorkerOffboardingResult,
} from './flow.types.js';

function formatPPEAssetName(assetType: string): string {
  const names: Record<string, string> = {
    SAFETY_HELMET: 'خوذة أمان معتمدة',
    SAFETY_SHOES: 'حذاء أمان (سيفتي)',
    HI_VIS_VEST: 'سترة فسفورية عاكسة',
    SAFETY_GOGGLES: 'نظارة حماية ووقاية',
    HARNESS: 'حزام أمان وباراشوت للارتفاعات',
    EAR_PROTECTION: 'سدادات / واقي أذن',
    GLOVES: 'قفازات عمل ميدانية',
    RESPIRATOR: 'كمامة تنفس صناعي',
  };
  return names[assetType] || assetType;
}

export class WorkerOffboardingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ==========================================================================
  // 1. Worker Fetching & Search (Backward Compatible)
  // ==========================================================================

  async getActiveWorkers(siteId?: string, take = 100) {
    return this.prisma.worker.findMany({
      where: {
        isDeleted: false,
        status: { in: ['ACTIVE', 'ON_LEAVE'] },
        ...(siteId ? { siteId } : {}),
      },
      take,
      orderBy: { code: 'asc' },
      select: {
        id: true,
        name: true,
        nickname: true,
        code: true,
        jobTitle: true,
        telegramId: true,
        site: { select: { name: true } },
      },
    });
  }

  async getWorkerById(workerId: string) {
    return this.prisma.worker.findUnique({
      where: { id: workerId },
      include: { site: true, department: true },
    });
  }

  // ==========================================================================
  // 2. Parallel Profile Aggregation (Clearance Profile)
  // ==========================================================================

  async getWorkerClearanceProfile(workerId: string): Promise<ClearanceProfile> {
    const [
      worker,
      activeLeave,
      heldPpeAssets,
      unsettledInstallments,
      disciplinaryRecords,
    ] = await Promise.all([
      this.prisma.worker.findUnique({
        where: { id: workerId },
        include: {
          site: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.leave.findFirst({
        where: {
          workerId,
          actualReturnDate: null,
        },
        orderBy: { departureDate: 'desc' },
      }),
      this.prisma.pPEAsset.findMany({
        where: {
          workerId,
          returnDate: null,
        },
        orderBy: { issueDate: 'desc' },
      }),
      this.prisma.advanceInstallment.findMany({
        where: {
          workerId,
          status: 'PENDING',
        },
        orderBy: { dueMonth: 'asc' },
      }),
      this.prisma.disciplinaryAndBonus.findMany({
        where: { workerId },
        include: {
          worker: {
            select: { id: true, code: true, name: true, nickname: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!worker) {
      throw new Error(`لم يتم العثور على سجل العامل بالمعرف: ${workerId}`);
    }

    // Process Active Leave calculations
    let daysBeforeLeave: number | undefined;
    let daysUntilExpectedReturn: number | undefined;
    if (activeLeave) {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      const dep = new Date(activeLeave.departureDate);
      if (dep.getFullYear() === currentYear && dep.getMonth() === currentMonth) {
        daysBeforeLeave = Math.max(0, Math.min(30, dep.getDate() - 1));
      } else if (dep < new Date(currentYear, currentMonth, 1)) {
        daysBeforeLeave = 0;
      } else {
        daysBeforeLeave = Math.min(30, today.getDate());
      }

      const exp = new Date(activeLeave.expectedReturnDate);
      if (exp.getFullYear() === currentYear && exp.getMonth() === currentMonth) {
        daysUntilExpectedReturn = Math.max(0, Math.min(30, exp.getDate()));
      } else if (exp > new Date(currentYear, currentMonth + 1, 0)) {
        daysUntilExpectedReturn = 30;
      } else {
        daysUntilExpectedReturn = Math.min(30, exp.getDate());
      }
    }

    // Map PPE assets
    const ppeAssets: ClearancePPEAsset[] = heldPpeAssets.map((asset) => {
      const isDamagedOrLost =
        asset.condition === 'DAMAGED_NATURAL' || asset.condition === 'LOST_NEGLIGENT';
      return {
        id: asset.id,
        voucherId: asset.voucherId,
        assetType: asset.assetType,
        name: formatPPEAssetName(asset.assetType),
        condition: asset.condition,
        costPrice: Number(asset.costPrice),
        isDamagedOrLost,
        deductionAmount: 0,
        photoUri: null,
        returnDate: asset.returnDate,
        issueDate: asset.issueDate,
      };
    });

    // Map Advances
    const mappedInstallments = unsettledInstallments.map((inst) => ({
      id: inst.id,
      originalVoucherNumber: inst.originalVoucherNumber,
      installmentSequence: inst.installmentSequence,
      dueMonth: inst.dueMonth,
      installmentAmount: Number(inst.installmentAmount),
      status: inst.status,
      dueDate: null,
    }));

    const totalOutstandingAdvances = mappedInstallments.reduce(
      (sum, inst) => sum + inst.installmentAmount,
      0
    );

    // Map Disciplinary and Bonus records
    const pendingDisciplinary: PendingDisciplinaryRecord[] = [];
    const approvedDisciplinary: PendingDisciplinaryRecord[] = [];

    let totalPendingPenalties = 0;
    let totalPendingBonuses = 0;
    let totalPendingPenaltyDays = 0;
    let totalPendingBonusDays = 0;
    let totalApprovedPenalties = 0;
    let totalApprovedBonuses = 0;
    let totalApprovedPenaltyDays = 0;

    for (const rec of disciplinaryRecords) {
      const amountVal = rec.amount ? Number(rec.amount) : null;
      const daysVal = rec.daysEquivalent ? Number(rec.daysEquivalent) : null;

      const recordItem: PendingDisciplinaryRecord = {
        id: rec.id,
        recordNumber: rec.recordNumber,
        type: rec.type,
        amount: amountVal,
        daysEquivalent: daysVal,
        reason: rec.reason,
        decisionDate: rec.decisionDate,
        appliedToMonth: rec.appliedToMonth,
        createdAt: rec.createdAt,
        requesterName: null,
        workerId: rec.workerId,
        workerName: rec.worker?.nickname || rec.worker?.name,
        workerCode: rec.worker?.code,
      };

      if (rec.approvedByUserId === null) {
        pendingDisciplinary.push(recordItem);
        if (rec.type === 'PENALTY_CASH' && amountVal) totalPendingPenalties += amountVal;
        if (rec.type === 'PENALTY_DAYS' && daysVal) totalPendingPenaltyDays += daysVal;
        if (rec.type === 'BONUS_CASH' && amountVal) totalPendingBonuses += amountVal;
        if (rec.type === 'BONUS_DAYS' && daysVal) totalPendingBonusDays += daysVal;
      } else {
        approvedDisciplinary.push(recordItem);
        if (rec.type === 'PENALTY_CASH' && amountVal) totalApprovedPenalties += amountVal;
        if (rec.type === 'PENALTY_DAYS' && daysVal) totalApprovedPenaltyDays += daysVal;
        if (rec.type === 'BONUS_CASH' && amountVal) totalApprovedBonuses += amountVal;
      }
    }

    return {
      worker: {
        id: worker.id,
        code: worker.code,
        legacyCode: worker.legacyCode,
        name: worker.name,
        nickname: worker.nickname,
        jobTitle: worker.jobTitle,
        dailyWage: Number(worker.dailyWage),
        basicSalary: Number(worker.basicSalary),
        fixedAllowances: Number(worker.fixedAllowances),
        status: worker.status,
        telegramId: worker.telegramId,
        siteId: worker.siteId,
        siteName: worker.site?.name || null,
        departmentName: worker.department?.name || null,
        hireDate: worker.hireDate,
        shiftSystem: worker.shiftSystem,
      },
      activeLeave: activeLeave
        ? {
            id: activeLeave.id,
            leaveNumber: activeLeave.leaveNumber,
            leaveType: activeLeave.leaveType,
            departureDate: activeLeave.departureDate,
            expectedReturnDate: activeLeave.expectedReturnDate,
            actualReturnDate: activeLeave.actualReturnDate,
            status: activeLeave.status,
            daysBeforeLeave,
            daysUntilExpectedReturn,
            overdueDays: activeLeave.overdueDays,
          }
        : null,
      ppeAssets,
      advances: {
        totalOutstandingAdvances,
        unsettledInstallments: mappedInstallments,
      },
      pendingDisciplinaryRecords: pendingDisciplinary,
      approvedDisciplinaryRecords: approvedDisciplinary,
      stats: {
        totalApprovedBonuses,
        totalApprovedPenalties,
        totalApprovedPenaltyDays,
        totalPendingBonuses,
        totalPendingPenalties,
        totalPendingPenaltyDays,
      },
    };
  }

  // ==========================================================================
  // 3. Pending Decisions & Approval Queries
  // ==========================================================================

  async getPendingClearanceReports(): Promise<PendingClearanceReport[]> {
    const tickets = await this.prisma.approvalTicket.findMany({
      where: {
        ticketType: 'END_OF_SERVICE_CLEARANCE',
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    const workerIds = tickets.map((t) => t.entityId).filter(Boolean);
    const workers = await this.prisma.worker.findMany({
      where: { id: { in: workerIds } },
      select: { id: true, code: true, name: true, nickname: true },
    });
    const workerMap = new Map(workers.map((w) => [w.id, w]));

    return tickets.map((t) => {
      let meta: Record<string, unknown> = {};
      try {
        if (t.reviewDecisionNotes && t.reviewDecisionNotes.startsWith('{')) {
          meta = JSON.parse(t.reviewDecisionNotes);
        }
      } catch {
        meta = { rawNotes: t.reviewDecisionNotes };
      }

      const worker = workerMap.get(t.entityId);

      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        workerId: t.entityId,
        workerCode: (meta.workerCode as string) || worker?.code,
        workerName: (meta.workerName as string) || worker?.name,
        workerNickname: worker?.nickname || worker?.name,
        workedDays: typeof meta.workedDays === 'number' ? meta.workedDays : undefined,
        reason: (meta.reason as string) || undefined,
        ppeObservations: (meta.ppeObservations as string) || null,
        notes: (meta.notes as string) || t.reviewDecisionNotes,
        requestedByTelegramId: t.requestedByTelegramId,
        createdAt: t.createdAt,
        status: t.status,
        metadata: meta,
      };
    });
  }

  async getPendingDisciplinaryDecisions(workerId?: string): Promise<PendingDisciplinaryRecord[]> {
    const where: Record<string, unknown> = {
      approvedByUserId: null,
    };
    if (workerId) {
      where.workerId = workerId;
    }

    const records = await this.prisma.disciplinaryAndBonus.findMany({
      where,
      include: {
        worker: {
          select: { id: true, code: true, name: true, nickname: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((rec) => ({
      id: rec.id,
      recordNumber: rec.recordNumber,
      type: rec.type,
      amount: rec.amount ? Number(rec.amount) : null,
      daysEquivalent: rec.daysEquivalent ? Number(rec.daysEquivalent) : null,
      reason: rec.reason,
      decisionDate: rec.decisionDate,
      appliedToMonth: rec.appliedToMonth,
      createdAt: rec.createdAt,
      requesterName: null,
      workerId: rec.workerId,
      workerName: rec.worker?.nickname || rec.worker?.name,
      workerCode: rec.worker?.code,
    }));
  }

  async settleDisciplinaryDecision(
    id: string,
    action: 'APPROVE' | 'REJECT' | 'ADJUST',
    actorId: string,
    amount?: number,
    days?: number
  ): Promise<void> {
    const actorBigInt = BigInt(actorId);
    const existing = await this.prisma.disciplinaryAndBonus.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`لم يتم العثور على القرار الإداري رقم: ${id}`);
    }

    if (action === 'APPROVE') {
      await this.prisma.disciplinaryAndBonus.update({
        where: { id },
        data: {
          approvedByUserId: actorBigInt,
          ...(amount !== undefined ? { amount } : {}),
          ...(days !== undefined ? { daysEquivalent: days } : {}),
        },
      });
    } else if (action === 'REJECT') {
      await this.prisma.disciplinaryAndBonus.update({
        where: { id },
        data: {
          approvedByUserId: actorBigInt,
          amount: 0,
          daysEquivalent: 0,
          reason: `[مستبعد ومرفوض إدارياً] ${existing.reason}`,
        },
      });
    } else if (action === 'ADJUST') {
      await this.prisma.disciplinaryAndBonus.update({
        where: { id },
        data: {
          approvedByUserId: actorBigInt,
          ...(amount !== undefined ? { amount } : {}),
          ...(days !== undefined ? { daysEquivalent: days } : {}),
          reason: `[معدل بقرار الإدارة] ${existing.reason}`,
        },
      });
    }
  }

  async submitFieldClearanceReport(data: FieldClearanceReportData): Promise<string> {
    const ticketNumber = `#TCK-CLR-${Date.now().toString(36).toUpperCase()}`;
    const metadata = {
      workerId: data.workerId,
      workerCode: data.workerCode,
      workedDays: data.workedDays,
      reason: data.reason,
      ppeObservations: data.ppeObservations || null,
      notes: data.notes || null,
      submitterId: String(data.submitterTelegramId ?? data.submittedByUserId ?? '0'),
      siteId: data.siteId || null,
      submittedAt: new Date().toISOString(),
    };

    const ticket = await this.prisma.approvalTicket.create({
      data: {
        ticketNumber,
        ticketType: 'END_OF_SERVICE_CLEARANCE',
        entityId: data.workerId,
        requestedByTelegramId: BigInt(data.submitterTelegramId ?? data.submittedByUserId ?? 0),
        status: 'PENDING',
        reviewDecisionNotes: JSON.stringify(metadata),
      },
    });

    return ticket.ticketNumber;
  }

  // ==========================================================================
  // 4. Atomic Sovereign Clearance Transaction (Master Plan 14)
  // ==========================================================================

  async finalizeWorkerClearance(data: FinalizeClearanceData): Promise<WorkerClearanceResult> {
    const worker = await this.prisma.worker.findUnique({
      where: { id: data.workerId },
      include: { site: true },
    });

    if (!worker) {
      throw new Error('لم يتم العثور على سجل العامل المطلوب اعتماد مخالصته.');
    }

    let targetTelegramId = worker.telegramId;
    if (!targetTelegramId) {
      const linkedUser = await this.prisma.user.findFirst({
        where: { workerId: data.workerId },
        select: { telegramId: true },
      });
      if (linkedUser) {
        targetTelegramId = linkedUser.telegramId;
      }
    }

    const terminationDate = data.terminationDate || new Date();
    const year = terminationDate.getFullYear();
    const count = await this.prisma.workerClearance.count().catch(() => 0);
    const seq = String(count + 1).padStart(4, '0');
    const clearanceNumber = data.clearanceNumber || `#CLR-${year}-${seq}`;
    const clearanceReferenceId = clearanceNumber.replace('#', '');

    const checksumPayload = JSON.stringify({
      clearanceNumber,
      workerId: data.workerId,
      workerCode: worker.code,
      terminationDate: terminationDate.toISOString(),
      earnedSalary: data.earnedSalary,
      totalAdvances: data.totalAdvances,
      netSettlementAmount: data.netSettlementAmount,
      actorTelegramId: data.actorTelegramId.toString(),
    });

    const sha256Checksum =
      data.sha256Checksum ||
      createHash('sha256').update(checksumPayload).digest('hex');

    const isBlacklisted = data.negativeBalanceAction === 'BLACKLISTED';
    const workerStatus = isBlacklisted ? 'BLACKLISTED' : 'TERMINATED';
    const debtSuffix = isBlacklisted
      ? ` [BLACKLISTED - Debt: ${Math.abs(data.netSettlementAmount)} EGP]`
      : '';
    const terminationReason = `${data.reason}${debtSuffix}`;

    const ops: unknown[] = [
      // 1. Create WorkerClearance record
      this.prisma.workerClearance.create({
        data: {
          clearanceNumber,
          workerId: data.workerId,
          terminationDate,
          serviceDurationDays: data.serviceDurationDays || 0,
          accruedLeaveDays: data.accruedLeaveDays || 0,
          endOfServiceGratuity: data.endOfServiceGratuity || 0,
          totalUnpaidSalaries: data.earnedSalary,
          totalOutstandingAdvances: data.totalAdvances,
          custodiesReturned: data.custodiesReturned ?? true,
          ppeReturned: data.ppeReturned ?? true,
          netSettlementAmount: data.netSettlementAmount,
          paymentVoucherNumber: data.paymentVoucherNumber || null,
          receiptPhotoUri: data.receiptPhotoUri || null,
          sha256Checksum,
          status: 'APPROVED',
        },
      }),

      // 2. Update Worker status & unlink telegram
      this.prisma.worker.update({
        where: { id: data.workerId },
        data: {
          status: workerStatus,
          terminationDate,
          terminationReason,
          telegramId: null,
        },
      }),

      // 3. Demote linked User to GUEST and clear worker/site links
      this.prisma.user.updateMany({
        where: {
          OR: [
            ...(targetTelegramId ? [{ telegramId: targetTelegramId }] : []),
            { workerId: data.workerId },
          ],
        },
        data: {
          role: 'GUEST',
          workerId: null,
          assignedSiteId: null,
        },
      }),

      // 4. Close active Leave if exists
      this.prisma.leave.updateMany({
        where: {
          workerId: data.workerId,
          actualReturnDate: null,
        },
        data: {
          actualReturnDate: terminationDate,
          status: 'RESUMED',
        },
      }),

      // 5. Create AuditLog
      this.prisma.auditLog.create({
        data: {
          actorTelegramId: data.actorTelegramId,
          action: 'WORKER_CLEARANCE_FINALIZED',
          entityType: 'WorkerClearance',
          entityId: data.workerId,
          afterPayload: {
            clearanceNumber,
            workerCode: worker.code,
            netSettlementAmount: data.netSettlementAmount,
            status: workerStatus,
            sha256Checksum,
            payoutOption: data.payoutOption || 'WITH_PAYROLL',
            demotedTelegramId: targetTelegramId ? targetTelegramId.toString() : null,
          },
        },
      }),

      // 6. Create OutboxEvent for background sync
      this.prisma.outboxEvent.create({
        data: {
          eventType: 'WORKER_CLEARANCE_FINALIZED',
          aggregateId: data.workerId,
          targetSheet: 'WorkerClearance',
          nextRetryAt: new Date(),
          payload: {
            clearanceNumber,
            clearanceReferenceId,
            workerId: data.workerId,
            workerCode: worker.code,
            workerName: worker.nickname || worker.name,
            terminationDate: terminationDate.toISOString(),
            earnedSalary: data.earnedSalary,
            totalAdvances: data.totalAdvances,
            netSettlementAmount: data.netSettlementAmount,
            status: workerStatus,
            payoutOption: data.payoutOption || 'WITH_PAYROLL',
            sha256Checksum,
          },
        },
      }),
    ];

    // 7. Settle PPEAssets
    if (data.ppeSettlements && data.ppeSettlements.length > 0) {
      for (const ppe of data.ppeSettlements) {
        ops.push(
          this.prisma.pPEAsset.update({
            where: { id: ppe.id },
            data: {
              returnDate: terminationDate,
              condition: ppe.condition,
              isDeductedFromWorker: (ppe.deductionAmount ?? 0) > 0,
            },
          })
        );
      }
      const settledIds = data.ppeSettlements.map((p) => p.id);
      ops.push(
        this.prisma.pPEAsset.updateMany({
          where: {
            workerId: data.workerId,
            returnDate: null,
            id: { notIn: settledIds },
          },
          data: {
            returnDate: terminationDate,
            condition: 'GOOD',
            isDeductedFromWorker: false,
          },
        })
      );
    } else {
      ops.push(
        this.prisma.pPEAsset.updateMany({
          where: {
            workerId: data.workerId,
            returnDate: null,
          },
          data: {
            returnDate: terminationDate,
            condition: 'GOOD',
            isDeductedFromWorker: false,
          },
        })
      );
    }

    // 8. Close pending approval tickets for this worker
    ops.push(
      this.prisma.approvalTicket.updateMany({
        where: {
          entityId: data.workerId,
          ticketType: 'END_OF_SERVICE_CLEARANCE',
          status: 'PENDING',
        },
        data: {
          status: 'APPROVED',
          reviewedByTelegramId: data.actorTelegramId,
          reviewedAt: terminationDate,
          reviewDecisionNotes: `تم اعتماد المخالصة وإصدار السند ${clearanceNumber}`,
        },
      })
    );

    const txFn = this.prisma.$transaction as (arg: unknown) => Promise<unknown>;
    await txFn(ops);

    return {
      success: true,
      clearanceNumber,
      clearanceReferenceId,
      workerId: data.workerId,
      workerName: worker.nickname || worker.name,
      workerCode: worker.code,
      demotedTelegramId: targetTelegramId || null,
      netSettlementAmount: data.netSettlementAmount,
      payoutOption: data.payoutOption || 'WITH_PAYROLL',
      status: workerStatus,
      sha256Checksum,
      message: isBlacklisted
        ? `تم اعتماد المخالصة وإدراج العامل بالقائمة السوداء مع تثبيت مديونية قدرها ${Math.abs(data.netSettlementAmount)} ج.م.`
        : 'تم اعتماد المخالصة المالية وإنهاء الخدمة وهبوط الحساب لدور زائر بنجاح.',
    };
  }

  // ==========================================================================
  // 5. Legacy Offboarding Termination (Backward Compatible)
  // ==========================================================================

  async terminateWorker(input: WorkerOffboardingInput): Promise<WorkerOffboardingResult> {
    const worker = await this.prisma.worker.findUnique({
      where: { id: input.workerId },
    });

    if (!worker) {
      throw new Error('لم يتم العثور على سجل العامل المطلوب إنهاء خدمته.');
    }

    const clearanceReferenceId = `CLR-${Date.now().toString(36).toUpperCase()}`;
    let targetTelegramId = worker.telegramId;
    if (!targetTelegramId) {
      const linkedUser = await this.prisma.user.findFirst({
        where: { workerId: input.workerId },
        select: { telegramId: true },
      });
      if (linkedUser) {
        targetTelegramId = linkedUser.telegramId;
      }
    }

    const ops: unknown[] = [
      this.prisma.worker.update({
        where: { id: input.workerId },
        data: {
          status: 'TERMINATED',
          telegramId: null,
          terminationDate: new Date(),
          terminationReason: input.reason,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorTelegramId: input.actorTelegramId,
          action: 'WORKER_TERMINATED_OFFBOARDED',
          entityType: 'Worker',
          entityId: input.workerId,
          afterPayload: {
            reason: input.reason,
            notes: input.notes || null,
            clearanceReferenceId,
            demotedTelegramId: targetTelegramId ? targetTelegramId.toString() : null,
          },
        },
      }),
      this.prisma.outboxEvent.create({
        data: {
          eventType: 'WORKER_OFFBOARDED_COMMITTED',
          aggregateId: input.workerId,
          targetSheet: 'WorkerOffboarding',
          nextRetryAt: new Date(),
          payload: {
            workerId: input.workerId,
            workerCode: input.workerCode,
            clearanceReferenceId,
            demotedTelegramId: targetTelegramId ? targetTelegramId.toString() : null,
          },
        },
      }),
      this.prisma.user.updateMany({
        where: {
          OR: [
            ...(targetTelegramId ? [{ telegramId: targetTelegramId }] : []),
            { workerId: input.workerId },
          ],
        },
        data: {
          role: 'GUEST',
          workerId: null,
          assignedSiteId: null,
        },
      }),
    ];

    const txFn = this.prisma.$transaction as (arg: unknown) => Promise<unknown>;
    await txFn(ops);

    return {
      success: true,
      clearanceReferenceId,
      workerName: worker.nickname || worker.name,
      workerCode: worker.code,
      demotedTelegramId: targetTelegramId || null,
      message: 'تم اعتماد المخالصة وإنهاء الخدمة وهبوط الحساب لدور زائر بنجاح.',
    };
  }
}
