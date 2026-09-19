import { execFileSync } from 'node:child_process';
import { createResult, fail, printAndExit, isCliEntrypoint } from './common.js';

export function checkSecretLeakage(): import('./common.js').VerificationResult {
  const result = createResult();
  
  try {
    const whichCmd = process.platform === 'win32' ? 'where.exe' : 'which';
    execFileSync(whichCmd, ['gitleaks']);
  } catch {
    fail(result, 'gitleaks binary not found. Please install gitleaks.');
    return result;
  }

  try {
    execFileSync('gitleaks', ['detect', '--redact', '--no-banner', '-v'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    result.checked++;
  } catch (error: any) {
    fail(result, 'Secret leakage detected in git history (detect mode).');
    if (error.stdout) fail(result, error.stdout);
    if (error.stderr) fail(result, error.stderr);
  }

  try {
    execFileSync('gitleaks', ['protect', '--staged', '--redact', '--no-banner', '-v'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    result.checked++;
  } catch (error: any) {
    fail(result, 'Secret leakage detected in staged files (protect mode).');
    if (error.stdout) fail(result, error.stdout);
    if (error.stderr) fail(result, error.stderr);
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  const result = checkSecretLeakage();
  printAndExit('Secret Leakage Gate', result);
}
