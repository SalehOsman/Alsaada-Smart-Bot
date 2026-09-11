import { decryptField, normalizeKeyToHex } from '@alsaada/database';
import type { GuestJoinRepository } from './flow.repository.js';
import type { GuestJoinApplicationResult, ConsumeLinkingTokenResult } from './flow.types.js';
import {
  createLinkingToken,
  validateLinkingTokenConsumption,
} from './flow.validators.js';
import { formatWhatsAppMessageText } from './flow.messages.js';

export class GuestJoinService {
  private readonly normalizedKeyHex: string;

  constructor(
    private readonly repository: GuestJoinRepository,
    private readonly secretKey: string = 'alsaada-default-key-min-32-chars-long!'
  ) {
    this.normalizedKeyHex = normalizeKeyToHex(this.secretKey);
  }

  decryptFieldSafe(encrypted?: string | null): string {
    if (!encrypted) return '';
    try {
      return decryptField(encrypted, this.normalizedKeyHex);
    } catch {
      return encrypted;
    }
  }

  async searchWorkerForGuest(query: string) {
    return this.repository.findWorkerByCodeOrSearch(query);
  }

  async checkApplicantStatus(applicantTelegramId: bigint) {
    return this.repository.findPendingApplication(applicantTelegramId);
  }

  async submitJoinRequest(
    applicantTelegramId: bigint,
    workerQuery: string,
    applicantUsername?: string,
    applicantFullName?: string
  ): Promise<GuestJoinApplicationResult> {
    const worker = await this.repository.findWorkerByCodeOrSearch(workerQuery);
    if (!worker) {
      throw new Error('لم يتم العثور على أي سجل مطابق للكود أو الرقم المدخل.');
    }

    if (worker.telegramId && worker.telegramId !== applicantTelegramId) {
      throw new Error('هذا السجل الوظيفي مرتبط بالفعل بحساب تليجرام معتمد بالمنظومة.');
    }

    const officialPhone = this.decryptFieldSafe(worker.phoneEncrypted) || '01000000000';

    const ticket = await this.repository.createJoinApplication(
      applicantTelegramId,
      worker.id,
      worker.code,
      worker.name,
      `مقدم الطلب: ${applicantFullName || 'غير محدد'} (@${applicantUsername || 'بدون معرف'})`
    );

    return {
      success: true,
      ticketNumber: ticket.ticketNumber,
      workerName: worker.nickname || worker.name,
      workerCode: worker.code,
      officialPhone,
      message: 'تم تسجيل طلب الانضمام والمصادقة الأمنية بنجاح.',
    };
  }

  generateVerificationWhatsAppUrl(
    workerCode: string,
    workerName: string,
    officialPhone: string,
    applicantTelegramId: bigint,
    botUsername = 'AlsaadaSmartBot',
    nowSeconds?: number
  ): { whatsAppUrl: string; deepLink: string; tokenString: string } {
    const { tokenString, signature } = createLinkingToken(
      workerCode,
      applicantTelegramId,
      this.secretKey,
      undefined,
      nowSeconds
    );

    this.repository.registerActiveToken(workerCode, signature);

    const deepLink = `https://t.me/${botUsername}?start=${tokenString}`;
    const messageText = formatWhatsAppMessageText(workerName, deepLink);

    let cleanPhone = officialPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) {
      cleanPhone = `20${cleanPhone.substring(1)}`;
    } else if (!cleanPhone.startsWith('20') && cleanPhone.length === 10) {
      cleanPhone = `20${cleanPhone}`;
    }

    const encodedText = encodeURIComponent(messageText);
    const whatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

    return { whatsAppUrl, deepLink, tokenString };
  }

  async consumeLinkingToken(
    workerCode: string,
    applicantTelegramId: bigint,
    expiresAt: number,
    signature: string,
    currentTelegramId: bigint,
    applicantUsername?: string
  ): Promise<ConsumeLinkingTokenResult> {
    if (this.repository.isTokenConsumed(signature)) {
      throw new Error('تم استهلاك هذا الرابط مسبقاً وتفعيله. الرابط صالح للاستخدام لمرة واحدة فقط.');
    }

    if (!this.repository.isTokenActive(workerCode, signature)) {
      throw new Error('تم إبطال هذا الرابط لتوليد رابط أحدث للعامل. يرجى طلب الرابط الأخير.');
    }

    const validation = validateLinkingTokenConsumption(
      workerCode,
      applicantTelegramId,
      expiresAt,
      signature,
      currentTelegramId,
      this.secretKey
    );

    if (!validation.isValid) {
      throw new Error(validation.error || 'رمز توثيق وتفعيل الرابط غير صالح.');
    }

    return this.repository.linkWorkerAccount(
      workerCode,
      applicantTelegramId,
      applicantUsername,
      signature
    );
  }
}
