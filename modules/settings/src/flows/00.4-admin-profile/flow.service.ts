import type { Redis } from 'ioredis';
import { encryptField, decryptField, createBlindIndex } from '@alsaada/database';
import type { AdminProfileRepository } from './flow.repository.js';
import type { AdminProfileDto, PendingAdminEditState } from './flow.types.js';
import { validateAdminFullName, validateAdminPhone } from './flow.validators.js';

export class AdminProfileService {
  private localEdits = new Map<string, PendingAdminEditState>();

  constructor(
    private readonly repository: AdminProfileRepository,
    private readonly encryptionKey?: string,
    private readonly redis?: Redis | null
  ) {}

  async getProfile(telegramId: bigint): Promise<AdminProfileDto | null> {
    const user = await this.repository.getUser(telegramId);
    if (!user) return null;

    let phone: string | null = null;
    if (user.phoneEncrypted && this.encryptionKey) {
      try {
        phone = decryptField(user.phoneEncrypted, this.encryptionKey);
      } catch {
        phone = '⚠️ خطأ فك التشفير';
      }
    }

    return {
      id: user.id,
      telegramId: user.telegramId,
      role: user.role,
      fullName: user.fullName,
      phone,
      assignedSiteName: user.assignedSite?.name ?? null,
      isActive: user.isActive,
    };
  }

  async updateFullName(telegramId: bigint, fullName: string): Promise<{ success: boolean; error?: string }> {
    const val = validateAdminFullName(fullName);
    if (!val.isValid) return { success: false, error: val.error ?? 'الاسم غير صالح' };

    await this.repository.updateFullName(telegramId, fullName.trim());
    return { success: true };
  }

  async updatePhone(telegramId: bigint, phone: string): Promise<{ success: boolean; error?: string }> {
    const val = validateAdminPhone(phone);
    if (!val.isValid || !val.normalized) return { success: false, error: val.error ?? 'رقم الهاتف غير صالح' };


    const key = this.encryptionKey || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const encrypted = encryptField(val.normalized, key);
    const hash = createBlindIndex(val.normalized, key);

    await this.repository.updateEncryptedPhone(telegramId, encrypted, hash);
    return { success: true };
  }

  async setPendingEdit(telegramId: bigint, state: PendingAdminEditState): Promise<void> {
    if (this.redis) {
      await this.redis.set(`admin_edit:${telegramId}`, JSON.stringify(state), 'EX', 600);
    } else {
      this.localEdits.set(telegramId.toString(), state);
    }
  }

  async getPendingEdit(telegramId: bigint): Promise<PendingAdminEditState | null> {
    if (this.redis) {
      const raw = await this.redis.get(`admin_edit:${telegramId}`);
      return raw ? (JSON.parse(raw) as PendingAdminEditState) : null;
    }
    return this.localEdits.get(telegramId.toString()) || null;
  }

  async clearPendingEdit(telegramId: bigint): Promise<void> {
    if (this.redis) {
      await this.redis.del(`admin_edit:${telegramId}`);
    } else {
      this.localEdits.delete(telegramId.toString());
    }
  }
}
