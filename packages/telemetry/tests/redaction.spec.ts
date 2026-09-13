import { describe, expect, it } from 'vitest';
import {
  isSensitiveKey,
  maskEgyptianNationalId,
  redact,
  scrubString,
} from '../src/redaction.js';

describe('Redaction Engine', () => {
  describe('isSensitiveKey', () => {
    it('detects camelCase and snake_case sensitive keys', () => {
      expect(isSensitiveKey('botToken')).toBe(true);
      expect(isSensitiveKey('BOT_TOKEN')).toBe(true);
      expect(isSensitiveKey('databaseUrl')).toBe(true);
      expect(isSensitiveKey('DATABASE_URL')).toBe(true);
      expect(isSensitiveKey('databaseEncryptionKey')).toBe(true);
      expect(isSensitiveKey('userPassword')).toBe(true);
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('geminiApiKey')).toBe(true);
      expect(isSensitiveKey('alsaada_session')).toBe(true);
      expect(isSensitiveKey('sessionSecret')).toBe(true);
      expect(isSensitiveKey('authorization')).toBe(true);
      expect(isSensitiveKey('bearerToken')).toBe(true);
      expect(isSensitiveKey('clientSecret')).toBe(true);
      expect(isSensitiveKey('initData')).toBe(true);
      expect(isSensitiveKey('init_data')).toBe(true);
      expect(isSensitiveKey('nationalIdEncrypted')).toBe(true);
      expect(isSensitiveKey('phoneEncrypted')).toBe(true);
    });

    it('does not produce false positives for safe domain keys', () => {
      expect(isSensitiveKey('keyboard')).toBe(false);
      expect(isSensitiveKey('author')).toBe(false);
      expect(isSensitiveKey('authorizedRoles')).toBe(false);
      expect(isSensitiveKey('dashboardUrl')).toBe(false);
      expect(isSensitiveKey('workerCode')).toBe(false);
      expect(isSensitiveKey('message')).toBe(false);
      expect(isSensitiveKey('siteId')).toBe(false);
      expect(isSensitiveKey('username')).toBe(false);
      expect(isSensitiveKey(123)).toBe(false);
      expect(isSensitiveKey(null)).toBe(false);
    });

    it('detects user_pass, userPass, db_pass, admin_pass, pass, and passphrase', () => {
      expect(isSensitiveKey('user_pass')).toBe(true);
      expect(isSensitiveKey('userPass')).toBe(true);
      expect(isSensitiveKey('db_pass')).toBe(true);
      expect(isSensitiveKey('admin_pass')).toBe(true);
      expect(isSensitiveKey('passphrase')).toBe(true);
      expect(isSensitiveKey('pass')).toBe(true);
    });

    it('does not produce false positives for safe domain keys containing pass', () => {
      expect(isSensitiveKey('compass')).toBe(false);
      expect(isSensitiveKey('passport')).toBe(false);
      expect(isSensitiveKey('passenger')).toBe(false);
      expect(isSensitiveKey('bypass')).toBe(false);
    });
  });

  describe('maskEgyptianNationalId', () => {
    it('masks valid 14-digit Egyptian NID keeping century/year and tail 4 digits (NEW-12 14-char exact)', () => {
      // 29805151201234 -> 298*******1234 (7 asterisks, length 14)
      const masked = maskEgyptianNationalId('29805151201234');
      expect(masked).toBe('298*******1234');
      expect(masked.length).toBe(14);
    });

    it('masks valid 14-digit Egyptian NID with 8 asterisks when useExact14Length is false', () => {
      const masked = maskEgyptianNationalId('29805151201234', false);
      expect(masked).toBe('298********1234');
      expect(masked.length).toBe(15);
    });

    it('handles formatted NIDs with spaces and dashes', () => {
      const masked = maskEgyptianNationalId('2-980515-1201234');
      expect(masked).toBe('298*******1234');
    });

    it('falls back to tail masking for invalid length numbers', () => {
      expect(maskEgyptianNationalId('1234567')).toBe('**********4567');
      expect(maskEgyptianNationalId('12')).toBe('**********');
    });
  });

  describe('scrubString', () => {
    it('scrubs private keys', () => {
      const text = 'Config: -----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3\n-----END PRIVATE KEY----- and more';
      expect(scrubString(text)).toContain('[REDACTED_PRIVATE_KEY]');
      expect(scrubString(text)).not.toContain('MIIEvg');
    });

    it('scrubs database connection URLs', () => {
      const text = 'Connected to postgresql://postgres:SuperSecretP@ss123@localhost:5432/alsaada_db';
      expect(scrubString(text)).toBe('Connected to postgresql://postgres:[REDACTED_PASSWORD]@localhost:5432/alsaada_db');

      const redisNoUser = 'Connecting redis://:secretRedisPass@redis.internal:6379';
      expect(scrubString(redisNoUser)).toBe('Connecting redis://:[REDACTED_PASSWORD]@redis.internal:6379');
    });

    it('scrubs Telegram bot tokens', () => {
      const text = 'Failed calling https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789/sendMessage';
      expect(scrubString(text)).toBe('Failed calling https://api.telegram.org/bot[REDACTED_BOT_TOKEN]/sendMessage');
    });

    it('scrubs JWT and magic session tokens', () => {
      const jwt = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      expect(scrubString(jwt)).toBe('Bearer [REDACTED_JWT]');

      const magic = 'Link: https://example.com/login?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghijklmnopqrstuvwxyz1234567890ABCDEF';
      expect(scrubString(magic)).toBe('Link: https://example.com/login?token=[REDACTED_SESSION_TOKEN]');
    });

    it('scrubs Gemini API keys', () => {
      const text = 'Key AIzaSyABCdefGHIjklMNOpqrsTUVwxyz1234567 used';
      expect(scrubString(text)).toBe('Key [REDACTED_API_KEY] used');
    });

    it('scrubs embedded Egyptian National IDs and phone numbers in text', () => {
      const text = 'Worker NID 29805151201234 with phone 01012345678 registered';
      const scrubbed = scrubString(text);
      expect(scrubbed).toBe('Worker NID 298*******1234 with phone 010****5678 registered');
    });

    it('scrubs formatted Egyptian National IDs with hyphens and spaces in free-form text', () => {
      expect(scrubString('NID: 2-980515-1201234')).toBe('NID: 298*******1234');
      expect(scrubString('NID: 2 980515 1201234')).toBe('NID: 298*******1234');
      expect(scrubString('NID: 298-0515120-1234')).toBe('NID: 298*******1234');
      expect(scrubString('NID: 298 0515120 1234')).toBe('NID: 298*******1234');
      expect(scrubString('NID: 2980515-1201234')).toBe('NID: 298*******1234');
    });

    it('scrubs formatted Egyptian National IDs with 8 asterisks when useExactNidLength is false', () => {
      expect(scrubString('NID: 2-980515-1201234', false)).toBe('NID: 298********1234');
      expect(scrubString('NID: 2 980515 1201234', false)).toBe('NID: 298********1234');
    });

    it('returns empty string or non-string as-is', () => {
      expect(scrubString('')).toBe('');
      expect(scrubString(null as unknown as string)).toBe(null);
    });
  });

  describe('redact (deep object sanitizer)', () => {
    it('redacts sensitive keys in plain objects', () => {
      const input = {
        workerName: 'Ahmed',
        botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789',
        userPassword: 'plaintextPassword',
        user_pass: 'plaintextUserPass',
        userPass: 'plaintextUserPassCamel',
        db_pass: 'plaintextDbPass',
        passphrase: 'plaintextPassphrase',
        nested: {
          databaseUrl: 'postgresql://u:p@h:5432/d',
          keyboard: ['button1', 'button2'],
        },
      };

      const result = redact(input) as typeof input;
      expect(result.workerName).toBe('Ahmed');
      expect(result.botToken).toBe('[REDACTED]');
      expect(result.userPassword).toBe('[REDACTED]');
      expect(result.user_pass).toBe('[REDACTED]');
      expect(result.userPass).toBe('[REDACTED]');
      expect(result.db_pass).toBe('[REDACTED]');
      expect(result.passphrase).toBe('[REDACTED]');
      expect(result.nested.databaseUrl).toBe('[REDACTED]');
      expect(result.nested.keyboard).toEqual(['button1', 'button2']);
    });

    it('scrubs formatted Egyptian National IDs inside object properties', () => {
      const input = {
        hyphenNid: 'Worker NID 2-980515-1201234 registered',
        spaceNid: 'Worker NID 2 980515 1201234 registered',
      };
      const result = redact(input) as typeof input;
      expect(result.hyphenNid).toBe('Worker NID 298*******1234 registered');
      expect(result.spaceNid).toBe('Worker NID 298*******1234 registered');
    });

    it('safely handles circular references via WeakSet without stack overflow', () => {
      const parent: Record<string, unknown> = { name: 'parent' };
      const child: Record<string, unknown> = { name: 'child', parent };
      parent.child = child;

      const result = redact(parent) as { name: string; child: { name: string; parent: unknown } };
      expect(result.name).toBe('parent');
      expect(result.child.name).toBe('child');
      expect(result.child.parent).toBe('[CIRCULAR_REFERENCE]');
    });

    it('serializes BigInt safely to string for JSON compatibility', () => {
      const input = {
        telegramId: 7594239391n,
        amount: 500,
      };

      const result = redact(input) as { telegramId: string; amount: number };
      expect(result.telegramId).toBe('7594239391');
      expect(typeof result.telegramId).toBe('string');
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('properly scrubs Error objects including name, message, stack, code, and cause', () => {
      const cause = new Error('Database password123 failed');
      const err = new Error('Telegram bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789 request failed');
      (err as unknown as { code: string }).code = 'ECONNREFUSED';
      err.cause = cause;
      (err as unknown as { botToken: string }).botToken = 'secretToken';
      (err as unknown as { safeDetail: string }).safeDetail = 'operational error';

      const result = redact(err) as Record<string, unknown>;
      expect(result.name).toBe('Error');
      expect(result.message).toContain('[REDACTED_BOT_TOKEN]');
      expect(result.message).not.toContain('ABCdefGHIjklMNOpqrsTUVwxyz123456789');
      expect(result.code).toBe('ECONNREFUSED');
      expect(result.botToken).toBe('[REDACTED]');
      expect(result.safeDetail).toBe('operational error');

      const causeResult = result.cause as Record<string, unknown>;
      expect(causeResult.name).toBe('Error');
      expect(causeResult.message).toContain('Database');
    });

    it('handles arrays and truncates when exceeding maxArrayLength', () => {
      const arr = Array.from({ length: 110 }, (_, i) => i);
      const result = redact(arr, { maxArrayLength: 50 }) as unknown[];
      expect(result.length).toBe(51);
      expect(result[50]).toBe('[... 60 more items]');
    });

    it('handles strings and truncates when exceeding maxStringLength', () => {
      const longStr = 'a'.repeat(200);
      const result = redact(longStr, { maxStringLength: 50 }) as string;
      expect(result).toBe('a'.repeat(50) + '... [TRUNCATED]');
    });

    it('enforces maxDepth recursion limit', () => {
      let current: Record<string, unknown> = { level: 0 };
      const root = current;
      for (let i = 1; i <= 10; i++) {
        const next = { level: i };
        current.child = next;
        current = next;
      }

      const result = redact(root, { maxDepth: 3 }) as Record<string, unknown>;
      const level1 = result.child as Record<string, unknown>;
      const level2 = level1.child as Record<string, unknown>;
      const level3 = level2.child as Record<string, unknown>;
      expect(level3.child).toBe('[MAX_DEPTH_REACHED]');
    });

    it('handles Map, Set, Date, RegExp, and primitives cleanly', () => {
      const map = new Map<string, unknown>([
        ['apiKey', 'secret123'],
        ['normal', 'value'],
      ]);
      const set = new Set(['item1', 'item2']);
      const date = new Date('2026-09-12T10:00:00.000Z');
      const regex = /test/i;

      const obj = { map, set, date, regex, fn: () => {}, sym: Symbol('id') };
      const result = redact(obj) as Record<string, unknown>;

      const mapResult = result.map as Record<string, unknown>;
      expect(mapResult.apiKey).toBe('[REDACTED]');
      expect(mapResult.normal).toBe('value');

      expect(result.set).toEqual(['item1', 'item2']);
      expect(result.date).toBe('2026-09-12T10:00:00.000Z');
      expect(result.regex).toBe('/test/i');
      expect(result.fn).toContain('[Function:');
      expect(result.sym).toBe('Symbol(id)');
    });
  });
});
