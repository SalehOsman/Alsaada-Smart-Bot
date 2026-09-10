import type { Redis } from 'ioredis';
import type { PrismaClient } from '@alsaada/database';
import type { UserRole } from '../../shared/module.types.js';
import type { ImpersonatedEntity } from './flow.types.js';

export class GhostModeRepository {
  private localRoleStore = new Map<string, UserRole>();
  private localEntityStore = new Map<string, ImpersonatedEntity>();

  constructor(
    private readonly redis?: Redis | null,
    private readonly prisma?: PrismaClient | null
  ) {}

  async setImpersonatedRole(telegramId: bigint, role: UserRole, entity?: ImpersonatedEntity): Promise<void> {
    const key = `impersonate:user:${telegramId}`;
    const entKey = `impersonate:entity:${telegramId}`;
    if (this.redis) {
      await this.redis.set(key, role, 'EX', 86400);
      if (entity) {
        await this.redis.set(entKey, JSON.stringify(entity), 'EX', 86400);
      } else {
        await this.redis.del(entKey);
      }
    } else {
      this.localRoleStore.set(telegramId.toString(), role);
      if (entity) {
        this.localEntityStore.set(telegramId.toString(), entity);
      } else {
        this.localEntityStore.delete(telegramId.toString());
      }
    }
  }

  async getImpersonatedRole(telegramId: bigint): Promise<UserRole | null> {
    const key = `impersonate:user:${telegramId}`;
    if (this.redis) {
      const raw = await this.redis.get(key);
      return (raw as UserRole) || null;
    }
    return this.localRoleStore.get(telegramId.toString()) || null;
  }

  async getImpersonatedEntity(telegramId: bigint): Promise<ImpersonatedEntity | null> {
    const entKey = `impersonate:entity:${telegramId}`;
    if (this.redis) {
      const raw = await this.redis.get(entKey);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as ImpersonatedEntity;
      } catch {
        return null;
      }
    }
    return this.localEntityStore.get(telegramId.toString()) || null;
  }

  async clearImpersonatedRole(telegramId: bigint): Promise<void> {
    const key = `impersonate:user:${telegramId}`;
    const entKey = `impersonate:entity:${telegramId}`;
    if (this.redis) {
      await this.redis.del(key);
      await this.redis.del(entKey);
    } else {
      this.localRoleStore.delete(telegramId.toString());
      this.localEntityStore.delete(telegramId.toString());
    }
  }

  async getActiveWorkers(take = 8): Promise<Array<{ id: string; name: string; code: string; siteName?: string | undefined }>> {
    if (!this.prisma) return [];
    try {
      const workers = await this.prisma.worker.findMany({
        where: { status: 'ACTIVE' },
        take,
        orderBy: { code: 'asc' },
        include: { site: { select: { name: true } } },
      });
      return workers.map((w) => ({
        id: w.id,
        name: w.nickname || w.name,
        code: w.code,
        siteName: w.site?.name ?? undefined,
      }));
    } catch {
      return [];
    }
  }

  async getActiveSuppliers(take = 8): Promise<Array<{ id: string; name: string; code: string }>> {
    if (!this.prisma) return [];
    try {
      const suppliers = await this.prisma.supplier.findMany({
        where: { status: 'ACTIVE' },
        take,
        orderBy: { code: 'asc' },
      });
      return suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
      }));
    } catch {
      return [];
    }
  }

  async findWorkerById(workerId: string) {
    if (!this.prisma) return null;
    return this.prisma.worker.findUnique({
      where: { id: workerId },
      include: { site: { select: { id: true, name: true } } },
    });
  }

  async findSupplierById(supplierId: string) {
    if (!this.prisma) return null;
    return this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });
  }

  async getFirstActiveSite(): Promise<{ id: string; name: string } | null> {
    if (!this.prisma) return null;
    try {
      return await this.prisma.site.findFirst({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
      });
    } catch {
      return null;
    }
  }
}

