import { formatBreadcrumbs } from '../formatting/telegram-formatters.js';
import type { WorkerCommitmentResult, CommitmentTier } from './types.js';

export interface FormatCommitmentCardOptions {
  includeBreadcrumbs?: boolean;
  breadcrumbsPath?: string[];
  includeRecoveryGuidance?: boolean;
  includeForensicHash?: boolean;
}

export function buildProgressBar(score: number, tier: CommitmentTier): string {
  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const filledCount = Math.round(boundedScore / 10);
  const emptyCount = 10 - filledCount;

  let fillChar = '🟩';
  if (tier === 'MODERATE') fillChar = '🟨';
  else if (tier === 'UNDER_REVIEW') fillChar = '🟥';
  else if (tier === 'PROBATION') fillChar = '⬜';

  return `${fillChar.repeat(filledCount)}${'⬛'.repeat(emptyCount)} ${boundedScore}%`;
}

export function formatCommitmentBadge(
  data: { totalScore: number; tier: CommitmentTier; tierArabic: string; tierBadge: string }
): string {
  return `⭐ مؤشر الالتزام: ${data.tierBadge} *${data.tierArabic}* (${data.totalScore}/100)`;
}

export function formatCommitmentCard(
  result: WorkerCommitmentResult,
  options: FormatCommitmentCardOptions = {}
): string {
  const {
    includeBreadcrumbs = true,
    breadcrumbsPath = ['👤 شؤون العاملين', '⭐ مؤشر الالتزام والموثوقية', '📊 تقرير الأداء'],
    includeRecoveryGuidance = true,
    includeForensicHash = true,
  } = options;

  const displayName = result.nickname || result.workerName;
  const siteStr = result.siteName ? ` | 📍 *الموقع:* ${result.siteName}` : '';
  const jobStr = result.jobTitle ? `💼 *الوظيفة:* ${result.jobTitle}` : '';

  const progressBar = buildProgressBar(result.totalScore, result.tier);

  const lines: string[] = [];

  const breadcrumbPrefix = includeBreadcrumbs && breadcrumbsPath.length > 0
    ? formatBreadcrumbs(breadcrumbsPath)
    : '';

  lines.push('⭐ *بطاقة مؤشر التزام وموثوقية العامل*');
  lines.push('━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`• *العامل:* *${displayName}* (\`#${result.workerCode}\`)`);
  if (jobStr || siteStr) {
    lines.push(`• ${jobStr}${siteStr}`);
  }
  lines.push(`• *نوع التعاقد:* ${result.contractTypeEvaluated === 'DAILY_LABOR' ? 'عمالة يومية' : result.contractTypeEvaluated === 'SEASONAL' ? 'موسمي' : 'دائم'}`);
  lines.push(`• *التقييم العام:* ${result.tierBadge} *${result.tierArabic}* (*${result.totalScore}/100*)`);
  lines.push(progressBar);
  lines.push('━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📊 *المحاور الوزنية للأداء (من 100 نقطة):*');
  lines.push(`• ⏱️ *انضباط الإجازات والورديات:* *${result.leaveShiftScore}* / 40`);
  lines.push(`• ⚖️ *السجل التأديبي والتميز:* *${result.disciplinaryScore}* / 30`);
  lines.push(`• 🦺 *سلامة مهمات الوقاية (PPE):* *${result.ppeScore}* / 15`);
  lines.push(`• 💰 *الجدارة المالية والسلف:* *${result.financialScore}* / 15`);

  if (includeRecoveryGuidance && result.recoveryGuidance) {
    lines.push('━━━━━━━━━━━━━━━━━━━━━');
    lines.push('💡 *إرشادات تحسين التقييم والمحافظة عليه:*');
    lines.push(result.recoveryGuidance);
  }

  if (includeForensicHash && result.sha256Checksum) {
    lines.push('────────────────────────────');
    lines.push(`🔐 *الرمز الجنائي للتدقيق:* \`${result.sha256Checksum.slice(0, 16)}...\``);
  }

  return `${breadcrumbPrefix}${lines.join('\n')}`;
}
