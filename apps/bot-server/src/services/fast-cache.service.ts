import { redis } from '../redis.js';

interface MemoryCacheEntry<T> {
  value: T;
  expiresAt: number;
  staleAt: number;
}

export interface FastCacheOptions {
  /** مدة الصلاحية الكاملة بالثواني (افتراضي: 300 ثانية / 5 دقائق) */
  ttlSeconds?: number;
  /** مدة اعتبار البيانات حديثة قبل بدء التحديث الخلفي (لنمط SWR) */
  staleTtlSeconds?: number;
}

/**
 * ⚡ محرك الكاش الموحد فائق الأداء (Multi-Tier Cache Engine)
 * L1: RAM المحلية فائقة السرعة (< 0.1ms) في ذاكرة المعالج مباشرة
 * L2: خادم Redis 7 الموزع (< 1.5ms) عبر ioredis
 * L3: استعلامات قاعدة البيانات PostgreSQL عبر Prisma
 */
export class FastCacheService {
  private l1Store = new Map<string, MemoryCacheEntry<any>>();
  private backgroundRefreshPromises = new Map<string, Promise<any>>();
  private readonly DEFAULT_TTL = 300; // 5 minutes

  private serialize(value: any): string {
    return JSON.stringify(value, (_key, val) =>
      typeof val === 'bigint' ? val.toString() : val
    );
  }

  /**
   * 💡 استرجاع القيمة من الكاش المتعدد أو جلبها وتخزينها تلقائياً
   * L1 RAM -> L2 Redis -> L3 Fetcher
   */
  public async remember<T>(
    key: string,
    ttlSeconds: number = this.DEFAULT_TTL,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const fullKey = `fastcache:${key}`;
    const now = Date.now();

    // 1. فحص المستوى الأول: L1 In-Memory RAM (< 0.1ms)
    const l1Entry = this.l1Store.get(fullKey);
    if (l1Entry && l1Entry.expiresAt > now) {
      return l1Entry.value as T;
    }

    // 2. فحص المستوى الثاني: L2 Redis 7 Cache (< 1.5ms)
    try {
      const cachedJson = await redis.get(fullKey);
      if (cachedJson) {
        const parsed = JSON.parse(cachedJson) as T;
        // حفظ في L1 للطلبات القادمة
        this.l1Store.set(fullKey, {
          value: parsed,
          expiresAt: now + ttlSeconds * 1000,
          staleAt: now + (ttlSeconds * 1000) / 2,
        });
        return parsed;
      }
    } catch (err) {
      console.warn(`⚠️ [FastCache] Redis read error for ${fullKey}:`, err);
    }

    // 3. المستوى الثالث: L3 Fetcher (Database Query)
    const freshValue = await fetcher();
    await this.set(key, freshValue, ttlSeconds);
    return freshValue;
  }

  /**
   * 🚀 نمط الاستجابة الفورية وتحديث الخلفية (Stale-While-Revalidate - SWR)
   * إذا كانت البيانات موجودة في L1 حتى لو انتهت فترة حداثتها (Stale)، نرسلها فورياً (< 0.1ms)
   * ويقوم النظام بتحديث البيانات في الخلفية بهدوء دون انتظار من المستخدم!
   */
  public async rememberSWR<T>(
    key: string,
    ttlSeconds: number = this.DEFAULT_TTL,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const fullKey = `fastcache:${key}`;
    const now = Date.now();

    const l1Entry = this.l1Store.get(fullKey);
    if (l1Entry) {
      // إذا تجاوزت البيانات فترة الحداثة ولم تنتهِ صلاحيتها تماماً، نبدأ التحديث الخلفي
      if (now > l1Entry.staleAt && !this.backgroundRefreshPromises.has(fullKey)) {
        const refreshPromise = fetcher()
          .then(async (fresh) => {
            await this.set(key, fresh, ttlSeconds);
            return fresh;
          })
          .catch((err) => {
            console.error(`⚠️ [FastCache-SWR] Background refresh failed for ${key}:`, err);
          })
          .finally(() => {
            this.backgroundRefreshPromises.delete(fullKey);
          });
        this.backgroundRefreshPromises.set(fullKey, refreshPromise);
      }
      return l1Entry.value as T;
    }

    // إذا لم تكن موجودة نهائياً في L1، نتحقق من L2 أو نجلبها مباشرة عبر remember
    return this.remember<T>(key, ttlSeconds, fetcher);
  }

