import { isCliEntrypoint } from '../governance/common.js';
import { unlockEntity, VALID_UNLOCK_PHRASES } from '../governance/unified-unlock-engine.js';

export function runUnlockCli(argv = process.argv.slice(2), root = process.cwd()): void {
  const args = argv.filter((a) => !a.startsWith('--'));
  const target = args[0];

  const phraseArg = argv.find((a) => a.startsWith('--phrase='));
  const phrase = phraseArg ? phraseArg.replace('--phrase=', '') : '';

  const reasonArg = argv.find((a) => a.startsWith('--reason='));
  const reason = reasonArg ? reasonArg.replace('--reason=', '') : '';

  if (!target) {
    console.error('Usage: pnpm unlock <target> --phrase="موافق على الفتح" --reason="Justification"');
    console.error('Examples:');
    console.error('  pnpm unlock package:regional-engine --phrase="موافق على الفتح" --reason="تحديث العملة"');
    console.error('  pnpm unlock flow:01.1 --phrase="موافق على الفتح" --reason="معالجة حقل السن"');
    console.error('  pnpm unlock dashboard:workforce/new --phrase="موافق على الفتح" --reason="إضافة زر بحث"');
    process.exit(1);
  }

  if (!phrase) {
    console.error('❌ Error: The approval phrase is mandatory.');
    console.error('   You must pass: --phrase="موافق على الفتح" or --phrase="نعم موافق على التعديل"');
    process.exit(1);
  }

  if (!reason) {
    console.error('❌ Error: A detailed reason is mandatory.');
    console.error('   You must pass: --reason="your justification"');
    process.exit(1);
  }

  console.log(`🔓 Unlocking target "${target}"...`);
  const result = unlockEntity(target, { phrase, reason, root });

  if (!result.ok) {
    console.error(`❌ Unlock failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ Successfully unlocked [${result.entityId}]`);
  console.log(`   Evidence written to: ${result.evidenceFile}`);
  console.log('   🔒 Zero Blast Radius: All other entities in the system remain 100% locked.');
}

if (isCliEntrypoint(import.meta.url)) {
  runUnlockCli();
}
