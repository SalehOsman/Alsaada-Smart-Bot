import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntrypoint, toRepoPath } from '../governance/common.js';
import {
  GOVERNANCE_LOCK_PATH,
  unlockDashboardFeatureEntry,
  unlockFlowEntry,
  unlockModuleEntry,
  type GovernanceLock,
} from '../governance/verify-governance-lock.js';
import { unlockDocker } from './unlock-docker.js';

export const VALID_APPROVAL_PHRASES = [
  'نعم موافق على التعديل',
  'موافق على الفتح',
  'موافق على التعديل او الايقاف او الحذف',
] as const;

export interface UnlockOptions {
  type: 'flow' | 'dashboard' | 'module' | 'docker';
  targetKey: string;
  phrase: string;
  reason: string;
  root?: string | undefined;
}

export interface UnlockResult {
  ok: boolean;
  type: 'flow' | 'dashboard' | 'module' | 'docker';
  targetKey: string;
  evidenceFile?: string | undefined;
  error?: string | undefined;
}

export function unlockFeature(options: UnlockOptions): UnlockResult {
  const root = options.root ?? process.cwd();
  const { type, targetKey, phrase, reason } = options;

  // 1. Validate verbatim approval phrase
  const trimmedPhrase = phrase?.trim().replace(/^[«"'`]+|[»"'`]+$/g, '').trim();
  const isPhraseValid = (VALID_APPROVAL_PHRASES as readonly string[]).includes(trimmedPhrase as any);
  if (!isPhraseValid) {
    return {
      ok: false,
      type,
      targetKey,
      error: `Invalid approval phrase. Verbatim approved phrase required: 'نعم موافق على التعديل' or 'موافق على الفتح'. Received: '${phrase}'`,
    };
  }

  // 2. Validate reason
  if (!reason || reason.trim().length < 10) {
    return {
      ok: false,
      type,
      targetKey,
      error: 'A detailed justification reason is mandatory (minimum 10 characters).',
    };
  }

  if (type === 'docker') {
    const res = unlockDocker(phrase, reason, root);
    return {
      ok: res.ok,
      type: 'docker',
      targetKey: targetKey || 'docker',
      evidenceFile: res.evidenceFile,
      error: res.error,
    };
  }

  // 3. Inspect governance.lock.json
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) {
    return { ok: false, type, targetKey, error: 'governance.lock.json not found.' };
  }

  let lock: GovernanceLock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
  } catch (err) {
    return { ok: false, type, targetKey, error: `Failed to read ${GOVERNANCE_LOCK_PATH}: ${err}` };
  }

  let directory = '';
  let title = '';
  if (type === 'flow') {
    const entry = lock.lockedFlows?.[targetKey];
    if (!entry) {
      return { ok: false, type, targetKey, error: `Flow '${targetKey}' is not locked in ${GOVERNANCE_LOCK_PATH}.` };
    }
    directory = entry.directory;
    title = entry.titleArabic || entry.flowSlug || targetKey;
  } else if (type === 'dashboard') {
    const entry = lock.lockedDashboardFeatures?.[targetKey];
    if (!entry) {
      return { ok: false, type, targetKey, error: `Dashboard feature '${targetKey}' is not locked in ${GOVERNANCE_LOCK_PATH}.` };
    }
    directory = entry.directory;
    title = entry.title || targetKey;
  } else {
    const entry = lock.lockedModules?.[targetKey];
    if (!entry) {
      return { ok: false, type, targetKey, error: `Module '${targetKey}' is not locked in ${GOVERNANCE_LOCK_PATH}.` };
    }
    directory = entry.directory;
    title = entry.titleArabic || targetKey;
  }

  // 4. Create unlock evidence document in docs/ai-execution-evidence/
  const today = new Date().toISOString().slice(0, 10);
  const safeKey = targetKey.replace(/[^\w.-]/g, '_');
  const evidenceDir = join(root, 'docs', 'ai-execution-evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const evidenceFileName = `${today}-unlock-${type}-${safeKey}.md`;
  const evidenceFilePath = join(evidenceDir, evidenceFileName);

  const typeArabic = type === 'flow' ? 'تدفق البوت' : type === 'dashboard' ? 'شاشة لوحة التحكم' : 'موديول المنظومة';
  const finishCommand = type === 'flow' ? `pnpm flow:finish ${targetKey}` : type === 'dashboard' ? `pnpm dashboard:finish ${targetKey}` : `pnpm module:finish ${targetKey}`;

  const evidenceContent = `# ترخيص فك قفل الحوكمة: ${typeArabic} (${targetKey})

- التاريخ: ${today}
- النوع: ${type.toUpperCase()}
- المعرف: \`${targetKey}\`
- العنوان: ${title}
- المسار البرمجي: \`${directory}\`
- عبارة الاعتماد الصريحة المعتمدة: **${trimmedPhrase}**
- عبارة الحوكمة العامة: موافق على التعديل او الايقاف او الحذف

## المبرر وأسباب التعديل (Reason)
${reason.trim()}

## نطاق التعديل المرخص
تم رفع القفل التشفيري عن المسار \`${directory}\` لإجراء التعديلات المطلوبة.
فور الانتهاء من العمل البرمجي واجتياز كافة الاختبارات، يلزم إعادة ختم وحماية الوظيفة عبر:
\`${finishCommand}\`
`;

  writeFileSync(evidenceFilePath, evidenceContent, 'utf8');

  // 5. Unlock in governance.lock.json
  if (type === 'flow') {
    unlockFlowEntry(root, targetKey);
  } else if (type === 'dashboard') {
    unlockDashboardFeatureEntry(root, targetKey);
  } else {
    unlockModuleEntry(root, targetKey);
  }

  return {
    ok: true,
    type,
    targetKey,
    evidenceFile: toRepoPath(root, evidenceFilePath),
  };
}

if (isCliEntrypoint(import.meta.url)) {
  const args = process.argv.slice(2);
  let type: 'flow' | 'dashboard' | 'module' | 'docker' = 'flow';
  let targetKey = '';
  let phrase = '';
  let reason = '';

  for (const arg of args) {
    if (arg === 'flow' || arg === 'dashboard' || arg === 'module' || arg === 'docker') {
      type = arg;
    } else if (arg.startsWith('--phrase=')) {
      phrase = arg.slice('--phrase='.length);
    } else if (arg.startsWith('-p=')) {
      phrase = arg.slice('-p='.length);
    } else if (arg.startsWith('--reason=')) {
      reason = arg.slice('--reason='.length);
    } else if (arg.startsWith('-r=')) {
      reason = arg.slice('-r='.length);
    } else if (!arg.startsWith('--') && !arg.startsWith('-') && !targetKey) {
      targetKey = arg;
    }
  }

  if (type === 'docker' && !targetKey) {
    targetKey = 'docker';
  }

  if (!targetKey || !phrase || !reason) {
    console.error('❌ Usage: pnpm flow:unlock <targetKey> --phrase="نعم موافق على التعديل" --reason="Detailed reason here"');
    console.error('   Or:    pnpm dashboard:unlock <targetKey> --phrase="نعم موافق على التعديل" --reason="Detailed reason here"');
    console.error('   Or:    pnpm module:unlock <targetKey> --phrase="نعم موافق على التعديل" --reason="Detailed reason here"');
    console.error('   Or:    pnpm docker:unlock --phrase="نعم موافق على التعديل" --reason="Detailed reason here"');
    process.exit(1);
  }

  const result = unlockFeature({ type, targetKey, phrase, reason });
  if (result.ok) {
    console.log(`✅ [UNLOCK] ${result.type.toUpperCase()} '${result.targetKey}' unlocked successfully!`);
    console.log(`- Evidence generated: ${result.evidenceFile}`);
    console.log(`- ${GOVERNANCE_LOCK_PATH} updated.`);
    console.log(`- Please re-lock upon completion using: pnpm ${result.type}:finish ${result.targetKey}`);
    process.exit(0);
  } else {
    console.error(`❌ [UNLOCK FAILED]: ${result.error}`);
    process.exit(1);
  }
}
