import { describe, it, expect } from 'vitest';
import {
  createLinkingToken,
  validateLinkingTokenConsumption,
  generateLinkingSignature,
} from '../flow.validators.js';

describe('01.7 Guest Join & WhatsApp Linking — Unit Tests', () => {
  const secretKey = 'test-secret-key-12345';
  const workerCode = 'OP-DRV-0010';
  const applicantTelegramId = 88997766n;

  it('should generate a 24-hour cryptographic linking token with valid signature', () => {
    const { expiresAt, signature, tokenString } = createLinkingToken(
      workerCode,
      applicantTelegramId,
      secretKey
    );

    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(expiresAt).toBeGreaterThanOrEqual(nowSeconds + 86390);
    expect(signature).toBeDefined();
    expect(tokenString).toContain(`link_${workerCode}_${applicantTelegramId.toString()}`);
  });

  it('should validate token successfully when telegram ID matches and not expired', () => {
    const { expiresAt, signature } = createLinkingToken(
      workerCode,
      applicantTelegramId,
      secretKey
    );

    const res = validateLinkingTokenConsumption(
      workerCode,
      applicantTelegramId,
      expiresAt,
      signature,
      applicantTelegramId,
      secretKey
    );

    expect(res.isValid).toBe(true);
  });

  it('should hard-reject token if opened by a different Telegram account (ID Mismatch)', () => {
    const { expiresAt, signature } = createLinkingToken(
      workerCode,
      applicantTelegramId,
      secretKey
    );

    const attackerTelegramId = 11223344n;
    const res = validateLinkingTokenConsumption(
      workerCode,
      applicantTelegramId,
      expiresAt,
      signature,
      attackerTelegramId,
      secretKey
    );

    expect(res.isValid).toBe(false);
    expect(res.error).toContain('حظر أمني صارم: هذا الرابط مخصص حصرياً للمعرف الرقمي لمقدم الطلب الأصلي');
  });

  it('should reject expired linking tokens', () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 30; // 30s ago
    const signature = generateLinkingSignature(workerCode, applicantTelegramId, pastExpiry, secretKey);

    const res = validateLinkingTokenConsumption(
      workerCode,
      applicantTelegramId,
      pastExpiry,
      signature,
      applicantTelegramId,
      secretKey
    );

    expect(res.isValid).toBe(false);
    expect(res.error).toContain('انتهت صلاحية رابط التفعيل المشفر');
  });

  it('should reject tampered token signatures', () => {
    const { expiresAt } = createLinkingToken(
      workerCode,
      applicantTelegramId,
      secretKey
    );

    const tamperedSignature = 'deadbeef1234567890abcdef12345678';
    const res = validateLinkingTokenConsumption(
      workerCode,
      applicantTelegramId,
      expiresAt,
      tamperedSignature,
      applicantTelegramId,
      secretKey
    );

    expect(res.isValid).toBe(false);
    expect(res.error).toContain('رابط التفعيل غير موثق بتوقيع رقمي معتمد');
  });
});
