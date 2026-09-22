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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isSensitiveKey,
  maskEgyptianNationalId,
  redact,
  scrubString,
} from '../src/redaction.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Challenger M1-R2 Empirical Verification', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

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
        // Arrange
        const target = key;

        // Act
        const result = isSensitiveKey(target);

        // Assert
        expect(result).toBe(true);
      }
    );

    it('redacts sensitive pass/passphrase keys in objects to [REDACTED]', () => {
      // Arrange
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

      // Act
      const result = redact(payload) as typeof payload;

      // Assert
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
        // Arrange
        const target = key;

        // Act
        const result = isSensitiveKey(target);

        // Assert
        expect(result).toBe(false);
      }
    );

    it('preserves non-sensitive pass-containing keys and values without redaction', () => {
      // Arrange
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

      // Act
      const result = redact(payload) as typeof payload;

      // Assert
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
        // Arrange
        const input = raw;

        // Act
        const result = scrubString(input);

        // Assert
        expect(result).toBe(expected);
      }
    );

    it('scrubs formatted National IDs embedded in free-form messages', () => {
      // Arrange
      const msg1 = 'تم تسجيل العامل بالرقم القومي 2-980515-1201234 في موقع العاصمة';
      const msg2 = 'Worker national id 2 980515 1201234 passed safety inspection.';
      const msg3 = 'Clearance slip for NID 298-0515120-1234 issued by accountant.';
      const msg4 = 'Failed verification for NID 2980515-1201234 during onboarding.';

      // Act
      const res1 = scrubString(msg1);
      const res2 = scrubString(msg2);
      const res3 = scrubString(msg3);
      const res4 = scrubString(msg4);

      // Assert
      expect(res1).toBe('تم تسجيل العامل بالرقم القومي 298*******1234 في موقع العاصمة');
      expect(res2).toBe('Worker national id 298*******1234 passed safety inspection.');
      expect(res3).toBe('Clearance slip for NID 298*******1234 issued by accountant.');
      expect(res4).toBe('Failed verification for NID 298*******1234 during onboarding.');
    });

    it('scrubs formatted National IDs inside Error message and stack traces', () => {
      // Arrange
      const err = new Error(
        'Database conflict: Duplicate record for worker NID 2-980515-1201234'
      );
      err.stack = `Error: Database conflict: Duplicate record for worker NID 2-980515-1201234\n    at registerWorker (f:\\Alsaada-Smart-Bot\\modules\\workforce\\service.ts:42:15)\n    at processNid_2_980515_1201234 (f:\\Alsaada-Smart-Bot\\modules\\workforce\\handler.ts:110:20)`;

      // Act
      const redactedErr = redact(err) as Record<string, unknown>;

      // Assert
      expect(redactedErr.message).toBe(
        'Database conflict: Duplicate record for worker NID 298*******1234'
      );
      expect(redactedErr.message).not.toContain('2-980515-1201234');

      const stack = redactedErr.stack as string;
      expect(stack).toContain('Duplicate record for worker NID 298*******1234');
      expect(stack).not.toContain('2-980515-1201234');
    });

    it('scrubs formatted National IDs inside complex nested objects and arrays', () => {
      // Arrange
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

      // Act
      const result = redact(auditPayload) as typeof auditPayload;

      // Assert
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
      // Arrange
      const t1 = 'NID: 2-980515-1201234';
      const t2 = 'NID: 2 980515 1201234';
      const t3 = 'NID: 298-0515120-1234';
      const t4 = 'NID: 2980515-1201234';

      // Act
      const res1 = scrubString(t1, false);
      const res2 = scrubString(t2, false);
      const res3 = scrubString(t3, false);
      const res4 = scrubString(t4, false);

      // Assert
      expect(res1).toBe('NID: 298********1234');
      expect(res2).toBe('NID: 298********1234');
      expect(res3).toBe('NID: 298********1234');
      expect(res4).toBe('NID: 298********1234');
    });

    it('direct function maskEgyptianNationalId handles delimiters and invalid lengths properly', () => {
      // Arrange
      const delimited1 = '2-980515-1201234';
      const delimited2 = '2 980515 1201234';
      const delimited3 = '298-0515120-1234';
      const delimited4 = '2980515-1201234';
      const delimited5 = '2-980515-1201234';
      const short1 = '1234567';
      const short2 = '9999';
      const short3 = '123';

      // Act
      const res1 = maskEgyptianNationalId(delimited1);
      const res2 = maskEgyptianNationalId(delimited2);
      const res3 = maskEgyptianNationalId(delimited3);
      const res4 = maskEgyptianNationalId(delimited4);
      const res5 = maskEgyptianNationalId(delimited5, false);
      const resShort1 = maskEgyptianNationalId(short1);
      const resShort2 = maskEgyptianNationalId(short2);
      const resShort3 = maskEgyptianNationalId(short3);

      // Assert
      expect(res1).toBe('298*******1234');
      expect(res2).toBe('298*******1234');
      expect(res3).toBe('298*******1234');
      expect(res4).toBe('298*******1234');
      expect(res5).toBe('298********1234');
      expect(resShort1).toBe('**********4567');
      expect(resShort2).toBe('**********9999');
      expect(resShort3).toBe('**********');
    });
  });
});
