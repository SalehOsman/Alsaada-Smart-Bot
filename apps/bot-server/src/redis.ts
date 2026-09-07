import { Redis } from 'ioredis';
import { config } from './config/env.js';

/**
 * Singleton Redis client connection for Al-Saada Enterprise Bot
 */
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  enableReadyCheck: true,
});

redis.on('connect', () => {
  console.log('✅ [REDIS] Connected successfully to Enterprise Redis Cache');
});

redis.on('error', (err) => {
  console.error('❌ [REDIS ERROR] Connection failed:', err.message);
});

const IMPERSONATE_PREFIX = 'impersonate:user:';

/**
 * Get the actively impersonated role for a given user (if any)
 */
export async function getImpersonatedRole(telegramId: bigint): Promise<string | null> {
  try {
    return await redis.get(`${IMPERSONATE_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting impersonated role:', error);
    return null;
  }
}

/**
 * Set an active impersonated role for a user
 */
export async function setImpersonatedRole(telegramId: bigint, role: string): Promise<void> {
  try {
    // Retain for 24 hours
    await redis.set(`${IMPERSONATE_PREFIX}${telegramId}`, role, 'EX', 86400);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting impersonated role:', error);
  }
}

/**
 * Clear the impersonated role, returning the user to their true identity
 */
export async function clearImpersonatedRole(telegramId: bigint): Promise<void> {
  try {
    await redis.del(`${IMPERSONATE_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing impersonated role:', error);
  }
}

const PENDING_EDIT_PREFIX = 'pending:company_edit:user:';

export interface PendingCompanyEdit {
  fieldKey: string;
  messageId: number;
}

/**
 * Set a pending company profile edit state for a user
 */
export async function setPendingCompanyEdit(
  telegramId: bigint,
  fieldKey: string,
  messageId: number
): Promise<void> {
  try {
    const data: PendingCompanyEdit = { fieldKey, messageId };
    await redis.set(`${PENDING_EDIT_PREFIX}${telegramId}`, JSON.stringify(data), 'EX', 600);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting pending company edit:', error);
  }
}

/**
 * Get the pending company profile edit state for a user
 */
export async function getPendingCompanyEdit(telegramId: bigint): Promise<PendingCompanyEdit | null> {
  try {
    const raw = await redis.get(`${PENDING_EDIT_PREFIX}${telegramId}`);
    return raw ? (JSON.parse(raw) as PendingCompanyEdit) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting pending company edit:', error);
    return null;
  }
}

/**
 * Clear the pending company profile edit state
 */
export async function clearPendingCompanyEdit(telegramId: bigint): Promise<void> {
  try {
    await redis.del(`${PENDING_EDIT_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing pending company edit:', error);
  }
}