  /**
   * حفظ مباشر في مستويات الكاش (L1 و L2)
   */
  public async set<T>(key: string, value: T, ttlSeconds: number = this.DEFAULT_TTL): Promise<void> {
    const fullKey = `fastcache:${key}`;
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;
    const staleAt = now + (ttlSeconds * 1000) / 2;

    // 1. حفظ في L1 (كائن حقيقي بالذاكرة بدون overhead التسلسل)
    this.l1Store.set(fullKey, { value, expiresAt, staleAt });

    // 2. حفظ في L2 Redis الموزع
    try {
      await redis.set(fullKey, this.serialize(value), 'EX', ttlSeconds);
    } catch (err) {
      console.warn(`⚠️ [FastCache] Redis set error for ${fullKey}:`, err);
    }
  }

  /**
   * جلب مباشر من الكاش دون استدعاء fetcher
   */
  public async get<T>(key: string): Promise<T | null> {
    const fullKey = `fastcache:${key}`;
    const now = Date.now();

    const l1 = this.l1Store.get(fullKey);
    if (l1 && l1.expiresAt > now) return l1.value as T;

    try {
      const raw = await redis.get(fullKey);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        this.l1Store.set(fullKey, {
          value: parsed,
          expiresAt: now + this.DEFAULT_TTL * 1000,
          staleAt: now + (this.DEFAULT_TTL * 1000) / 2,
        });
        return parsed;
      }
    } catch {}

    return null;
  }

  /**
   * 🎯 تطهير وحذف موجه لمفتاح كاش محدد فوراً (Targeted Invalidation)
   */
  public async invalidate(key: string): Promise<void> {
    const fullKey = `fastcache:${key}`;
    this.l1Store.delete(fullKey);

    try {
      await redis.del(fullKey);
    } catch (err) {
      console.warn(`⚠️ [FastCache] Redis invalidate error for ${fullKey}:`, err);
    }
  }

  /**
   * 🧹 تطهير مجموعة مفاتيح بالنمط (مثل: 'sites:*' أو 'projects:*' أو 'user:*')
   */
  public async invalidatePattern(pattern: string): Promise<void> {
    const cleanPattern = pattern.startsWith('fastcache:') ? pattern.slice(10) : pattern;
    const regexPattern = new RegExp(
      `^fastcache:${cleanPattern.replace(/\*/g, '.*')}$`
    );

    // تطهير L1 RAM
    for (const k of this.l1Store.keys()) {
      if (regexPattern.test(k)) {
        this.l1Store.delete(k);
      }
    }

    // تطهير L2 Redis
    try {
      const redisPattern = `fastcache:${cleanPattern.includes('*') ? cleanPattern : `${cleanPattern}*`}`;
      const keys = await redis.keys(redisPattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      console.warn(`⚠️ [FastCache] Redis invalidatePattern error for ${pattern}:`, err);
    }
  }

  /**
   * 🔒 قفل توزيعي لمنع تكرار العمليات والضغط المزدوج (Distributed Mutex Lock)
   */
  public async withLock<T>(
    lockKey: string,
    ttlSeconds: number = 10,
    action: () => Promise<T>
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const fullLockKey = `lock:${lockKey}`;
    const token = `${Date.now()}-${Math.random()}`;

    let acquired = false;

    try {
      const res = await redis.set(fullLockKey, token, 'EX', ttlSeconds, 'NX');
      acquired = res === 'OK';
    } catch {
      acquired = true; // Fallback to memory execution if redis fails
    }

    if (!acquired) {
      return {
        success: false,
        error: '⚠️ العملية قيد التنفيذ بالفعل! يرجى الانتظار ثوانٍ معدودة وعدم الضغط المتكرر.',
      };
    }

    try {
      const result = await action();
      return { success: true, result };
    } finally {
      try {
        const currentVal = await redis.get(fullLockKey);
        if (currentVal === token) {
          await redis.del(fullLockKey);
        }
      } catch {
        // Ignore unlock error
      }
    }
  }

  /**
   * ⏱️ دالة مساعدة لحساب وتوثيق زمن تنفيذ أي عملية بدقة الملي ثانية
   */
  public async measureSpeed<T>(
    actionName: string,
    action: () => Promise<T>
  ): Promise<{ result: T; durationMs: number }> {
    const start = performance.now();
    try {
      const result = await action();
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      return { result, durationMs };
    } catch (error) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      console.error(`❌ [SpeedAudit] ${actionName} failed after ${durationMs}ms:`, error);
      throw error;
    }
  }

  /**
   * استرجاع قائمة بكافة مفاتيح الكاش المحفوظة حالياً في ذاكرة L1
   */
  public getMemoryKeys(): string[] {
    return Array.from(this.l1Store.keys()).map((k) => k.replace(/^fastcache:/, ''));
  }

  /**
   * تطهير كامل الذاكرة المحلية L1 (مفيد للاختبارات)
   */
  public clearL1(): void {
    this.l1Store.clear();
    this.backgroundRefreshPromises.clear();
  }
}

export const fastCache = new FastCacheService();
