/**
 * Al-Saada Enterprise Telemetry - Sensitive Data Redaction Engine
 * Compliance: Plan 19 Section 4 & Rule NEW-12
 */

import {
  DEFAULT_MAX_ARRAY_LENGTH,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_STRING_LENGTH,
  DB_URL_CREDENTIALS_REGEX,
  EGYPTIAN_NID_GENERAL_REGEX,
  EGYPTIAN_NID_SEGMENTED_REGEX,
  EGYPTIAN_PHONE_REGEX,
  GEMINI_API_KEY_REGEX,
  JWT_TOKEN_REGEX,
  MAGIC_SESSION_TOKEN_REGEX,
  PRIVATE_KEY_REGEX,
  REDIS_NO_USER_URL_REGEX,
  SENSITIVE_KEY_PATTERN,
  TELEGRAM_BOT_TOKEN_REGEX,
} from './constants.js';
import type { RedactionOptions } from './types.js';

const AUTHORIZATION_HEADER_REGEX =
  /\b(authorization\s*:\s*)(?:bearer\s+)?[^\s,;]+/gi;
const BEARER_VALUE_REGEX = /\bbearer\s+[a-z0-9._~+/=-]{4,}/gi;
const COOKIE_HEADER_REGEX = /\b((?:set-)?cookie\s*:\s*)[^\r\n]+/gi;
const SENSITIVE_VALUE_ASSIGNMENT_REGEX =
  /(\b(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|password|passwd|pwd|passphrase|secret|api[_-]?key|client[_-]?secret|session(?:[_-]?(?:id|token))?|cookie)\s*[:=]\s*)(?!\[REDACTED(?:_[A-Z_]+)?\])(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;&]+)/gi;

/**
 * Determine if a key name matches any known sensitive patterns.
 * Normalizes camelCase and PascalCase into snake_case before regex matching
 * to prevent sensitive key leaks in standard TypeScript models.
 */
export function isSensitiveKey(key: unknown): boolean {
  if (typeof key !== 'string') return false;
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  return SENSITIVE_KEY_PATTERN.test(normalized);
}

/**
 * Mask an Egyptian National ID according to Rule NEW-12.
 * Keeps century + year (3 digits), masks 7 middle digits, keeps last 4 digits.
 * Options:
 *   useExact14Length (default true) produces 7 asterisks (14 chars total: 298*******1234)
 *   false produces 8 asterisks (15 chars total: 298********1234)
 */
export function maskEgyptianNationalId(nid: string, useExact14Length = true): string {
  const clean = nid.trim().replace(/[-\s]/g, '');
  if (clean.length !== 14 || !/^[23]\d{13}$/.test(clean)) {
    return clean.length >= 4 ? `**********${clean.slice(-4)}` : '**********';
  }
  const asterisks = useExact14Length ? '*******' : '********';
  return `${clean.slice(0, 3)}${asterisks}${clean.slice(10)}`;
}

/**
 * Scrubs free-form strings, error messages, and stack traces from secrets,
 * bot tokens, database URLs, JWTs, private keys, and Egyptian personal data.
 */
export function scrubString(text: string, useExactNidLength = true): string {
  if (typeof text !== 'string' || text.length === 0) return text;

  let result = text;
  result = result.replace(PRIVATE_KEY_REGEX, '[REDACTED_PRIVATE_KEY]');
  result = result.replace(DB_URL_CREDENTIALS_REGEX, '$1[REDACTED_PASSWORD]$3');
  result = result.replace(REDIS_NO_USER_URL_REGEX, '$1:[REDACTED_PASSWORD]$3');
  result = result.replace(TELEGRAM_BOT_TOKEN_REGEX, '[REDACTED_BOT_TOKEN]');
  result = result.replace(JWT_TOKEN_REGEX, '[REDACTED_JWT]');
  result = result.replace(MAGIC_SESSION_TOKEN_REGEX, '[REDACTED_SESSION_TOKEN]');
  result = result.replace(GEMINI_API_KEY_REGEX, '[REDACTED_API_KEY]');
  result = result.replace(AUTHORIZATION_HEADER_REGEX, '$1[REDACTED_AUTHORIZATION]');
  result = result.replace(BEARER_VALUE_REGEX, 'Bearer [REDACTED_AUTHORIZATION]');
  result = result.replace(COOKIE_HEADER_REGEX, '$1[REDACTED_COOKIE]');
  result = result.replace(SENSITIVE_VALUE_ASSIGNMENT_REGEX, '$1[REDACTED]');

  const nidStars = useExactNidLength ? '$1*******$3' : '$1********$3';
  result = result.replace(EGYPTIAN_NID_GENERAL_REGEX, nidStars);
  result = result.replace(EGYPTIAN_NID_SEGMENTED_REGEX, (match) => {
    return maskEgyptianNationalId(match, useExactNidLength);
  });
  result = result.replace(EGYPTIAN_PHONE_REGEX, '$1****$2');

  return result;
}

