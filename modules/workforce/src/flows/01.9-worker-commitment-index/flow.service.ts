import ExcelJS from 'exceljs';
import {
  WorkerCommitmentEngine,
  filterWorkers,
  paginateItems,
} from '@alsaada/core-components';
import { formatDateDMY } from '@alsaada/regional-engine';
import { WorkerCommitmentRepository } from './flow.repository.js';
import type {
  WorkerCommitmentResult,
  CommitmentListResult,
  CommitmentScoreListItem,
  CommitmentStatsSummary,
  WorkerCommitmentPickerItem,
  WorkerPickerResult,
  CommitmentTier,
} from './flow.types.js';

export class WorkerCommitmentService {
  constructor(private readonly repository: WorkerCommitmentRepository) {}

  async evaluateWorker(workerIdOrCode: string, calculatedBy = 'SYSTEM'): Promise<WorkerCommitmentResult | null> {
    const worker = await this.repository.findWorkerByIdOrCode(workerIdOrCode);
    if (!worker) return null;

    const input = await this.repository.getWorkerEvaluationData(worker.id);
    if (!input) return null;

    const result = WorkerCommitmentEngine.calculateScore(input);

    // Asynchronously cache/persist score for audit
    this.repository.saveCommitmentScore(result, calculatedBy).catch(() => {});

    return result;
  }

  async evaluateWorkerByTelegramId(telegramId: bigint): Promise<WorkerCommitmentResult | null> {
    const worker = await this.repository.findWorkerByTelegramId(telegramId);
    if (!worker) return null;
    return this.evaluateWorker(worker.id);
  }

  async getWorkersUnderReview(options: {
    siteId?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  }): Promise<CommitmentListResult> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.max(1, options.pageSize || 8);

    const allWorkerInputs = await this.repository.getAllWorkersForEvaluation(options.siteId);
    const evaluated: CommitmentScoreListItem[] = [];

    for (const input of allWorkerInputs) {
      const res = WorkerCommitmentEngine.calculateScore(input);
      if (res.tier === 'UNDER_REVIEW') {
        evaluated.push({
          workerId: res.workerId,
          workerCode: res.workerCode,
          workerName: res.workerName,
          nickname: res.nickname,
          siteId: res.siteId,
          siteName: res.siteName,
          jobTitle: res.jobTitle,
          contractType: res.contractTypeEvaluated,
          totalScore: res.totalScore,
          tier: res.tier,
          tierBadge: res.tierBadge,
          tierArabic: res.tierArabic,
          leaveShiftScore: res.leaveShiftScore,
          disciplinaryScore: res.disciplinaryScore,
          ppeScore: res.ppeScore,
          financialScore: res.financialScore,
        });
      }
    }

    // Sort ascending by score (worst first)
    evaluated.sort((a, b) => a.totalScore - b.totalScore);

    const total = evaluated.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const items = evaluated.slice((page - 1) * pageSize, page * pageSize);

