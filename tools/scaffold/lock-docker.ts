import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntrypoint, toRepoPath } from '../governance/common.js';
import {
  APPROVAL_PHRASE,
  listDockerFiles,
  lockDockerEntry,
} from '../governance/verify-governance-lock.js';

export interface LockDockerResult {
  ok: boolean;
  files: string[];
  evidenceFile?: string | undefined;
  error?: string | undefined;
}

export function lockDocker(root = process.cwd()): LockDockerResult {
  // 1. Verify Docker infrastructure files exist
  const files = listDockerFiles(root);
  if (files.length === 0) {
    return {
      ok: false,
      files: [],
      error: 'No Docker infrastructure files found to lock.',
    };
  }

  // 2. Cryptographically seal Docker infrastructure files into governance.lock.json
  const lock = lockDockerEntry(root);

  // 3. Create locking evidence document in docs/ai-execution-evidence/
  const today = new Date().toISOString().slice(0, 10);
  const evidenceDir = join(root, 'docs', 'ai-execution-evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const evidenceFileName = `${today}-docker-infrastructure-lock.md`;
  const evidenceFilePath = join(evidenceDir, evidenceFileName);

  const lockedFilesList = lock.lockedDocker?.files ?? [];

  const evidenceContent = `# توثيق القفل التشفيري للبنية التحتية والدوكر (Docker Infrastructure Lock)

- **التاريخ:** ${today}
- **الحالة:** 🔒 مقفل ومحمي تشفيرياً (Immutable Sealed)
- **المكون:** Docker & Infrastructure Configuration
- **المسار الأساسي:** \`docker/\` و \`docker-compose.yml\`
- **عبارة التفويض المعتمدة:** ${APPROVAL_PHRASE}
- **صيغ فك القفل الحرفية الحصرية:** «نعم موافق على التعديل» أو «موافق على الفتح»
- **Target-Paths:** ${lockedFilesList.map((f) => f.path).join(', ')}

---

### الملفات المقفولة وتجزئاتها الرقمية (SHA-256):

${lockedFilesList.map((f) => `- \`${f.path}\`: \`${f.sha256}\``).join('\n')}

---

### قواعد الحوكمة الصارمة:
1. يُحظر تعديل أي بايت في ملفات الدوكر أو ملفات التركيب دون فك القفل الصريح عبر:
   \`pnpm docker:unlock --phrase="<عبارة_الموافقة>" --reason="<سبب_مفصل_أكثر_من_10_أحرف>"\`
2. أي تعديل غير مصرح به يؤدي إلى فشل فوري في \`pnpm governance:tamper-check\` وخطافات Git.
3. فور الانتهاء من التعديل المرخص، يلزم إعادة القفل عبر \`pnpm docker:lock\`.
`;

  writeFileSync(evidenceFilePath, evidenceContent, 'utf8');

  return {
    ok: true,
    files: lockedFilesList.map((f) => f.path),
    evidenceFile: toRepoPath(root, evidenceFilePath),
  };
}

if (isCliEntrypoint(import.meta.url)) {
  const result = lockDocker(process.cwd());
  if (result.ok) {
    console.log('✅ [DOCKER LOCK] Docker & Infrastructure cryptographically locked and sealed!');
    console.log(`- Locked files: ${result.files.length}`);
    for (const f of result.files) {
      console.log(`  * ${f}`);
    }
    console.log(`- Evidence file generated: ${result.evidenceFile}`);
    console.log('- governance.lock.json updated successfully.');
    process.exit(0);
  } else {
    console.error(`❌ [DOCKER LOCK FAILED]: ${result.error}`);
    process.exit(1);
  }
}
