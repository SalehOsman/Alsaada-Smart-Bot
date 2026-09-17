import { isCliEntrypoint } from '../governance/common.js';
import { unlockFeature } from './unlock-feature.js';

export { unlockFeature };

if (isCliEntrypoint(import.meta.url)) {
  const args = process.argv.slice(2);
  let targetKey = '';
  let phrase = '';
  let reason = '';

  for (const arg of args) {
    if (arg.startsWith('--phrase=')) {
      phrase = arg.slice('--phrase='.length);
    } else if (arg.startsWith('--reason=')) {
      reason = arg.slice('--reason='.length);
    } else if (!arg.startsWith('--') && !targetKey) {
      targetKey = arg;
    }
  }

  if (!targetKey || !phrase || !reason) {
    console.error('❌ Usage: pnpm flow:unlock <flowKey> --phrase="نعم موافق على التعديل" --reason="Detailed reason here"');
    process.exit(1);
  }

  const result = unlockFeature({ type: 'flow', targetKey, phrase, reason });
  if (result.ok) {
    console.log(`✅ [FLOW:UNLOCK] Flow '${result.targetKey}' unlocked successfully!`);
    console.log(`- Evidence generated: ${result.evidenceFile}`);
    console.log(`- Please re-lock upon completion using: pnpm flow:finish ${result.targetKey}`);
    process.exit(0);
  } else {
    console.error(`❌ [FLOW:UNLOCK FAILED]: ${result.error}`);
    process.exit(1);
  }
}
