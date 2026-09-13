/**
 * Al-Saada Enterprise Telemetry - Constants & Regex Patterns
 * Compliance: Plan 19 Section 4 & Rule NEW-12
 */

export const SENSITIVE_KEY_ROOTS = [
  'token',
  'secret',
  'password',
  'passwd',
  'pwd',
  'pass',
  'passphrase',
  'key',
  'auth',
  'authorization',
  'bearer',
  'credential',
  'credentials',
  'cookie',
  'cookies',
  'session',
  'signature',
  'hash',
  'init_data',
  'initdata',
  'salt',
  'encrypted',
  'sensitive',
  'database_url',
  'databaseurl',
  'redis_url',
  'redisurl',
  'phone_encrypted',
  'national_id_encrypted',
] as const;

/**
 * Regex matching normalized snake_case keys that contain sensitive roots.
 * Using non-capturing boundaries to prevent false positives like 'keyboard' or 'author'.
 */
export const SENSITIVE_KEY_PATTERN =
  /(?:^|[._-])(?:token|secret|password|passwd|pwd|pass|passphrase|key|auth|authorization|bearer|credential|credentials|cookie|cookies|session|signature|hash|init_?data|salt|encrypted|sensitive|database_?url|redis_?url)(?:[._-]|$)/i;

/**
 * Telegram Bot Token regex: matches 8-12 digits followed by colon and 35 base64url characters.
 * Matches word boundaries or immediately following 'bot' in URLs/identifiers.
 */
export const TELEGRAM_BOT_TOKEN_REGEX = /(?:\b|(?<=bot))\d{8,12}:[A-Za-z0-9_-]{35}\b/g;

/**
 * Database URL credentials regex (Postgres, MySQL, MongoDB, Redis with user:pass).
 * Correctly handles special characters like '@' inside the password.
 */
export const DB_URL_CREDENTIALS_REGEX =
  /((?:postgres(?:ql)?|redis[s]?|mysql|mongodb(?:\+srv)?):\/\/[^/@:\s]+:)([^/\s]+)(@(?=[a-zA-Z0-9_.-]+(?::\d+)?(?:\/|\?|#|$|\s)))/gi;

/**
 * Redis URL credentials regex without user (redis://:password@host).
 */
export const REDIS_NO_USER_URL_REGEX =
  /(redis[s]?:\/\/):([^/\s]+)(@(?=[a-zA-Z0-9_.-]+(?::\d+)?(?:\/|\?|#|$|\s)))/gi;

/**
 * Standard JWT Token (3 base64url segments separated by dots, starting with eyJ).
 */
export const JWT_TOKEN_REGEX = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

/**
 * Single-use Magic Link / Session Token regex.
 */
export const MAGIC_SESSION_TOKEN_REGEX = /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{30,}\b/g;

/**
 * PEM Private Key regex.
 */
export const PRIVATE_KEY_REGEX =
  /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/g;

/**
 * Google / Gemini API key regex (AIzaSy followed by 33 characters).
 */
export const GEMINI_API_KEY_REGEX = /\bAIzaSy[A-Za-z0-9_-]{33}\b/g;

/**
 * Egyptian National ID regex: 14 digits starting with century digit 2 or 3,
 * followed by 2-digit birth year, 7 middle digits, and 4 sequence/check digits.
 * Allows optional hyphens or spaces between major segments (e.g. 298-0515120-1234 or 29805151201234).
 */
export const EGYPTIAN_NID_GENERAL_REGEX = /\b([23]\d{2})[-\s]?(\d{7})[-\s]?(\d{4})\b/g;

/**
 * Egyptian National ID regex for segmented formatted variants:
 * Century (1 digit), DOB (6 digits), Sequence/Checksum (7 digits): e.g. 2-980515-1201234 or 2 980515 1201234.
 */
export const EGYPTIAN_NID_SEGMENTED_REGEX = /\b[23][-\s]?\d{6}[-\s]\d{7}\b/g;

/**
 * Egyptian Mobile Phone regex: 11 digits starting with 010, 011, 012, or 015.
 */
export const EGYPTIAN_PHONE_REGEX = /\b(01[0125])\d{4}(\d{4})\b/g;

/**
 * Trace ID format validation (alphanumeric, dashes, underscores between 8 and 64 characters).
 */
export const TRACE_ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * W3C Traceparent Header regex (version 00, 32-hex traceId, 16-hex spanId, 2-hex flags).
 */
export const W3C_TRACEPARENT_REGEX = /^00-([0-9a-fA-F]{32})-([0-9a-fA-F]{16})-([0-9a-fA-F]{2})$/;

/**
 * Default limits for recursive sanitization DoS prevention.
 */
export const DEFAULT_MAX_DEPTH = 8;
export const DEFAULT_MAX_ARRAY_LENGTH = 100;
export const DEFAULT_MAX_STRING_LENGTH = 10000;
