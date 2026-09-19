import crypto from 'node:crypto';
import { redis } from '../redis.js';

export interface MemoryCacheEntry<T> {
  value: T;
  expiresAt: number;
  staleAt: number;
}

export interface SpeedAuditResult<T> {
  result: T;
  durationMs: number;
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
  private inflightRequests = new Map<string, Promise<any>>();
  private memoizedKeyboards = new Map<string, any>();
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly MAX_L1_SIZE = 5000; // Maximum items in L1 memory cache (LRU)

  private setL1Entry<T>(key: string, entry: MemoryCacheEntry<T>): void {
    if (this.l1Store.has(key)) {
      this.l1Store.delete(key);
    } else if (this.l1Store.size >= this.MAX_L1_SIZE) {
      const oldestKey = this.l1Store.keys().next().value;
      if (oldestKey !== undefined) {
        this.l1Store.delete(oldestKey);
      }
    }
    this.l1Store.set(key, entry);
  }

  private touchL1Entry(key: string, entry: MemoryCacheEntry<any>): void {
    this.l1Store.delete(key);
    this.l1Store.set(key, entry);
  }

  private serialize(value: any): string {
    return JSON.stringify(value, (_key, val) =>
      typeof val === 'bigint' ? val.toString() : val
    );
  }

  private isRedisReady(): boolean {
    return !redis.status || redis.status === 'ready';
  }

  /**
   * 💡 استرجاع القيمة من الكاش المتعدد أو جلبها وتخزينها تلقائياً
   * L1 RAM -> L2 Redis -> L3 Fetcher
   * مزود بحماية كاملة من التدافع المتزامن (Dogpile / Cache Stampede Coalescing)
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
      this.touchL1Entry(fullKey, l1Entry);
      return l1Entry.value as T;
    }

    // Coalesce concurrent requests (Dogpile / Cache Stampede Protection)
    if (this.inflightRequests.has(fullKey)) {
      return this.inflightRequests.get(fullKey) as Promise<T>;
    }

    const inflight = (async () => {
      try {
        // 2. فحص المستوى الثاني: L2 Redis 7 Cache (< 1.5ms)
        if (this.isRedisReady()) {
          try {
            const cachedJson = await redis.get(fullKey);
            if (cachedJson) {
              const parsed = JSON.parse(cachedJson) as T;
              // حفظ في L1 للطلبات القادمة
              this.setL1Entry(fullKey, {
                value: parsed,
                expiresAt: now + ttlSeconds * 2 * 1000,
                staleAt: now + ttlSeconds * 1000,
              });
              return parsed;
            }
          } catch (err) {
            console.warn(`⚠️ [FastCache] Redis read error for ${fullKey}:`, err);
          }
        }

        // 3. المستوى الثالث: L3 Fetcher (Database Query)
        const freshValue = await fetcher();
        await this.set(key, freshValue, ttlSeconds);
        return freshValue;
      } finally {
        this.inflightRequests.delete(fullKey);
      }
    })();

    this.inflightRequests.set(fullKey, inflight);
    return inflight;
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
      if (now >= l1Entry.expiresAt) {
        // انتهت الصلاحية الكلية القصوى - حذف القيمة واللجوء لـ fetcher الفوري
        this.l1Store.delete(fullKey);
      } else {
        this.touchL1Entry(fullKey, l1Entry);
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
    const staleAt = now + ttlSeconds * 1000;
    const expiresAt = now + ttlSeconds * 2 * 1000;

    // 1. حفظ في L1 (كائن حقيقي بالذاكرة بدون overhead التسلسل مع سياسة تفريغ LRU)
    this.setL1Entry(fullKey, { value, expiresAt, staleAt });

    // 2. حفظ في L2 Redis الموزع
    if (this.isRedisReady()) {
      try {
        await redis.set(fullKey, this.serialize(value), 'EX', ttlSeconds * 2);
      } catch (err) {
        console.warn(`⚠️ [FastCache] Redis set error for ${fullKey}:`, err);
      }
    }
  }

  /**
   * جلب مباشر من الكاش دون استدعاء fetcher
   */
  public async get<T>(key: string): Promise<T | null> {
    const fullKey = `fastcache:${key}`;
    const now = Date.now();

    const l1 = this.l1Store.get(fullKey);
    if (l1 && l1.expiresAt > now) {
      this.touchL1Entry(fullKey, l1);
      return l1.value as T;
    }

    if (this.isRedisReady()) {
      try {
        const raw = await redis.get(fullKey);
        if (raw) {
          const parsed = JSON.parse(raw) as T;
          this.setL1Entry(fullKey, {
            value: parsed,
            expiresAt: now + this.DEFAULT_TTL * 2 * 1000,
            staleAt: now + this.DEFAULT_TTL * 1000,
          });
          return parsed;
        }
      } catch (err) {
        console.warn(`⚠️ [FastCache] Redis get error for ${fullKey}:`, err);
      }
    }

    return null;
  }

