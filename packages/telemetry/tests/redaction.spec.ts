import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isSensitiveKey,
  maskEgyptianNationalId,
  redact,
  scrubString,
} from '../src/redaction.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Redaction Engine', () => {
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

  describe('isSensitiveKey', () => {
    it('detects camelCase and snake_case sensitive keys', () => {
      // Arrange
      const keys = [
        'botToken',
        'BOT_TOKEN',
        'databaseUrl',
        'DATABASE_URL',
        'databaseEncryptionKey',
        'userPassword',
        'password',
        'geminiApiKey',
        'alsaada_session',
        'sessionSecret',
        'authorization',
        'bearerToken',
        'clientSecret',
        'initData',
        'init_data',
        'nationalIdEncrypted',
        'phoneEncrypted',
      ];

      // Act
      const outcomes = keys.map((k) => isSensitiveKey(k));

      // Assert
      expect(outcomes).toEqual(new Array(keys.length).fill(true));
    });

    it('does not produce false positives for safe domain keys', () => {
      // Arrange
      const safeKeys = [
        'keyboard',
        'author',
        'authorizedRoles',
        'dashboardUrl',
        'workerCode',
        'message',
        'siteId',
        'username',
        123,
        null,
      ];

      // Act
      const outcomes = safeKeys.map((k) => isSensitiveKey(k));

      // Assert
      expect(outcomes).toEqual(new Array(safeKeys.length).fill(false));
    });

    it('detects user_pass, userPass, db_pass, admin_pass, pass, and passphrase', () => {
      // Arrange
      const keys = ['user_pass', 'userPass', 'db_pass', 'admin_pass', 'passphrase', 'pass'];

      // Act
      const outcomes = keys.map((k) => isSensitiveKey(k));

      // Assert
      expect(outcomes).toEqual(new Array(keys.length).fill(true));
    });

    it('does not produce false positives for safe domain keys containing pass', () => {
      // Arrange
      const keys = ['compass', 'passport', 'passenger', 'bypass'];

      // Act
      const outcomes = keys.map((k) => isSensitiveKey(k));

      // Assert
      expect(outcomes).toEqual(new Array(keys.length).fill(false));
    });
  });

  describe('maskEgyptianNationalId', () => {
    it('masks valid 14-digit Egyptian NID keeping century/year and tail 4 digits (NEW-12 14-char exact)', () => {
      // Arrange
      const nid = '29805151201234';

      // Act
      const masked = maskEgyptianNationalId(nid);

      // Assert
      expect(masked).toBe('298*******1234');
      expect(masked.length).toBe(14);
    });

    it('masks valid 14-digit Egyptian NID with 8 asterisks when useExact14Length is false', () => {
      // Arrange
      const nid = '29805151201234';

      // Act
      const masked = maskEgyptianNationalId(nid, false);

      // Assert
      expect(masked).toBe('298********1234');
      expect(masked.length).toBe(15);
    });

    it('handles formatted NIDs with spaces and dashes', () => {
      // Arrange
      const formatted = '2-980515-1201234';

      // Act
      const masked = maskEgyptianNationalId(formatted);

      // Assert
      expect(masked).toBe('298*******1234');
    });

    it('falls back to tail masking for invalid length numbers', () => {
      // Arrange
      const short1 = '1234567';
      const short2 = '12';

      // Act
      const res1 = maskEgyptianNationalId(short1);
      const res2 = maskEgyptianNationalId(short2);

      // Assert
      expect(res1).toBe('**********4567');
      expect(res2).toBe('**********');
    });
  });

  describe('scrubString', () => {
    it('scrubs private keys', () => {
      // Arrange
      const text = 'Config: -----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3\n-----END PRIVATE KEY----- and more';

      // Act
      const scrubbed = scrubString(text);

      // Assert
      expect(scrubbed).toContain('[REDACTED_PRIVATE_KEY]');
      expect(scrubbed).not.toContain('MIIEvg');
    });

    it('scrubs database connection URLs', () => {
      // Arrange
      const text = 'Connected to postgresql://postgres:SuperSecretP@ss123@localhost:5432/alsaada_db';
      const redisNoUser = 'Connecting redis://:secretRedisPass@redis.internal:6379';

      // Act
      const scrubbedPg = scrubString(text);
      const scrubbedRedis = scrubString(redisNoUser);

      // Assert
      expect(scrubbedPg).toBe('Connected to postgresql://postgres:[REDACTED_PASSWORD]@localhost:5432/alsaada_db');
      expect(scrubbedRedis).toBe('Connecting redis://:[REDACTED_PASSWORD]@redis.internal:6379');
    });

    it('scrubs Telegram bot tokens', () => {
      // Arrange
      const text = 'Failed calling https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789/sendMessage';

      // Act
      const scrubbed = scrubString(text);

      // Assert
      expect(scrubbed).toBe('Failed calling https://api.telegram.org/bot[REDACTED_BOT_TOKEN]/sendMessage');
    });

    it('scrubs JWT and magic session tokens', () => {
      // Arrange
      const jwt = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const magic = 'Link: https://example.com/login?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghijklmnopqrstuvwxyz1234567890ABCDEF';

      // Act
      const scrubbedJwt = scrubString(jwt);
      const scrubbedMagic = scrubString(magic);

      // Assert
      expect(scrubbedJwt).toBe('Bearer [REDACTED_JWT]');
      expect(scrubbedMagic).toBe('Link: https://example.com/login?token=[REDACTED_SESSION_TOKEN]');
    });

    it('scrubs Gemini API keys', () => {
      // Arrange
      const text = 'Key AIzaSyABCdefGHIjklMNOpqrsTUVwxyz1234567 used';

      // Act
      const scrubbed = scrubString(text);

      // Assert
      expect(scrubbed).toBe('Key [REDACTED_API_KEY] used');
    });

    it('scrubs embedded Egyptian National IDs and phone numbers in text', () => {
      // Arrange
      const text = 'Worker NID 29805151201234 with phone 01012345678 registered';

      // Act
      const scrubbed = scrubString(text);

      // Assert
      expect(scrubbed).toBe('Worker NID 298*******1234 with phone 010****5678 registered');
    });

    it('scrubs formatted Egyptian National IDs with hyphens and spaces in free-form text', () => {
      // Arrange
      const t1 = 'NID: 2-980515-1201234';
      const t2 = 'NID: 2 980515 1201234';
      const t3 = 'NID: 298-0515120-1234';
      const t4 = 'NID: 298 0515120 1234';
      const t5 = 'NID: 2980515-1201234';

      // Act
      const res1 = scrubString(t1);
      const res2 = scrubString(t2);
      const res3 = scrubString(t3);
      const res4 = scrubString(t4);
      const res5 = scrubString(t5);

      // Assert
      expect(res1).toBe('NID: 298*******1234');
      expect(res2).toBe('NID: 298*******1234');
      expect(res3).toBe('NID: 298*******1234');
      expect(res4).toBe('NID: 298*******1234');
      expect(res5).toBe('NID: 298*******1234');
    });

    it('scrubs formatted Egyptian National IDs with 8 asterisks when useExactNidLength is false', () => {
      // Arrange
      const t1 = 'NID: 2-980515-1201234';
      const t2 = 'NID: 2 980515 1201234';

      // Act
      const res1 = scrubString(t1, false);
      const res2 = scrubString(t2, false);

      // Assert
      expect(res1).toBe('NID: 298********1234');
      expect(res2).toBe('NID: 298********1234');
    });

    it('returns empty string or non-string as-is', () => {
      // Arrange
      const empty = '';
      const nonString = null as unknown as string;

      // Act
      const resEmpty = scrubString(empty);
      const resNull = scrubString(nonString);

      // Assert
      expect(resEmpty).toBe('');
      expect(resNull).toBe(null);
    });
  });

  describe('redact (deep object sanitizer)', () => {
    it('redacts sensitive keys in plain objects', () => {
      // Arrange
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

      // Act
      const result = redact(input) as typeof input;

      // Assert
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
      // Arrange
      const input = {
        hyphenNid: 'Worker NID 2-980515-1201234 registered',
        spaceNid: 'Worker NID 2 980515 1201234 registered',
      };

      // Act
      const result = redact(input) as typeof input;

      // Assert
      expect(result.hyphenNid).toBe('Worker NID 298*******1234 registered');
      expect(result.spaceNid).toBe('Worker NID 298*******1234 registered');
    });

    it('safely handles circular references via WeakSet without stack overflow', () => {
      // Arrange
      const parent: Record<string, unknown> = { name: 'parent' };
      const child: Record<string, unknown> = { name: 'child', parent };
      parent.child = child;

      // Act
      const result = redact(parent) as { name: string; child: { name: string; parent: unknown } };

      // Assert
      expect(result.name).toBe('parent');
      expect(result.child.name).toBe('child');
      expect(result.child.parent).toBe('[CIRCULAR_REFERENCE]');
    });

    it('serializes BigInt safely to string for JSON compatibility', () => {
      // Arrange
      const input = {
        telegramId: 7594239391n,
        amount: 500,
      };

      // Act
      const result = redact(input) as { telegramId: string; amount: number };

      // Assert
      expect(result.telegramId).toBe('7594239391');
      expect(typeof result.telegramId).toBe('string');
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('properly scrubs Error objects including name, message, stack, code, and cause', () => {
      // Arrange
      const cause = new Error('Database password123 failed');
      const err = new Error('Telegram bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789 request failed');
      (err as unknown as { code: string }).code = 'ECONNREFUSED';
      err.cause = cause;
      (err as unknown as { botToken: string }).botToken = 'secretToken';
      (err as unknown as { safeDetail: string }).safeDetail = 'operational error';

      // Act
      const result = redact(err) as Record<string, unknown>;

      // Assert
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
      // Arrange
      const arr = Array.from({ length: 110 }, (_, i) => i);

      // Act
      const result = redact(arr, { maxArrayLength: 50 }) as unknown[];

      // Assert
      expect(result.length).toBe(51);
      expect(result[50]).toBe('[... 60 more items]');
    });

    it('handles strings and truncates when exceeding maxStringLength', () => {
      // Arrange
      const longStr = 'a'.repeat(200);

      // Act
      const result = redact(longStr, { maxStringLength: 50 }) as string;

      // Assert
      expect(result).toBe('a'.repeat(50) + '... [TRUNCATED]');
    });

    it('enforces maxDepth recursion limit', () => {
      // Arrange
      let current: Record<string, unknown> = { level: 0 };
      const root = current;
      for (let i = 1; i <= 10; i++) {
        const next = { level: i };
        current.child = next;
        current = next;
      }

      // Act
      const result = redact(root, { maxDepth: 3 }) as Record<string, unknown>;
      const level1 = result.child as Record<string, unknown>;
      const level2 = level1.child as Record<string, unknown>;
      const level3 = level2.child as Record<string, unknown>;

      // Assert
      expect(level3.child).toBe('[MAX_DEPTH_REACHED]');
    });

    it('handles Map, Set, Date, RegExp, and primitives cleanly', () => {
      // Arrange
      const map = new Map<string, unknown>([
        ['apiKey', 'secret123'],
        ['normal', 'value'],
      ]);
      const set = new Set(['item1', 'item2']);
      const date = new Date('2026-09-12T10:00:00.000Z');
      const regex = /test/i;
      const obj = { map, set, date, regex, fn: () => {}, sym: Symbol('id') };

      // Act
      const result = redact(obj) as Record<string, unknown>;
      const mapResult = result.map as Record<string, unknown>;

      // Assert
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
