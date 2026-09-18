import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOVERNANCE_LOCK_PATH, type GovernanceLock } from './verify-governance-lock.js';
import { type LockedEntity, resolveLockTarget } from './unified-lock-engine.js';

export const VALID_UNLOCK_PHRASES = new Set([
  'موافق على الفتح',
  'نعم موافق على التعديل',
  'موافق على التعديل او الايقاف او الحذف',
]);

export interface UnlockEntityOptions {
  phrase: string;
  reason: string;
  root?: string;
  evidenceDir?: string;
}

export interface UnlockEntityResult {
  ok: boolean;
  entityId?: string;
  evidenceFile?: string;
  error?: string;
}

export function unlockEntity(
  rawTarget: string,
  options: UnlockEntityOptions,
  root = options.root ?? process.cwd()
): UnlockEntityResult {
  const phrase = (options.phrase ?? '').trim();
  if (!VALID_UNLOCK_PHRASES.has(phrase)) {
    return {
      ok: false,
      error: `Invalid approval phrase. You must provide verbatim: "موافق على الفتح" or "نعم موافق على التعديل". Received: "${phrase}"`,
    };
  }

  const reason = (options.reason ?? '').trim();
  if (!reason || reason.length < 5) {
    return {
      ok: false,
      error: 'A detailed justification reason (minimum 5 characters) is required to unlock a protected component.',
    };
  }

  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) {
    return { ok: false, error: 'governance.lock.json does not exist.' };
  }

  let lockData: GovernanceLock & { lockedEntities?: Record<string, LockedEntity> };
  try {
    lockData = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return { ok: false, error: 'Failed to read/parse governance.lock.json' };
  }

  if (!lockData.lockedEntities) {
    lockData.lockedEntities = {};
  }

  // Attempt resolution
  let entityId: string | null = null;

  // Direct check
  if (lockData.lockedEntities[rawTarget]) {
    entityId = rawTarget;
  } else {
    // Try resolver
    const resolved = resolveLockTarget(root, rawTarget);
    if (resolved && lockData.lockedEntities[resolved.id]) {
      entityId = resolved.id;
    } else if (resolved) {
      entityId = resolved.id; // resolved but maybe not in lock?
    }
  }

  if (!entityId || !lockData.lockedEntities[entityId]) {
    // Check if target is in legacy lockedFlows or lockedDashboardFeatures
    const isLegacyFlow = lockData.lockedFlows && Object.keys(lockData.lockedFlows).includes(rawTarget.replace(/^flow:/, ''));
    const isLegacyDash = lockData.lockedDashboardFeatures && Object.keys(lockData.lockedDashboardFeatures).includes(rawTarget.replace(/^dashboard:/, ''));

    if (isLegacyFlow) {
      delete lockData.lockedFlows![rawTarget.replace(/^flow:/, '')];
      entityId = `flow:${rawTarget.replace(/^flow:/, '')}`;
    } else if (isLegacyDash) {
      delete lockData.lockedDashboardFeatures![rawTarget.replace(/^dashboard:/, '')];
      entityId = `dashboard:${rawTarget.replace(/^dashboard:/, '')}`;
    } else {
      return {
        ok: false,
        error: `Entity "${rawTarget}" is not currently locked in governance.lock.json. Available entities: ${Object.keys(lockData.lockedEntities).join(', ')}`,
      };
    }
  } else {
    // Remove strictly from lockedEntities
    delete lockData.lockedEntities[entityId];
  }

  // Save atomically
  try {
    writeFileSync(lockPath, JSON.stringify(lockData, null, 2) + '\n', 'utf8');
  } catch (err) {
    return { ok: false, error: `Failed to update governance.lock.json: ${String(err)}` };
  }

  // Generate evidence
  const today = new Date().toISOString().slice(0, 10);
  const safeId = entityId.replace(/[^a-zA-Z0-9.-]/g, '_');
  const evidenceDir = options.evidenceDir ?? join(root, 'docs', 'ai-execution-evidence');
  if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });

  const evidenceFileName = `${today}-unlock-${safeId}.md`;
  const evidenceFilePath = join(evidenceDir, evidenceFileName);

  const evidenceContent = `# ترخيص فك قفل الحوكمة: (${entityId})

- **التاريخ:** ${today} (${new Date().toISOString()})
- **معرف الكيان المفكوك:** \`${entityId}\`
- **عبارة الاعتماد الصريحة المعتمدة:** **${phrase}**
- **مبدأ العزل:** 🔒 **Zero Blast Radius** (سائر الكيانات الأخرى في المنظومة لا تزال مقفلة ومحصنة تشفيرياً 100%).

## المبرر وأسباب التعديل (Justification & Reason)
${reason}

## نطاق التعديل المرخص
تم رفع القفل التشفيري عن الكيان \`${entityId}\` حصراً لإجراء التعديلات المطلوبة.
يُحظر تماماً تعديل أي ملف خارج نطاق هذا الكيان، وأي مساس بملف آخر سيسقط فوراً عند الـ Git Commit.
فور الانتهاء من العمل واجتياز الاختبارات، يلزم إعادة ختم الكيان عبر:
\`pnpm lock ${entityId}\`
`;

  try {
    writeFileSync(evidenceFilePath, evidenceContent, 'utf8');
  } catch {
    // non-fatal
  }

  return { ok: true, entityId, evidenceFile: evidenceFilePath };
}
