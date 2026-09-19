import { execFileSync } from 'node:child_process';
import { createResult, fail, warn, printAndExit, isCliEntrypoint } from './common.js';

export function parseSemgrepOutput(jsonStr: string, result: import('./common.js').VerificationResult) {
  try {
    const data = JSON.parse(jsonStr);
    
    if (data.errors && data.errors.length > 0) {
      for (const err of data.errors) {
        if (err.message && err.message.includes('Syntax error')) {
          warn(result, `Semgrep Parse Warning: ${err.message}`);
        } else {
          fail(result, `Semgrep Error: ${err.message || JSON.stringify(err)}`);
        }
      }
    }

    if (data.results && data.results.length > 0) {
      for (const finding of data.results) {
        const msg = `${finding.path}:${finding.start.line} - ${finding.extra.message}`;
        if (finding.extra.severity === 'ERROR') {
          fail(result, msg);
        } else if (finding.extra.severity === 'WARNING') {
          warn(result, msg);
        } else {
          warn(result, `[${finding.extra.severity}] ${msg}`);
        }
      }
    }

    if (data.paths && Array.isArray(data.paths.scanned)) {
      result.checked = data.paths.scanned.length;
    } else {
      result.checked = 1;
    }
  } catch (e) {
    fail(result, 'Failed to parse semgrep JSON output');
  }
}

export function checkCodeSecurity(): import('./common.js').VerificationResult {
  const result = createResult();
  
  try {
    const whichCmd = process.platform === 'win32' ? 'where.exe' : 'which';
    execFileSync(whichCmd, ['semgrep']);
  } catch {
    fail(result, 'semgrep binary not found. Please install semgrep.');
    return result;
  }

  try {
    const output = execFileSync('semgrep', [
      'scan',
      '--config', 'p/typescript',
      '--config', 'p/owasp-top-ten',
      '--config', 'p/nodejs',
      '--json',
      '--quiet'
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    
    parseSemgrepOutput(output, result);
  } catch (error: any) {
    if (error.stdout) {
      parseSemgrepOutput(error.stdout, result);
    } else {
      fail(result, 'Semgrep execution failed: ' + error.message);
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  const result = checkCodeSecurity();
  printAndExit('Code Security Gate', result);
}
