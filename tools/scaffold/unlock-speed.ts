import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntrypoint, toRepoPath } from '../governance/common.js';
import {
  GOVERNANCE_LOCK_PATH,
  unlockSpeedEngineEntry,
  type GovernanceLock,
} from '../governance/verify-governance-lock.js';
import { VALID_APPROVAL_PHRASES } from './unlock-feature.js';

export interface UnlockSpeedResult {
  ok: boolean;
  evidenceFile?: string | undefined;
  error?: string | undefined;
}

export function unlockSpeedEngine(phrase: string, reason: string, root = process.cwd()): UnlockSpeedResult {
  // 1. Validate verbatim approval phrase
  const trimmedPhrase = phrase?.trim();
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

  if (!lock.lockedSpeedEngine) {
    return { ok: false, error: 'Speed engine is not locked in governance.lock.json.' };
  }

  // 4. Create unlock evidence document in docs/ai-execution-evidence/
  const today = new Date().toISOString().slice(0, 10);
  const evidenceDir = join(root, 'docs', 'ai-execution-evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const evidenceFileName = `${today}-unlock-speed-engine.md`;
  const evidenceFilePath = join(evidenceDir, evidenceFileName);

  const evidenceContent = `# ترخيص فك قفل الحوكمة: محرك السرعة المؤسسي (Enterprise Speed Engine)

- التاريخ: ${today}
- نوع المكون: محرك السرعة الفائقة المؤسسي (Permanent Speed Engine)
- الحالة: 🔓 تم فك القفل بموجب تفويض معتمد وموثق
- عبارة التفويض المستخدمة: «${trimmedPhrase}»
- مبرر التعديل الرسمي: ${reason}
- الملفات المرخصة للتعديل:
${lock.lockedSpeedEngine.files.map((f) => `  * \`${f.path}\``).join('\n')}

---

### التعهد الإلزامي:
تلتزم أداة التطوير بالحفاظ على الأركان المعمارية السبعة للسرعة الفائقة، وعدم كسر أي فحص أداء أو معيار للـ SLA، وإعادة قفل المحرك فور الانتهاء عبر أمر \`pnpm speed:lock\`.
`;

  writeFileSync(evidenceFilePath, evidenceContent, 'utf8');

  // 5. Unlock speed engine entry in governance.lock.json
  const unlockRes = unlockSpeedEngineEntry(root);
  if (!unlockRes.ok) {
    return { ok: false, error: unlockRes.error };
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
    }
  }

  if (!phrase || !reason) {
    console.error('❌ Usage: pnpm speed:unlock --phrase="نعم موافق على التعديل" --reason="Detailed reason here"');
    process.exit(1);
  }

  const result = unlockSpeedEngine(phrase, reason, process.cwd());
  if (result.ok) {
    console.log('✅ [SPEED:UNLOCK] Enterprise Speed Engine unlocked successfully!');
    console.log(`- Evidence generated: ${result.evidenceFile}`);
    console.log('- You may now perform approved adjustments.');
    console.log('- Re-lock upon completion using: pnpm speed:lock');
    process.exit(0);
  } else {
    console.error(`❌ [SPEED:UNLOCK FAILED]: ${result.error}`);
    process.exit(1);
  }
}
