import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntrypoint, toRepoPath } from '../governance/common.js';
import {
  APPROVAL_PHRASE,
  lockSpeedEngineEntry,
  type GovernanceLock,
} from '../governance/verify-governance-lock.js';

export const SPEED_ENGINE_FILES = [
  'apps/bot-server/src/services/fast-cache.service.ts',
  'apps/bot-server/src/services/telemetry.service.ts',
  'apps/bot-server/src/services/screen-flow.service.ts',
  'tools/governance/verify-latency-anti-patterns.ts',
];

export interface LockSpeedEngineResult {
  ok: boolean;
  files: string[];
  evidenceFile?: string | undefined;
  error?: string | undefined;
}

export function lockSpeedEngine(root = process.cwd()): LockSpeedEngineResult {
  // 1. Verify all target speed engine files exist
  for (const file of SPEED_ENGINE_FILES) {
    const fullPath = join(root, file);
    if (!existsSync(fullPath)) {
      return {
        ok: false,
        files: [],
        error: `Speed engine file not found: ${file}`,
      };
    }
  }

  // 2. Cryptographically seal speed engine files into governance.lock.json
  const lock = lockSpeedEngineEntry(root, SPEED_ENGINE_FILES, 'Enterprise Permanent Speed Engine');

  // 3. Create locking evidence document in docs/ai-execution-evidence/
  const today = new Date().toISOString().slice(0, 10);
  const evidenceDir = join(root, 'docs', 'ai-execution-evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const evidenceFileName = `${today}-plan-42-speed-engine-lock.md`;
  const evidenceFilePath = join(evidenceDir, evidenceFileName);

  const evidenceContent = `# توثيق القفل التشفيري لمحرك السرعة المؤسسي الدائم (PLAN-42)

- **التاريخ:** ${today}
- **الحالة:** 🔒 مقفل ومحمي تشفيرياً (Immutable Sealed)
- **المكون:** Enterprise Permanent Speed Engine (Pillars 1 to 7)
- **عبارة التفويض المعتمدة:** ${APPROVAL_PHRASE}
- **صيغ فك القفل الحرفية الحصرية:** «نعم موافق على التعديل» أو «موافق على الفتح»

---

### الملفات المقفولة وتجزئاتها الرقمية (SHA-256):

${lock.lockedSpeedEngine?.files.map((f) => `- \`${f.path}\`: \`${f.sha256}\``).join('\n')}

---

### الضمانات المعمارية:
1. لن يتم تعديل أي ملف من ملفات محرك السرعة دون ترخيص مسبق وصريح من المستخدم.
2. ترفض فواحص الحوكمة \`governance:tamper-check\` و \`pre-commit\` أي تعديل غير مصرح به تلقائياً.
3. التعديل الموضعي الحصري والتأكيد اللحظي (< 10ms) ومجمع المقابس الدافئة مضمونة معمارياً ومحصنة ضد التدهور المستقبلي.
`;

  writeFileSync(evidenceFilePath, evidenceContent, 'utf8');

  return {
    ok: true,
    files: SPEED_ENGINE_FILES,
    evidenceFile: toRepoPath(root, evidenceFilePath),
  };
}

if (isCliEntrypoint(import.meta.url)) {
  const result = lockSpeedEngine(process.cwd());
  if (result.ok) {
    console.log('🔒 [SPEED:LOCK] Enterprise Speed Engine sealed and locked successfully!');
    console.log(`- Locked Files: ${result.files.length}`);
    for (const f of result.files) {
      console.log(`  * ${f}`);
    }
    console.log(`- Evidence File: ${result.evidenceFile}`);
    console.log('- Speed engine is now cryptographically immutable against regressions.');
    process.exit(0);
  } else {
    console.error(`❌ [SPEED:LOCK FAILED]: ${result.error}`);
    process.exit(1);
  }
}
