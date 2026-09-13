/**
 * Empirical Verification & Stress Test Suite: Milestone 1 Round 2
 * Evaluator: challenger_m1_r2_1 (EMPIRICAL CHALLENGER / critic / specialist)
 * Target: @alsaada/telemetry
 *
 * Scope:
 * 1. Sensitive key detection:
 *    - Keys containing 'pass' and 'passphrase' (user_pass, userPass, db_pass, admin_pass, passphrase, my_pass, pass, etc.)
 *    - Non-sensitive words containing 'pass' (compass, passport, passenger, bypass, etc.)
 * 2. Egyptian National ID formatted string scrubbing:
 *    - Segmented formats (2-980515-1201234, 2 980515 1201234, 298-0515120-1234, 2980515-1201234, 298 0515120 1234, etc.)
 *    - Free-form messages, Error message, Error stack trace, structured object properties
 *    - Boundary and edge cases
 */

import { describe, expect, it } from 'vitest';
import {
  isSensitiveKey,
  maskEgyptianNationalId,
  redact,
  scrubString,
} from '../src/redaction.js';

describe('Challenger M1-R2 Empirical Verification', () => {
  // ==========================================================================
  // 1. Sensitive Key Detection ('pass' and 'passphrase')
  // ==========================================================================
  describe('Requirement 1: Sensitive Key Detection & False Positive Shield', () => {
    const SENSITIVE_PASS_KEYS = [
      'user_pass',
      'userPass',
      'UserPass',
      'USER_PASS',
      'db_pass',
      'dbPass',
      'DbPass',
      'DB_PASS',
      'admin_pass',
      'adminPass',
      'AdminPass',
      'ADMIN_PASS',
      'my_pass',
      'myPass',
      'MyPass',
      'MY_PASS',
      'passphrase',
      'Passphrase',
      'PASSPHRASE',
      'master_passphrase',
      'masterPassphrase',
      'pass',
      'Pass',
      'PASS',
      'app_pass',
      'appPass',
      'api_pass',
      'apiPass',
      'client_pass',
      'clientPass',
    ];

    it.each(SENSITIVE_PASS_KEYS)(
      'isSensitiveKey returns true for sensitive key: %s',
      (key) => {
        expect(isSensitiveKey(key)).toBe(true);
      }
    );

    it('redacts sensitive pass/passphrase keys in objects to [REDACTED]', () => {
      const payload = {
        user_pass: 'Secret123!',
        userPass: 'Secret456!',
        db_pass: 'DbSecret789',
        admin_pass: 'AdminRootPass',
        passphrase: 'correct horse battery staple',
        my_pass: 'PersonalSecretPass',
        pass: 'RawPassField',
        masterPassphrase: 'MasterSecretKey999',
        nested: {
          app_pass: 'AppLevelPassword',
          deep: {
            apiPass: 'ApiSecretToken987',
          },
        },
      };

      const result = redact(payload) as typeof payload;

      expect(result.user_pass).toBe('[REDACTED]');
      expect(result.userPass).toBe('[REDACTED]');
      expect(result.db_pass).toBe('[REDACTED]');
      expect(result.admin_pass).toBe('[REDACTED]');
      expect(result.passphrase).toBe('[REDACTED]');
      expect(result.my_pass).toBe('[REDACTED]');
      expect(result.pass).toBe('[REDACTED]');
      expect(result.masterPassphrase).toBe('[REDACTED]');
      expect(result.nested.app_pass).toBe('[REDACTED]');
      expect(result.nested.deep.apiPass).toBe('[REDACTED]');
    });

    const SAFE_PASS_WORDS = [
      'compass',
      'Compass',
      'COMPASS',
      'compassHeading',
      'compass_heading',
      'passport',
      'Passport',
      'PASSPORT',
      'passportNumber',
      'passport_number',
      'passenger',
      'Passenger',
      'PASSENGER',
      'passengerName',
      'passenger_count',
      'bypass',
      'Bypass',
      'BYPASS',
      'bypassCache',
      'bypass_cache',
      'bypassValidation',
      'bypass_validation',
      'underpass',
      'surpass',
      'trespass',
      'trespassWarning',
    ];

    it.each(SAFE_PASS_WORDS)(
      'isSensitiveKey returns false for non-sensitive word containing pass: %s',
      (key) => {
        expect(isSensitiveKey(key)).toBe(false);
      }
    );

    it('preserves non-sensitive pass-containing keys and values without redaction', () => {
      const payload = {
        compass: { heading: 180 },
        compassHeading: 270,
        passport: 'A12345678',
        passportNumber: 'E98765432',
        passenger: 'Ali Mahmoud',
        passengerName: 'Kareem Ahmed',
        passenger_count: 4,
        bypass: false,
        bypassCache: true,
        underpass: 'Tunnel A',
        trespassWarning: 'Restricted construction zone',
      };

      const result = redact(payload) as typeof payload;

      expect(result.compass).toEqual({ heading: 180 });
      expect(result.compassHeading).toBe(270);
      expect(result.passport).toBe('A12345678');
      expect(result.passportNumber).toBe('E98765432');
      expect(result.passenger).toBe('Ali Mahmoud');
      expect(result.passengerName).toBe('Kareem Ahmed');
      expect(result.passenger_count).toBe(4);
      expect(result.bypass).toBe(false);
      expect(result.bypassCache).toBe(true);
      expect(result.underpass).toBe('Tunnel A');
      expect(result.trespassWarning).toBe('Restricted construction zone');
    });
  });

  // ==========================================================================
  // 2. Egyptian National ID Formatted String Scrubbing
  // ==========================================================================
  describe('Requirement 2: Egyptian National ID Formatted String Scrubbing', () => {
    const SEGMENTED_FORMAT_CASES = [
      {
        format: '1-6-7 with hyphens (Century - DOB - Seq/Check)',
        raw: '2-980515-1201234',
        expected: '298*******1234',
      },
      {
        format: '1-6-7 with spaces (Century DOB Seq/Check)',
        raw: '2 980515 1201234',
        expected: '298*******1234',
      },
      {
        format: '3-7-4 with hyphens (Century/Year - Middle - Tail)',
        raw: '298-0515120-1234',
        expected: '298*******1234',
      },
      {
        format: '3-7-4 with spaces (Century/Year Middle Tail)',
        raw: '298 0515120 1234',
        expected: '298*******1234',
      },
      {
        format: '7-7 with hyphens (Century/DOB - Seq/Check)',
        raw: '2980515-1201234',
        expected: '298*******1234',
      },
      {
        format: 'Contiguous 14 digits',
        raw: '29805151201234',
        expected: '298*******1234',
      },
      {
        format: '21st Century (starts with 3) 1-6-7 with hyphens',
        raw: '3-010101-1201234',
        expected: '301*******1234',
      },
      {
        format: '21st Century (starts with 3) 3-7-4 with hyphens',
        raw: '301-0101120-1234',
        expected: '301*******1234',
      },
      {
        format: '21st Century (starts with 3) 7-7 with hyphens',
        raw: '3010101-1201234',
        expected: '301*******1234',
      },
      {
        format: '21st Century (starts with 3) contiguous',
        raw: '30101011201234',
        expected: '301*******1234',
      },
    ];

    it.each(SEGMENTED_FORMAT_CASES)(
      'scrubs isolated string: $format ($raw -> $expected)',
      ({ raw, expected }) => {
        expect(scrubString(raw)).toBe(expected);
      }
    );

    it('scrubs formatted National IDs embedded in free-form messages', () => {
      const msg1 = 'تم تسجيل العامل بالرقم القومي 2-980515-1201234 في موقع العاصمة';
      expect(scrubString(msg1)).toBe(
        'تم تسجيل العامل بالرقم القومي 298*******1234 في موقع العاصمة'
      );

      const msg2 = 'Worker national id 2 980515 1201234 passed safety inspection.';
      expect(scrubString(msg2)).toBe(
        'Worker national id 298*******1234 passed safety inspection.'
      );

      const msg3 = 'Clearance slip for NID 298-0515120-1234 issued by accountant.';
      expect(scrubString(msg3)).toBe(
        'Clearance slip for NID 298*******1234 issued by accountant.'
      );

      const msg4 = 'Failed verification for NID 2980515-1201234 during onboarding.';
      expect(scrubString(msg4)).toBe(
        'Failed verification for NID 298*******1234 during onboarding.'
      );
    });

    it('scrubs formatted National IDs inside Error message and stack traces', () => {
      const err = new Error(
        'Database conflict: Duplicate record for worker NID 2-980515-1201234'
      );
      // Simulate stack trace containing the segmented NID
      err.stack = `Error: Database conflict: Duplicate record for worker NID 2-980515-1201234\n    at registerWorker (f:\\Alsaada-Smart-Bot\\modules\\workforce\\service.ts:42:15)\n    at processNid_2_980515_1201234 (f:\\Alsaada-Smart-Bot\\modules\\workforce\\handler.ts:110:20)`;

      const redactedErr = redact(err) as Record<string, unknown>;

      expect(redactedErr.message).toBe(
        'Database conflict: Duplicate record for worker NID 298*******1234'
      );
      expect(redactedErr.message).not.toContain('2-980515-1201234');

      const stack = redactedErr.stack as string;
      expect(stack).toContain('Duplicate record for worker NID 298*******1234');
      expect(stack).not.toContain('2-980515-1201234');
    });

    it('scrubs formatted National IDs inside complex nested objects and arrays', () => {
      const auditPayload = {
        transactionId: 'TX-10029',
        event: 'WORKER_CLEARANCE_FINALIZED',
        workers: [
          {
            code: 'WRK-001',
            nationalIdNote: 'Card copy: 2-980515-1201234 verified',
          },
          {
            code: 'WRK-002',
            nationalIdNote: 'Card copy: 2 980515 1201234 verified',
          },
          {
            code: 'WRK-003',
            nationalIdNote: 'Card copy: 298-0515120-1234 verified',
          },
          {
            code: 'WRK-004',
            nationalIdNote: 'Card copy: 2980515-1201234 verified',
          },
        ],
        supervisorNotes: 'Batch approved with NID 3-010101-1201234 supervisor sign-off.',
      };

      const result = redact(auditPayload) as typeof auditPayload;

      expect(result.workers[0]?.nationalIdNote).toBe(
        'Card copy: 298*******1234 verified'
      );
      expect(result.workers[1]?.nationalIdNote).toBe(
        'Card copy: 298*******1234 verified'
      );
      expect(result.workers[2]?.nationalIdNote).toBe(
        'Card copy: 298*******1234 verified'
      );
      expect(result.workers[3]?.nationalIdNote).toBe(
        'Card copy: 298*******1234 verified'
      );
      expect(result.supervisorNotes).toBe(
        'Batch approved with NID 301*******1234 supervisor sign-off.'
      );
    });

    it('respects useExactNidLength: false producing 8 asterisks (298********1234)', () => {
      expect(scrubString('NID: 2-980515-1201234', false)).toBe(
        'NID: 298********1234'
      );
      expect(scrubString('NID: 2 980515 1201234', false)).toBe(
        'NID: 298********1234'
      );
      expect(scrubString('NID: 298-0515120-1234', false)).toBe(
        'NID: 298********1234'
      );
      expect(scrubString('NID: 2980515-1201234', false)).toBe(
        'NID: 298********1234'
      );
    });

    it('direct function maskEgyptianNationalId handles delimiters and invalid lengths properly', () => {
      expect(maskEgyptianNationalId('2-980515-1201234')).toBe('298*******1234');
      expect(maskEgyptianNationalId('2 980515 1201234')).toBe('298*******1234');
      expect(maskEgyptianNationalId('298-0515120-1234')).toBe('298*******1234');
      expect(maskEgyptianNationalId('2980515-1201234')).toBe('298*******1234');
      expect(maskEgyptianNationalId('2-980515-1201234', false)).toBe(
        '298********1234'
      );

      // Incomplete / invalid length fallbacks
      expect(maskEgyptianNationalId('1234567')).toBe('**********4567');
      expect(maskEgyptianNationalId('9999')).toBe('**********9999');
      expect(maskEgyptianNationalId('123')).toBe('**********');
    });
  });
});
