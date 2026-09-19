import type { PendingWorkerEditState } from './flow.types.js';

export interface MinimalRedisDraftClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(...keys: string[]): Promise<number | unknown>;
}

/**
 * ⚡ مخزن مسودات تعديل العمال الموزع (Composite Scoped Redis Draft Store)
 * يحفظ مسودات التعديل بمفتاح مركب يمنع التصادم بين المشرفين والعمال:
 *   draft:worker_edit:${adminTelegramId}:${workerId}
 * مزود بـ TTL مدته 30 دقيقة (1800 ثانية) وحذف فوري عند الإلغاء أو الإتمام.
 * يدعم الـ Fallback التلقائي في الذاكرة العشوائية لضمان استمرارية التشغيل دون أي تأخير.
 */
export class WorkerEditDraftStore {
  private readonly memoryStore = new Map<string, PendingWorkerEditState>();
  private readonly defaultTtlSeconds = 1800; // 30 minutes

  constructor(private readonly redis?: MinimalRedisDraftClient) {}

  private getDraftKey(adminTelegramId: string, workerId: string): string {
    return `draft:worker_edit:${adminTelegramId}:${workerId}`;
  }

  private getActivePointerKey(adminTelegramId: string): string {
    return `draft:worker_edit:active:${adminTelegramId}`;
  }

  /**
   * استرجاع فوري من الذاكرة المحلية (L1 Mirror)
   */
  get(adminTelegramId: string): PendingWorkerEditState | undefined {
    return this.memoryStore.get(adminTelegramId);
  }

  /**
   * استرجاع متزامن/غير متزامن مع جلب من Redis إذا لم تكن المسودة في الذاكرة المحلية
   */
  async getAsync(adminTelegramId: string): Promise<PendingWorkerEditState | undefined> {
    const memoryDraft = this.memoryStore.get(adminTelegramId);
    if (memoryDraft) return memoryDraft;

    if (this.redis) {
      try {
        const activeWorkerId = await this.redis.get(this.getActivePointerKey(adminTelegramId));
        if (activeWorkerId) {
          const raw = await this.redis.get(this.getDraftKey(adminTelegramId, activeWorkerId));
          if (raw) {
            const parsed = JSON.parse(raw) as PendingWorkerEditState;
            this.memoryStore.set(adminTelegramId, parsed);
            return parsed;
          }
        }
      } catch (err) {
        console.warn(`⚠️ [WorkerEditDraftStore] Redis get error for admin ${adminTelegramId}:`, err);
      }
    }

    return undefined;
  }

  /**
   * حفظ المسودة في الذاكرة المحلية وتوزيعها في Redis بالمفتاح المركب
   */
  set(adminTelegramId: string, state: PendingWorkerEditState): this {
    this.memoryStore.set(adminTelegramId, state);

    if (this.redis && state.workerId) {
      const draftKey = this.getDraftKey(adminTelegramId, state.workerId);
      const pointerKey = this.getActivePointerKey(adminTelegramId);
      const serialized = JSON.stringify(state);

      this.redis
        .set(draftKey, serialized, 'EX', this.defaultTtlSeconds)
        .catch((err) => console.warn(`⚠️ [WorkerEditDraftStore] Redis set error for ${draftKey}:`, err));

      this.redis
        .set(pointerKey, state.workerId, 'EX', this.defaultTtlSeconds)
        .catch((err) => console.warn(`⚠️ [WorkerEditDraftStore] Redis pointer set error for ${pointerKey}:`, err));
    }

    return this;
  }

  /**
   * حذف المسودة فوراً من الذاكرة المحلية و Redis عند الإلغاء أو الإتمام
   */
  delete(adminTelegramId: string): boolean {
    const existing = this.memoryStore.get(adminTelegramId);
    const result = this.memoryStore.delete(adminTelegramId);

    if (this.redis) {
      const pointerKey = this.getActivePointerKey(adminTelegramId);
      const keysToDelete = [pointerKey];

      if (existing?.workerId) {
        keysToDelete.push(this.getDraftKey(adminTelegramId, existing.workerId));
      }

      this.redis
        .del(...keysToDelete)
        .catch((err) => console.warn(`⚠️ [WorkerEditDraftStore] Redis del error for admin ${adminTelegramId}:`, err));
    }

    return result;
  }

  /**
   * التحقق من وجود مسودة نشطة
   */
  has(adminTelegramId: string): boolean {
    return this.memoryStore.has(adminTelegramId);
  }

  /**
   * إفراغ المسودات بالكامل (مفيد للاختبارات)
   */
  clear(): void {
    this.memoryStore.clear();
  }

  /**
   * عدد المسودات الحالية في الذاكرة المحلية
   */
  get size(): number {
    return this.memoryStore.size;
  }
}