/**
 * Recursive object redactor with circular reference protection (WeakSet),
 * error object scrubbing, BigInt serialization safety, and depth limits.
 */
export function redact<T>(value: T, options: RedactionOptions = {}): unknown {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxArrayLength = options.maxArrayLength ?? DEFAULT_MAX_ARRAY_LENGTH;
  const maxStringLength = options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;
  const useExactNidLength = options.useExactNidLength ?? true;
  const visited = new WeakSet<object>();

  function recurse(val: unknown, _key: string, currentDepth: number): unknown {
    if (val === null || val === undefined) return val;

    const valType = typeof val;
    if (valType === 'boolean' || valType === 'number') return val;
    if (valType === 'bigint') return (val as bigint).toString();
    if (valType === 'symbol') return (val as symbol).toString();
    if (valType === 'function') {
      const fn = val as (...args: unknown[]) => unknown;
      return `[Function: ${fn.name || 'anonymous'}]`;
    }

    if (valType === 'string') {
      let str = val as string;
      if (str.length > maxStringLength) {
        str = str.slice(0, maxStringLength) + '... [TRUNCATED]';
      }
      return scrubString(str, useExactNidLength);
    }

    if (currentDepth > maxDepth) {
      return '[MAX_DEPTH_REACHED]';
    }

    if (valType === 'object') {
      const obj = val as object;

      if (visited.has(obj)) {
        return '[CIRCULAR_REFERENCE]';
      }
      visited.add(obj);

      if (obj instanceof Date) {
        return obj.toISOString();
      }

      if (obj instanceof RegExp) {
        return obj.toString();
      }

      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj)) {
        return `[Buffer: ${obj.length} bytes]`;
      }

      // Error object scrubbing
      if (obj instanceof Error) {
        const errorObj: Record<string, unknown> = {
          name: obj.name,
          message: scrubString(obj.message, useExactNidLength),
          stack: obj.stack ? scrubString(obj.stack, useExactNidLength) : undefined,
        };

        if ('code' in obj) {
          errorObj.code = (obj as unknown as { code: unknown }).code;
        }

        if (obj.cause) {
          errorObj.cause = recurse(obj.cause, 'cause', currentDepth + 1);
        }

        for (const [k, v] of Object.entries(obj)) {
          if (k === 'name' || k === 'message' || k === 'stack' || k === 'cause') continue;
          if (isSensitiveKey(k)) {
            errorObj[k] = '[REDACTED]';
          } else {
            errorObj[k] = recurse(v, k, currentDepth + 1);
          }
        }
        return errorObj;
      }

      // Arrays
      if (Array.isArray(obj)) {
        const resultArr: unknown[] = [];
        const len = Math.min(obj.length, maxArrayLength);
        for (let i = 0; i < len; i++) {
          resultArr.push(recurse(obj[i], String(i), currentDepth + 1));
        }
        if (obj.length > maxArrayLength) {
          resultArr.push(`[... ${obj.length - maxArrayLength} more items]`);
        }
        return resultArr;
      }

      // Maps
      if (obj instanceof Map) {
        const mapObj: Record<string, unknown> = {};
        for (const [mk, mv] of obj.entries()) {
          const strKey = String(mk);
          if (isSensitiveKey(strKey)) {
            mapObj[strKey] = '[REDACTED]';
          } else {
            mapObj[strKey] = recurse(mv, strKey, currentDepth + 1);
          }
        }
        return mapObj;
      }

      // Sets
      if (obj instanceof Set) {
        return Array.from(obj).map((item, idx) => recurse(item, String(idx), currentDepth + 1));
      }

      // Plain Objects
      const resultObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (isSensitiveKey(k)) {
          resultObj[k] = '[REDACTED]';
        } else {
          resultObj[k] = recurse(v, k, currentDepth + 1);
        }
      }
      return resultObj;
    }

    return val;
  }

  return recurse(value, '', 0);
}
