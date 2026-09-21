import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLinkingToken,
  validateLinkingTokenConsumption,
  generateLinkingSignature,
} from '../flow.validators.js';

describe('01.7 Guest Join & WhatsApp Linking — Unit Tests', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');
  const secretKey = 'test-secret-key-12345';
  const workerCode = 'OP-DRV-0010';
  const applicantTelegramId = 88997766n;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('generates a 24-hour cryptographic linking token with valid signature', () => {
    // Arrange
    const nowSeconds = Math.floor(PINNED_BASE_TIME.getTime() / 1000);

    // Act
    const { expiresAt, signature, tokenString } = createLinkingToken(
      workerCode,
      applicantTelegramId,
      secretKey
    );

    // Assert
    expect(expiresAt).toBeGreaterThanOrEqual(nowSeconds + 86390);
    expect(signature).toBeDefined();
    expect(tokenString).toContain(`link_${workerCode}_${applicantTelegramId.toString()}`);
    expect(expiresAt).not.toBeLessThan(nowSeconds);
  });

  it('validates token successfully when telegram ID matches and not expired', () => {
    // Arrange
    const { expiresAt, signature } = createLinkingToken(
      workerCode,
      applicantTelegramId,
      secretKey
    );

    // Act
    const res = validateLinkingTokenConsumption(
      workerCode,
      applicantTelegramId,
      expiresAt,
      signature,
      applicantTelegramId,
      secretKey
    );

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('hard-rejects token if opened by a different Telegram account due to ID mismatch', () => {
    // Arrange
    const { expiresAt, signature } = createLinkingToken(
      workerCode,
      applicantTelegramId,
      secretKey
    );
    const attackerTelegramId = 11223344n;

    // Act
    const res = validateLinkingTokenConsumption(
      workerCode,
      applicantTelegramId,
      expiresAt,
      signature,
      attackerTelegramId,
      secretKey
    );

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('حظر أمني صارم: هذا الرابط مخصص حصرياً للمعرف الرقمي لمقدم الطلب الأصلي');
  });

  it('rejects expired linking tokens', () => {
    // Arrange
    const pastExpiry = Math.floor(PINNED_BASE_TIME.getTime() / 1000) - 30;
    const signature = generateLinkingSignature(workerCode, applicantTelegramId, pastExpiry, secretKey);

    // Act
    const res = validateLinkingTokenConsumption(
      workerCode,
      applicantTelegramId,
      pastExpiry,
      signature,
      applicantTelegramId,
      secretKey
    );

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('انتهت صلاحية رابط التفعيل المشفر');
  });

  it('rejects tampered token signatures', () => {
    // Arrange
    const { expiresAt } = createLinkingToken(
      workerCode,
      applicantTelegramId,
      secretKey
    );
    const tamperedSignature = 'deadbeef1234567890abcdef12345678';

    // Act
    const res = validateLinkingTokenConsumption(
      workerCode,
      applicantTelegramId,
      expiresAt,
      tamperedSignature,
      applicantTelegramId,
      secretKey
    );

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('رابط التفعيل غير موثق بتوقيع رقمي معتمد');
  });
});
