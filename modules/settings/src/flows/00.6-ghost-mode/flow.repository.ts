import type { Redis } from 'ioredis';
import type { UserRole } from '../../shared/module.types.js';

export class GhostModeRepository {
  private localStore = new Map<string, UserRole>();

  constructor(private readonly redis?: Redis | null) {}

  async setImpersonatedRole(telegramId: bigint, role: UserRole): Promise<void> {
    if (this.redis) {
      await this.redis.set(`impersonated_role:${telegramId}`, role, 'EX', 86400);
    } else {
      this.localStore.set(telegramId.toString(), role);
    }
  }

  async getImpersonatedRole(telegramId: bigint): Promise<UserRole | null> {
    if (this.redis) {
      const raw = await this.redis.get(`impersonated_role:${telegramId}`);
      return (raw as UserRole) || null;
    }
    return this.localStore.get(telegramId.toString()) || null;
  }

  async clearImpersonatedRole(telegramId: bigint): Promise<void> {
    if (this.redis) {
      await this.redis.del(`impersonated_role:${telegramId}`);
    } else {
      this.localStore.delete(telegramId.toString());
    }
  }
}