    return { items, total, page, totalPages, siteId: options.siteId };
  }

  async getHonorRoll(options: {
    siteId?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  }): Promise<CommitmentListResult> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.max(1, options.pageSize || 8);

    const allWorkerInputs = await this.repository.getAllWorkersForEvaluation(options.siteId);
    const evaluated: CommitmentScoreListItem[] = [];

    for (const input of allWorkerInputs) {
      const res = WorkerCommitmentEngine.calculateScore(input);
      if (res.tier === 'COMMITTED' && res.totalScore >= 80) {
        evaluated.push({
          workerId: res.workerId,
          workerCode: res.workerCode,
          workerName: res.workerName,
          nickname: res.nickname,
          siteId: res.siteId,
          siteName: res.siteName,
          jobTitle: res.jobTitle,
          contractType: res.contractTypeEvaluated,
          totalScore: res.totalScore,
          tier: res.tier,
          tierBadge: res.tierBadge,
          tierArabic: res.tierArabic,
          leaveShiftScore: res.leaveShiftScore,
          disciplinaryScore: res.disciplinaryScore,
          ppeScore: res.ppeScore,
          financialScore: res.financialScore,
        });
      }
    }

    // Sort descending by score (best first)
    evaluated.sort((a, b) => b.totalScore - a.totalScore);

    const total = evaluated.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const items = evaluated.slice((page - 1) * pageSize, page * pageSize);

    return { items, total, page, totalPages, siteId: options.siteId };
  }

  async getStatsSummary(siteId?: string): Promise<CommitmentStatsSummary> {
    const allWorkerInputs = await this.repository.getAllWorkersForEvaluation(siteId);
    let totalScoreSum = 0;
    let committedCount = 0;
    let moderateCount = 0;
    let underReviewCount = 0;
    let probationCount = 0;

    for (const input of allWorkerInputs) {
      const res = WorkerCommitmentEngine.calculateScore(input);
      totalScoreSum += res.totalScore;
      if (res.tier === 'COMMITTED') committedCount++;
      else if (res.tier === 'MODERATE') moderateCount++;
      else if (res.tier === 'UNDER_REVIEW') underReviewCount++;
      else if (res.tier === 'PROBATION') probationCount++;
    }

    const totalEvaluated = allWorkerInputs.length;
    const averageScore = totalEvaluated > 0 ? Math.round(totalScoreSum / totalEvaluated) : 100;

    return {
      totalEvaluated,
      committedCount,
      moderateCount,
      underReviewCount,
      probationCount,
      averageScore,
    };
  }

  async exportCommitmentExcel(siteId?: string, siteName?: string): Promise<Buffer> {
    const allInputs = await this.repository.getAllWorkersForEvaluation(siteId);
    const results = allInputs.map((inp) => WorkerCommitmentEngine.calculateScore(inp));

    // Sort descending by score
    results.sort((a, b) => b.totalScore - a.totalScore);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'منظومة السعادة سمارت بوت';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('مؤشر التزام العمال', {
      views: [{ rightToLeft: true, state: 'frozen', xSplit: 0, ySplit: 4 }],
    });

    const columns = [
      { header: 'م', key: 'seq', width: 6 },
      { header: 'كود العامل', key: 'code', width: 16 },
      { header: 'اسم الشهرة', key: 'nickname', width: 18 },
      { header: 'الاسم الرباعي', key: 'fullName', width: 28 },
      { header: 'الموقع الميداني', key: 'site', width: 22 },
      { header: 'المسمى الوظيفي', key: 'jobTitle', width: 22 },
      { header: 'نوع التعاقد', key: 'contractType', width: 16 },
      { header: 'انضباط الدوام (40)', key: 'leaveScore', width: 18 },
      { header: 'السجل التأديبي (30)', key: 'discScore', width: 18 },
      { header: 'مهمات السلامة (15)', key: 'ppeScore', width: 18 },
      { header: 'الانضباط المالي (15)', key: 'finScore', width: 18 },
      { header: 'المجموع الكلي (100)', key: 'totalScore', width: 20 },
      { header: 'مستوى الالتزام', key: 'tier', width: 18 },
      { header: 'إرشادات التحسين والملاحظات', key: 'guidance', width: 45 },
    ];

    // 1. Title row
    sheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = 'شركة السعادة للمقاولات العامة والتعدين — كشف تقييم ومؤشر التزام وموثوقية العمال';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 36;

    // 2. Metadata row
    sheet.mergeCells(2, 1, 2, columns.length);
    const metaCell = sheet.getCell(2, 1);
    const siteLabel = siteName || 'كافة المواقع التشغيلية';
    metaCell.value = `📅 تاريخ الاستخراج: ${formatDateDMY(new Date())}   |   📍 نطاق الموقع: ${siteLabel}   |   👥 إجمالي العمالة المقيمة: ${results.length} عامل`;
    metaCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF2C3E50' }, bold: true };
    metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 24;

    sheet.getRow(3).height = 8;

    // 3. Headers
    columns.forEach((col, idx) => {
      const cell = sheet.getCell(4, idx + 1);
      cell.value = col.header;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      sheet.getColumn(idx + 1).width = col.width;
    });
    sheet.getRow(4).height = 28;

    // 4. Data rows
    results.forEach((r, idx) => {
      const rowIdx = idx + 5;
      const row = sheet.getRow(rowIdx);
      row.values = [
        idx + 1,
        r.workerCode,
        r.nickname || '—',
        r.workerName,
        r.siteName || 'الموقع العام',
        r.jobTitle || 'عامل تشغيل',
        r.contractTypeEvaluated === 'DAILY_LABOR' ? 'عمالة يومية' : r.contractTypeEvaluated === 'SEASONAL' ? 'موسمي' : 'دائم',
        r.leaveShiftScore,
        r.disciplinaryScore,
        r.ppeScore,
        r.financialScore,
        r.totalScore,
        `${r.tierBadge} ${r.tierArabic}`,
        r.recoveryGuidance.replace(/\n/g, ' | '),
      ];

      // Formatting
      for (let c = 1; c <= columns.length; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: c >= 8 && c <= 13 ? 'center' : 'right' };
      }

      // Highlight total score cell
      const scoreCell = row.getCell(12);
      scoreCell.font = { name: 'Segoe UI', size: 11, bold: true };
      if (r.tier === 'COMMITTED') {
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
      } else if (r.tier === 'MODERATE') {
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      } else if (r.tier === 'UNDER_REVIEW') {
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
      }

      row.height = 22;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async getWorkersPickerPage(options: {
    siteId?: string | undefined;
    search?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  }): Promise<WorkerPickerResult> {
    const rawWorkers = await this.repository.getWorkersForPicker(options.siteId);

    const mappedWorkers: WorkerCommitmentPickerItem[] = rawWorkers.map((w) => {
      const latestScore = w.commitmentScores[0];
      let tierBadge = '⚪ 🆕';
      let tier: CommitmentTier | undefined = undefined;
      let score: number | undefined = undefined;

      if (latestScore) {
        score = latestScore.totalScore;
        tier = latestScore.tier as CommitmentTier;
        if (tier === 'COMMITTED') {
          tierBadge = '🟢';
        } else if (tier === 'MODERATE') {
          tierBadge = '🟡';
        } else if (tier === 'UNDER_REVIEW') {
          tierBadge = '🔴';
        } else {
          tierBadge = '⚪ 🆕';
        }
      }

      return {
        id: w.id,
        code: w.code,
        legacyCode: w.legacyCode,
        aliases: w.aliases ?? [],
        name: w.name,
        nickname: w.nickname,
        jobTitle: w.jobTitle ?? undefined,
        siteLocation: w.site?.name ?? undefined,
        score,
        tier,
        tierBadge,
        hasEvaluation: Boolean(latestScore),
      };
    });

    const filtered = options.search && options.search.trim().length > 0
      ? (filterWorkers(mappedWorkers, { query: options.search }) as WorkerCommitmentPickerItem[])
      : mappedWorkers;

    const pageSize = Math.max(1, options.pageSize || 8);
    const page = Math.max(1, options.page || 1);
    const { items, pagination } = paginateItems(filtered, page, pageSize);
    const siteName = options.siteId ? (rawWorkers.find((w) => w.site?.name)?.site?.name ?? undefined) : undefined;

    return {
      items,
      pagination,
      rawMatchingCount: filtered.length,
      singleMatch: filtered.length === 1 ? filtered[0]! : null,
      siteName,
    };
  }
}

