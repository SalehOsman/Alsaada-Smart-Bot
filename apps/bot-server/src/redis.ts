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

const PENDING_ADMIN_EDIT_PREFIX = 'pending:admin_edit:user:';

export interface PendingAdminEdit {
  fieldKey: string;
  messageId: number;
}

export async function setPendingAdminEdit(
  telegramId: bigint,
  fieldKey: string,
  messageId: number
): Promise<void> {
  try {
    const data: PendingAdminEdit = { fieldKey, messageId };
    await redis.set(`${PENDING_ADMIN_EDIT_PREFIX}${telegramId}`, JSON.stringify(data), 'EX', 600);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting pending admin edit:', error);
  }
}

export async function getPendingAdminEdit(telegramId: bigint): Promise<PendingAdminEdit | null> {
  try {
    const raw = await redis.get(`${PENDING_ADMIN_EDIT_PREFIX}${telegramId}`);
    return raw ? (JSON.parse(raw) as PendingAdminEdit) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting pending admin edit:', error);
    return null;
  }
}

export async function clearPendingAdminEdit(telegramId: bigint): Promise<void> {
  try {
    await redis.del(`${PENDING_ADMIN_EDIT_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing pending admin edit:', error);
  }
}

const PENDING_SITE_ACTION_PREFIX = 'pending:site_action:user:';

export interface PendingSiteAction {
  action:
    | 'add_name'
    | 'add_code'
    | 'add_gov'
    | 'edit_name'
    | 'edit_project'
    | 'edit_gov'
    | 'edit_location'
    | 'edit_geofence';
  siteCode?: string;
  draft?: {
    name?: string;
    code?: string;
    governorateCode?: string;
  };
  messageId: number;
}

export async function setPendingSiteAction(
  telegramId: bigint,
  data: PendingSiteAction
): Promise<void> {
  try {
    await redis.set(`${PENDING_SITE_ACTION_PREFIX}${telegramId}`, JSON.stringify(data), 'EX', 600);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting pending site action:', error);
  }
}

export async function getPendingSiteAction(telegramId: bigint): Promise<PendingSiteAction | null> {
  try {
    const raw = await redis.get(`${PENDING_SITE_ACTION_PREFIX}${telegramId}`);
    return raw ? (JSON.parse(raw) as PendingSiteAction) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting pending site action:', error);
    return null;
  }
}

export async function clearPendingSiteAction(telegramId: bigint): Promise<void> {
  try {
    await redis.del(`${PENDING_SITE_ACTION_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing pending site action:', error);
  }
}

const PENDING_JOB_MATRIX_ACTION_PREFIX = 'pending:job_matrix_action:user:';

export interface PendingJobMatrixAction {
  action:
    | 'upload_excel'
    | 'add_dept_name'
    | 'add_dept_code'
    | 'edit_dept_name'
    | 'edit_dept_code'
    | 'add_job_name'
    | 'add_job_code'
    | 'add_job_base_salary'
    | 'add_job_additional_salary'
    | 'add_job_work_days'
    | 'add_job_rest_days'
    | 'add_job_min_headcount'
    | 'edit_job_name'
    | 'edit_job_code'
    | 'edit_job_base_salary'
    | 'edit_job_additional_salary'
    | 'edit_job_work_days'
    | 'edit_job_rest_days'
    | 'edit_job_cycle_policy'
    | 'edit_job_cycle_custom_date'
    | 'edit_job_min_headcount';
  deptCode?: string;
  jobCode?: string;
  draft?: {
    deptCode?: string;
    deptName?: string;
    jobCode?: string;
    jobTitle?: string;
    baseSalary?: number;
    additionalSalary?: number;
    workDays?: number;
    restDays?: number;
    minHeadcount?: number;
  };
  messageId?: number;
}

export async function setPendingJobMatrixAction(
  telegramId: bigint,
  data: PendingJobMatrixAction
): Promise<void> {
  try {
    await redis.set(`${PENDING_JOB_MATRIX_ACTION_PREFIX}${telegramId}`, JSON.stringify(data), 'EX', 600);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting pending job matrix action:', error);
  }
}

export async function getPendingJobMatrixAction(telegramId: bigint): Promise<PendingJobMatrixAction | null> {
  try {
    const raw = await redis.get(`${PENDING_JOB_MATRIX_ACTION_PREFIX}${telegramId}`);
    return raw ? (JSON.parse(raw) as PendingJobMatrixAction) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting pending job matrix action:', error);
    return null;
  }
}

export async function clearPendingJobMatrixAction(telegramId: bigint): Promise<void> {
  try {
    await redis.del(`${PENDING_JOB_MATRIX_ACTION_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing pending job matrix action:', error);
  }
}



