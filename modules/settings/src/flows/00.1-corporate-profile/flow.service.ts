import type { Redis } from 'ioredis';
import type { CorporateProfileRepository } from './flow.repository.js';
import type { CompanyProfileDto, CompanyFieldKey, PendingCompanyEditState } from './flow.types.js';
import { validateCompanyFieldValue } from './flow.validators.js';

export class CorporateProfileService {
  private localPendingEdits = new Map<string, PendingCompanyEditState>();

  constructor(
    private readonly repository: CorporateProfileRepository,
    private readonly redis?: Redis | null
  ) {}

  async getProfile(): Promise<CompanyProfileDto | null> {
    return this.repository.getProfile();
  }

  async updateField(
    fieldKey: CompanyFieldKey,
    value: string
  ): Promise<{ success: boolean; profile?: CompanyProfileDto; error?: string }> {
    const validation = validateCompanyFieldValue(fieldKey, value);
    if (!validation.isValid) {
      return { success: false, error: validation.error ?? 'قيمة الحقل غير صالحة' };
    }


    const updated = await this.repository.updateField(fieldKey, value.trim());
    return { success: true, profile: updated };
  }

  async updateImage(field: 'logoPath' | 'headerImagePath' | 'footerImagePath', path: string, fileId: string): Promise<CompanyProfileDto> {
    return this.repository.updateImage(field, path, fileId);
  }

  async setPendingEdit(telegramId: bigint, fieldKey: CompanyFieldKey, promptMessageId: number): Promise<void> {
    const state: PendingCompanyEditState = {
      fieldKey,
      promptMessageId,
      timestamp: Date.now(),
    };

    if (this.redis) {
      const key = `pending_comp_edit:${telegramId}`;
      await this.redis.set(key, JSON.stringify(state), 'EX', 600); // 10 minutes
    } else {
      this.localPendingEdits.set(telegramId.toString(), state);
    }
  }

  async getPendingEdit(telegramId: bigint): Promise<PendingCompanyEditState | null> {
    if (this.redis) {
      const key = `pending_comp_edit:${telegramId}`;
      const data = await this.redis.get(key);
      return data ? (JSON.parse(data) as PendingCompanyEditState) : null;
    }
    return this.localPendingEdits.get(telegramId.toString()) || null;
  }

  async clearPendingEdit(telegramId: bigint): Promise<void> {
    if (this.redis) {
      const key = `pending_comp_edit:${telegramId}`;
      await this.redis.del(key);
    } else {
      this.localPendingEdits.delete(telegramId.toString());
    }
  }
}
