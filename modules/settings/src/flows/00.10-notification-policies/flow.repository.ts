import type { Redis } from 'ioredis';

export class NotificationPoliciesRepository {
  constructor(private readonly redis?: Redis) {}

  async getPolicy(key: string): Promise<string | null> {
    if (!this.redis) return null;
    return this.redis.get(key);
  }

  async setPolicy(key: string, value: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(key, value);
  }

  async clearKeysByPattern(pattern: string): Promise<void> {
    if (!this.redis) return;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
