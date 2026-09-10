import { createHmac } from 'node:crypto';
import { LINKING_TOKEN_TTL_SECONDS } from './flow.types.js';

export interface TokenValidationResult {
  isValid: boolean;
  error?: string;
}

export function generateLinkingSignature(
  workerCode: string,
  applicantTelegramId: bigint,
  expiresAt: number,
  secretKey: string
): string {
  const data = `${workerCode}:${applicantTelegramId.toString()}:${expiresAt}`;
  return createHmac('sha256', secretKey).update(data).digest('hex').substring(0, 32);
}

export function createLinkingToken(
  workerCode: string,
  applicantTelegramId: bigint,
  secretKey: string,
  ttlSeconds = LINKING_TOKEN_TTL_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000)
): { expiresAt: number; signature: string; tokenString: string } {
  const expiresAt = nowSeconds + ttlSeconds;
  const signature = generateLinkingSignature(workerCode, applicantTelegramId, expiresAt, secretKey);
  const tokenString = `link_${workerCode}_${applicantTelegramId.toString()}_${expiresAt}_${signature}`;
  return { expiresAt, signature, tokenString };
}

export function verifyLinkingSignature(
  workerCode: string,
  applicantTelegramId: bigint,
  expiresAt: number,
  signature: string,
  secretKey: string
): boolean {
  const expected = generateLinkingSignature(workerCode, applicantTelegramId, expiresAt, secretKey);
  return expected.toLowerCase() === signature.toLowerCase();
}

export function validateLinkingTokenConsumption(
  workerCode: string,
  applicantTelegramId: bigint,
  expiresAt: number,
  signature: string,
  currentTelegramId: bigint,
  secretKey: string
): TokenValidationResult {
  const nowSeconds = Math.floor(Date.now() / 1000);

  // 1. فحص انتهاء الصلاحية (24 ساعة)
  if (nowSeconds > expiresAt) {
    return { isValid: false, error: 'انتهت صلاحية رابط التفعيل المشفر (الصلاحية 24 ساعة). يرجى طلب رابط جديد.' };
  }

  // 2. التحقق الصارم من توقيع HMAC الرقمي
  if (!verifyLinkingSignature(workerCode, applicantTelegramId, expiresAt, signature, secretKey)) {
    return { isValid: false, error: 'رابط التفعيل غير موثق بتوقيع رقمي معتمد أو تم التلاعب به.' };
  }

  // 3. التحقق الصارم من هوية تيليجرام الحالية مقابل هوية مقدم الطلب
  if (currentTelegramId !== applicantTelegramId) {
    return {
      isValid: false,
      error: 'حظر أمني صارم: هذا الرابط مخصص حصرياً للمعرف الرقمي لمقدم الطلب الأصلي ولا يمكن استخدامه من حساب آخر.',
    };
  }

  return { isValid: true };
}