  /**
   * 🎯 تطهير وحذف موجه لمفتاح كاش محدد فوراً (Targeted Invalidation)
   */
  public async invalidate(key: string): Promise<void> {
    const fullKey = `fastcache:${key}`;
    this.l1Store.delete(fullKey);

    if (this.isRedisReady()) {
      try {
        await redis.del(fullKey);
      } catch (err) {
        console.warn(`⚠️ [FastCache] Redis invalidate error for ${fullKey}:`, err);
      }
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

    // تطهير L1
    for (const k of this.l1Store.keys()) {
      if (regexPattern.test(k)) {
        this.l1Store.delete(k);
      }
    }

    // تطهير L2 Redis الموزع بشكل متدفق غير حاجب لـ Event Loop (Non-blocking scanStream)
    if (this.isRedisReady()) {
      try {
        const redisPattern = `fastcache:${cleanPattern.includes('*') ? cleanPattern : `${cleanPattern}*`}`;
        if (typeof (redis as any).scanStream === 'function') {
          const stream = (redis as any).scanStream({ match: redisPattern, count: 100 });
          for await (const chunk of stream) {
            const keys = chunk as string[];
            if (keys && keys.length > 0) {
              await redis.del(...keys);
            }
          }
        } else if (typeof (redis as any).keys === 'function') {
          // Fallback for mocked/custom environments without scanStream
          const keys = await (redis as any).keys(redisPattern);
          if (keys && keys.length > 0) {
            await redis.del(...keys);
          }
        }
      } catch (err) {
        console.warn(`⚠️ [FastCache] Redis invalidatePattern error for ${pattern}:`, err);
      }
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
    const token = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;

    let acquired = false;

    if (!this.isRedisReady()) {
      acquired = true; // Fallback to memory execution if redis is unavailable
    } else {
      try {
        const res = await redis.set(fullLockKey, token, 'EX', ttlSeconds, 'NX');
        acquired = res === 'OK';
      } catch {
        acquired = true; // Fallback to memory execution if redis fails
      }
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
      if (this.isRedisReady()) {
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
  }

  /**
   * ⏱️ دالة مساعدة لحساب وتوثيق زمن تنفيذ أي عملية بدقة الملي ثانية
   */
  public async measureSpeed<T>(actionName: string, fn: () => Promise<T>): Promise<SpeedAuditResult<T>> {
    const start = performance.now();
    try {
      const result = await fn();
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      return { result, durationMs };
    } catch (error) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      console.error(`❌ [SpeedAudit] ${actionName} failed after ${durationMs}ms:`, error);
      throw error;
    }
  }

  /**
   * ⚡ L1 RAM Micro-Cache لجلسات المستخدم وصلاحياته (< 0.01ms) بنمط SWR
   * يخزن بيانات وسياق المستخدم في الذاكرة المباشرة بعمر زمني افتراضي 60 ثانية
   */
  public async rememberUserContext<T>(
    userId: bigint | string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 60
  ): Promise<T> {
    const key = `user_context:${userId.toString()}`;
    return this.rememberSWR<T>(key, ttlSeconds, fetcher);
  }

  /**
   * 🎯 تطهير فوري لكاش سياق المستخدم في L1 و L2
   */
  public async invalidateUserContext(userId: bigint | string): Promise<void> {
    const key = `user_context:${userId.toString()}`;
    await this.invalidate(key);
  }

  /**
   * ⚡ L1 RAM Micro-Cache لجلسات التشغيل بنمط SWR
   */
  public async rememberSession<T>(
    sessionKey: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 60
  ): Promise<T> {
    const key = `session:${sessionKey}`;
    return this.rememberSWR<T>(key, ttlSeconds, fetcher);
  }

  /**
   * 🎛️ تجميد وتخزين لوحات المفاتيح الساكنة (Memoized Keyboards Singleton)
   * يمنع إعادة البناء المتكرر للوحات الأزرار المتكررة ويخفض استهلاك الـ Garbage Collector للصفر
   */
  public memoizeKeyboard<T>(keyboardKey: string, builder: () => T): T {
    const existing = this.memoizedKeyboards.get(keyboardKey);
    if (existing !== undefined) {
      return existing as T;
    }
    const keyboard = builder();
    this.memoizedKeyboards.set(keyboardKey, keyboard);
    return keyboard;
  }

  /**
   * تطهير لوحات المفاتيح المخزنة مؤقتاً
   */
  public clearMemoizedKeyboards(): void {
    this.memoizedKeyboards.clear();
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
    this.inflightRequests.clear();
    this.memoizedKeyboards.clear();
  }
}

export const fastCache = new FastCacheService();
