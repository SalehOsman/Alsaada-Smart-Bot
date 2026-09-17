import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntrypoint, toRepoPath } from '../governance/common.js';
import {
  GOVERNANCE_LOCK_PATH,
  unlockDockerEntry,
  type GovernanceLock,
} from '../governance/verify-governance-lock.js';
import { VALID_APPROVAL_PHRASES } from './unlock-feature.js';

export interface UnlockDockerResult {
  ok: boolean;
  evidenceFile?: string | undefined;
  error?: string | undefined;
}

export function unlockDocker(phrase: string, reason: string, root = process.cwd()): UnlockDockerResult {
  // 1. Validate verbatim approval phrase
  const trimmedPhrase = phrase?.trim().replace(/^[«"'`]+|[»"'`]+$/g, '').trim();
  const isPhraseValid = (VALID_APPROVAL_PHRASES as readonly string[]).includes(trimmedPhrase);
  if (!isPhraseValid) {
    return {
      ok: false,
      error: `Invalid approval phrase. Verbatim approved phrase required: 'نعم موافق على التعديل' or 'موافق على الفتح'. Received: '${phrase}'`,
    };
  }

  // 2. Validate reason
  if (!reason || reason.trim().length < 10) {
    return {
      ok: false,
      error: 'A detailed justification reason is mandatory (minimum 10 characters).',
    };
  }

  // 3. Inspect governance.lock.json
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) {
    return { ok: false, error: 'governance.lock.json not found.' };
  }

  let lock: GovernanceLock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
  } catch (err) {
    return { ok: false, error: `Failed to read ${GOVERNANCE_LOCK_PATH}: ${err}` };
  }

  if (!lock.lockedDocker) {
    return { ok: false, error: 'Docker infrastructure is not locked in governance.lock.json.' };
  }

  const unlockedFiles = lock.lockedDocker.files.map((f) => f.path);

  // 4. Create unlock evidence document in docs/ai-execution-evidence/
  const today = new Date().toISOString().slice(0, 10);
  const evidenceDir = join(root, 'docs', 'ai-execution-evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const evidenceFileName = `${today}-unlock-docker.md`;
  const evidenceFilePath = join(evidenceDir, evidenceFileName);

  const evidenceContent = `# ترخيص فك قفل الحوكمة: البنية التحتية والدوكر (Docker Infrastructure)

- **التاريخ:** ${today}
- **المكون:** Docker & Infrastructure Configuration
- **المسار:** \`docker/\` و \`docker-compose.yml\`
- **عبارة الاعتماد الصريحة المعتمدة:** **${trimmedPhrase}**
- **عبارة الحوكمة العامة:** موافق على التعديل او الايقاف او الحذف
- **Target-Paths:** ${unlockedFiles.join(', ')}

## المبرر وأسباب التعديل (Reason)
${reason.trim()}

## نطاق التعديل المرخص
تم رفع القفل التشفيري عن ملفات تكوين الحاويات والبنية التحتية:
${unlockedFiles.map((f) => `- \`${f}\``).join('\n')}

فور الانتهاء من العمل البرمجي واجتياز كافة الاختبارات، يلزم إعادة ختم وحماية ملفات الدوكر عبر:
\`pnpm docker:lock\`
`;

  writeFileSync(evidenceFilePath, evidenceContent, 'utf8');

  // 5. Remove lockedDocker from governance.lock.json
  const res = unlockDockerEntry(root);
  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  return {
    ok: true,
    evidenceFile: toRepoPath(root, evidenceFilePath),
  };
}

if (isCliEntrypoint(import.meta.url)) {
  const args = process.argv.slice(2);
  let phrase = '';
  let reason = '';

  for (const arg of args) {
    if (arg.startsWith('--phrase=')) {
      phrase = arg.slice('--phrase='.length);
    } else if (arg.startsWith('--reason=')) {
      reason = arg.slice('--reason='.length);
    } else if (arg.startsWith('-p=')) {
      phrase = arg.slice('-p='.length);
    } else if (arg.startsWith('-r=')) {
      reason = arg.slice('-r='.length);
    }
  }

  if (!phrase || !reason) {
    console.error('❌ Usage: pnpm docker:unlock --phrase="نعم موافق على التعديل" --reason="Detailed justification here"');
    process.exit(1);
  }

  const result = unlockDocker(phrase, reason, process.cwd());
  if (result.ok) {
    console.log('✅ [DOCKER UNLOCK] Docker infrastructure unlocked successfully!');
    console.log(`- Evidence generated: ${result.evidenceFile}`);
    console.log(`- ${GOVERNANCE_LOCK_PATH} updated.`);
    console.log('- Please re-lock upon completion using: pnpm docker:lock');
    process.exit(0);
  } else {
    console.error(`❌ [DOCKER UNLOCK FAILED]: ${result.error}`);
    process.exit(1);
  }
}
