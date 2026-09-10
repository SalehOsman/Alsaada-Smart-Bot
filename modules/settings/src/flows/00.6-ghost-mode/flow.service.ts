import type { GhostModeRepository } from './flow.repository.js';
import type { UserRole } from '../../shared/module.types.js';
import type { ImpersonatedEntity } from './flow.types.js';
import { validateImpersonationRole } from './flow.validators.js';

export class GhostModeService {
  constructor(private readonly repository: GhostModeRepository) {}

  async impersonate(
    telegramId: bigint,
    roleInput: string,
    entity?: ImpersonatedEntity
  ): Promise<{ success: boolean; role?: UserRole | undefined; entity?: ImpersonatedEntity | undefined; error?: string | undefined }> {
    const val = validateImpersonationRole(roleInput);
    if (!val.isValid || !val.role) {
      return { success: false, error: 'الدور المطلوب غير متاح للمحاكاة.' };
    }

    let resolvedEntity = entity;
    if (val.role === 'FIELD_ADMIN' && !resolvedEntity) {
      const firstSite = await this.repository.getFirstActiveSite();
      if (firstSite) {
        resolvedEntity = {
          type: 'SITE',
          id: firstSite.id,
          name: firstSite.name,
          siteId: firstSite.id,
          siteName: firstSite.name,
        };
      }
    }

    await this.repository.setImpersonatedRole(telegramId, val.role, resolvedEntity);
    return { success: true, role: val.role, ...(resolvedEntity ? { entity: resolvedEntity } : {}) };
  }

  async impersonateWorker(telegramId: bigint, workerId: string): Promise<{ success: boolean; role?: UserRole | undefined; workerName?: string | undefined; entity?: ImpersonatedEntity | undefined; error?: string | undefined }> {
    const worker = await this.repository.findWorkerById(workerId);
    if (!worker) return { success: false, error: 'العامل المطلوب غير مسجل أو غير نشط.' };

    const entity: ImpersonatedEntity = {
      type: 'WORKER',
      id: worker.id,
      code: worker.code,
      name: worker.nickname || worker.name,
      siteId: worker.siteId || undefined,
      siteName: worker.site?.name,
    };

    await this.repository.setImpersonatedRole(telegramId, 'WORKER', entity);
    return { success: true, role: 'WORKER', workerName: entity.name, entity };
  }

  async impersonateSupplier(telegramId: bigint, supplierId: string): Promise<{ success: boolean; role?: UserRole | undefined; supplierName?: string | undefined; entity?: ImpersonatedEntity | undefined; error?: string | undefined }> {
    const supplier = await this.repository.findSupplierById(supplierId);
    if (!supplier) return { success: false, error: 'المورد المطلوب غير مسجل أو غير نشط.' };

    const entity: ImpersonatedEntity = {
      type: 'SUPPLIER',
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
    };

    await this.repository.setImpersonatedRole(telegramId, 'SUPPLIER', entity);
    return { success: true, role: 'SUPPLIER', supplierName: entity.name, entity };
  }

  async exitImpersonate(telegramId: bigint): Promise<void> {
    await this.repository.clearImpersonatedRole(telegramId);
  }

  async getActiveImpersonation(telegramId: bigint): Promise<UserRole | null> {
    return this.repository.getImpersonatedRole(telegramId);
  }

  async getActiveEntity(telegramId: bigint): Promise<ImpersonatedEntity | null> {
    return this.repository.getImpersonatedEntity(telegramId);
  }

  async getActiveWorkers() {
    return this.repository.getActiveWorkers();
  }

  async getActiveSuppliers() {
    return this.repository.getActiveSuppliers();
  }
}

