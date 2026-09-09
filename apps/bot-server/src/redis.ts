import { Redis } from 'ioredis';
import { config } from './config/env.js';

/**
 * Singleton Redis client connection for Al-Saada Enterprise Bot
 */
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  lazyConnect: false,
  enableReadyCheck: true,
  enableOfflineQueue: false,
  connectTimeout: 1000,
  commandTimeout: 1000,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 150, 1000);
  },
});

redis.on('connect', () => {
  console.log('✅ [REDIS] Connected successfully to Enterprise Redis Cache');
});

redis.on('error', (err) => {
  // Non-blocking warning: in-memory fallback is active
});

const memoryFallbackStore = new Map<string, { val: string; exp: number }>();

function memGet(key: string): string | null {
  const entry = memoryFallbackStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    memoryFallbackStore.delete(key);
    return null;
  }
  return entry.val;
}

function memSet(key: string, val: string, ttlSeconds: number): void {
  memoryFallbackStore.set(key, { val, exp: Date.now() + ttlSeconds * 1000 });
}

function memDel(key: string): void {
  memoryFallbackStore.delete(key);
}

export async function safeRedisGet(key: string): Promise<string | null> {
  if (redis.status === 'ready') {
    try {
      const val = await redis.get(key);
      if (val !== null) return val;
    } catch {}
  }
  return memGet(key);
}

export async function safeRedisSet(key: string, val: string, ttlSeconds: number): Promise<void> {
  memSet(key, val, ttlSeconds);
  if (redis.status === 'ready') {
    try {
      await redis.set(key, val, 'EX', ttlSeconds);
    } catch {}
  }
}

export async function safeRedisDel(key: string): Promise<void> {
  memDel(key);
  if (redis.status === 'ready') {
    try {
      await redis.del(key);
    } catch {}
  }
}

const IMPERSONATE_PREFIX = 'impersonate:user:';

/**
 * Get the actively impersonated role for a given user (if any)
 */
export async function getImpersonatedRole(telegramId: bigint): Promise<string | null> {
  try {
    return await safeRedisGet(`${IMPERSONATE_PREFIX}${telegramId}`);
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
    await safeRedisSet(`${IMPERSONATE_PREFIX}${telegramId}`, role, 86400);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting impersonated role:', error);
  }
}

/**
 * Clear the impersonated role, returning the user to their true identity
 */
export async function clearImpersonatedRole(telegramId: bigint): Promise<void> {
  try {
    await safeRedisDel(`${IMPERSONATE_PREFIX}${telegramId}`);
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
    await safeRedisSet(`${PENDING_EDIT_PREFIX}${telegramId}`, JSON.stringify(data), 600);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting pending company edit:', error);
  }
}

/**
 * Get the pending company profile edit state for a user
 */
export async function getPendingCompanyEdit(telegramId: bigint): Promise<PendingCompanyEdit | null> {
  try {
    const raw = await safeRedisGet(`${PENDING_EDIT_PREFIX}${telegramId}`);
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
    await safeRedisDel(`${PENDING_EDIT_PREFIX}${telegramId}`);
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
    await safeRedisSet(`${PENDING_ADMIN_EDIT_PREFIX}${telegramId}`, JSON.stringify(data), 600);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting pending admin edit:', error);
  }
}

export async function getPendingAdminEdit(telegramId: bigint): Promise<PendingAdminEdit | null> {
  try {
    const raw = await safeRedisGet(`${PENDING_ADMIN_EDIT_PREFIX}${telegramId}`);
    return raw ? (JSON.parse(raw) as PendingAdminEdit) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting pending admin edit:', error);
    return null;
  }
}

export async function clearPendingAdminEdit(telegramId: bigint): Promise<void> {
  try {
    await safeRedisDel(`${PENDING_ADMIN_EDIT_PREFIX}${telegramId}`);
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
    await safeRedisSet(`${PENDING_SITE_ACTION_PREFIX}${telegramId}`, JSON.stringify(data), 600);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting pending site action:', error);
  }
}

export async function getPendingSiteAction(telegramId: bigint): Promise<PendingSiteAction | null> {
  try {
    const raw = await safeRedisGet(`${PENDING_SITE_ACTION_PREFIX}${telegramId}`);
    return raw ? (JSON.parse(raw) as PendingSiteAction) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting pending site action:', error);
    return null;
  }
}

export async function clearPendingSiteAction(telegramId: bigint): Promise<void> {
  try {
    await safeRedisDel(`${PENDING_SITE_ACTION_PREFIX}${telegramId}`);
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
    await safeRedisSet(`${PENDING_JOB_MATRIX_ACTION_PREFIX}${telegramId}`, JSON.stringify(data), 600);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting pending job matrix action:', error);
  }
}

export async function getPendingJobMatrixAction(telegramId: bigint): Promise<PendingJobMatrixAction | null> {
  try {
    const raw = await safeRedisGet(`${PENDING_JOB_MATRIX_ACTION_PREFIX}${telegramId}`);
    return raw ? (JSON.parse(raw) as PendingJobMatrixAction) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting pending job matrix action:', error);
    return null;
  }
}

export async function clearPendingJobMatrixAction(telegramId: bigint): Promise<void> {
  try {
    await safeRedisDel(`${PENDING_JOB_MATRIX_ACTION_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing pending job matrix action:', error);
  }
}

const PENDING_WORKER_WIZARD_PREFIX = 'pending:worker_wizard:user:';
const PENDING_WORKER_EXCEL_PREFIX = 'pending:worker_excel:user:';

export interface PendingWorkerWizardState {
  step: string;
  messageId: number;
  data: {
    fullName?: string;
    nickname?: string;
    phone?: string;
    payoutChoice?: string;
    walletNumber?: string;
    walletType?: string;
    payoutMethod?: string;
    idType?: 'NATIONAL_ID' | 'PASSPORT';
    idNumber?: string;
    nationality?: string;
    birthDateStr?: string;
    age?: number;
    gender?: 'MALE' | 'FEMALE';
    governorateCode?: string;
    governorateNameAr?: string;
    jobTitleId?: string;
    jobTitleName?: string;
    departmentId?: string;
    departmentCode?: string;
    jobCode?: string;
    siteId?: string;
    siteName?: string;
    hireDateStr?: string;
    shiftSystem?: string;
    drivingLicense?: string;
    militaryStatus?: string;
    emergencyPhone?: string;
    previousInsuranceStatus?: string;
    maritalStatus?: string;
    idCardFrontPath?: string;
    idCardBackPath?: string;
    idCardExpiryDateStr?: string;
    legacyCode?: string;
    isManualFallback?: boolean;
    generatedCode?: string;
    baseSalary?: number;
    additionalSalary?: number;
    frontFileId?: string;
    backFileId?: string;
    jobPage?: number;
    address?: string;
  };
}

export async function setPendingWorkerWizard(
  telegramId: bigint,
  state: PendingWorkerWizardState
): Promise<void> {
  try {
    await safeRedisSet(`${PENDING_WORKER_WIZARD_PREFIX}${telegramId}`, JSON.stringify(state), 1800);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting pending worker wizard:', error);
  }
}

export async function getPendingWorkerWizard(
  telegramId: bigint
): Promise<PendingWorkerWizardState | null> {
  try {
    const raw = await safeRedisGet(`${PENDING_WORKER_WIZARD_PREFIX}${telegramId}`);
    return raw ? (JSON.parse(raw) as PendingWorkerWizardState) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting pending worker wizard:', error);
    return null;
  }
}

export async function clearPendingWorkerWizard(telegramId: bigint): Promise<void> {
  try {
    await safeRedisDel(`${PENDING_WORKER_WIZARD_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing pending worker wizard:', error);
  }
}

export async function setPendingWorkerExcelUpload(telegramId: bigint, messageId: number): Promise<void> {
  try {
    await safeRedisSet(`${PENDING_WORKER_EXCEL_PREFIX}${telegramId}`, String(messageId), 600);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting pending worker excel upload:', error);
  }
}

export async function getPendingWorkerExcelUpload(telegramId: bigint): Promise<number | null> {
  try {
    const raw = await safeRedisGet(`${PENDING_WORKER_EXCEL_PREFIX}${telegramId}`);
    return raw ? parseInt(raw, 10) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting pending worker excel upload:', error);
    return null;
  }
}

export async function clearPendingWorkerExcelUpload(telegramId: bigint): Promise<void> {
  try {
    await safeRedisDel(`${PENDING_WORKER_EXCEL_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing pending worker excel upload:', error);
  }
}

const PENDING_WORKER_EDIT_PREFIX = 'pending:worker_edit:user:';

export interface PendingWorkerEditState {
  workerId: string;
  workerCode: string;
  workerName: string;
  category?: string;
  fieldKey?: string;
  fieldName?: string;
  oldValue?: string;
  promptMsgId: number;
  isDocUpload?: boolean;
  docTitle?: string;
  docCategory?: string;
}

export async function setPendingWorkerEdit(telegramId: bigint, state: PendingWorkerEditState): Promise<void> {
  try {
    await safeRedisSet(`${PENDING_WORKER_EDIT_PREFIX}${telegramId}`, JSON.stringify(state), 600);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting pending worker edit:', error);
  }
}

export async function getPendingWorkerEdit(telegramId: bigint): Promise<PendingWorkerEditState | null> {
  try {
    const raw = await safeRedisGet(`${PENDING_WORKER_EDIT_PREFIX}${telegramId}`);
    return raw ? (JSON.parse(raw) as PendingWorkerEditState) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting pending worker edit:', error);
    return null;
  }
}

export async function clearPendingWorkerEdit(telegramId: bigint): Promise<void> {
  try {
    await safeRedisDel(`${PENDING_WORKER_EDIT_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing pending worker edit:', error);
  }
}

const PENDING_WORKER_DIR_SEARCH_PREFIX = 'pending:worker_dir_search:user:';

export async function setPendingWorkerDirSearch(telegramId: bigint, promptMsgId: number): Promise<void> {
  try {
    await safeRedisSet(`${PENDING_WORKER_DIR_SEARCH_PREFIX}${telegramId}`, promptMsgId.toString(), 300);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting worker dir search:', error);
  }
}

export async function getPendingWorkerDirSearch(telegramId: bigint): Promise<number | null> {
  try {
    const raw = await safeRedisGet(`${PENDING_WORKER_DIR_SEARCH_PREFIX}${telegramId}`);
    return raw ? parseInt(raw, 10) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting worker dir search:', error);
    return null;
  }
}

export async function clearPendingWorkerDirSearch(telegramId: bigint): Promise<void> {
  try {
    await safeRedisDel(`${PENDING_WORKER_DIR_SEARCH_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing worker dir search:', error);
  }
}

/**
 * Clean up all pending text wizard and input actions across all domains for a user
 */
export async function clearAllPendingUserActions(telegramId: bigint): Promise<void> {
  await Promise.all([
    clearPendingCompanyEdit(telegramId),
    clearPendingAdminEdit(telegramId),
    clearPendingSiteAction(telegramId),
    clearPendingJobMatrixAction(telegramId),
    clearPendingWorkerWizard(telegramId),
    clearPendingWorkerExcelUpload(telegramId),
    clearPendingWorkerEdit(telegramId),
    clearPendingWorkerDirSearch(telegramId),
  ]);
}

const DUAL_MODE_PREFIX = 'dual_mode:user:';

/**
 * Get whether an admin has toggled their personal worker identity active
 */
export async function getAdminDualMode(telegramId: bigint): Promise<boolean> {
  try {
    const val = await safeRedisGet(`${DUAL_MODE_PREFIX}${telegramId}`);
    return val === 'true';
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting admin dual mode:', error);
    return false;
  }
}

/**
 * Set or clear the admin personal worker identity mode
 */
export async function setAdminDualMode(telegramId: bigint, active: boolean): Promise<void> {
  try {
    if (active) {
      await safeRedisSet(`${DUAL_MODE_PREFIX}${telegramId}`, 'true', 86400);
    } else {
      await safeRedisDel(`${DUAL_MODE_PREFIX}${telegramId}`);
    }
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting admin dual mode:', error);
  }
}

// -------------------------------------------------------------
// 10. Central User Active Screen & Ephemeral Flow Lifecycle
// -------------------------------------------------------------

export interface UserActiveScreenState {
  chatId: number;
  messageId: number;
  flowType: string;
  isCompleted?: boolean;
  updatedAt: number;
}

const ACTIVE_SCREEN_PREFIX = 'user_active_screen:';

export async function setUserActiveScreen(telegramId: bigint, state: UserActiveScreenState): Promise<void> {
  try {
    await safeRedisSet(`${ACTIVE_SCREEN_PREFIX}${telegramId}`, JSON.stringify(state), 86400);
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting user active screen:', error);
  }
}

export async function getUserActiveScreen(telegramId: bigint): Promise<UserActiveScreenState | null> {
  try {
    const raw = await safeRedisGet(`${ACTIVE_SCREEN_PREFIX}${telegramId}`);
    return raw ? (JSON.parse(raw) as UserActiveScreenState) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting user active screen:', error);
    return null;
  }
}

export async function clearUserActiveScreen(telegramId: bigint): Promise<void> {
  try {
    await safeRedisDel(`${ACTIVE_SCREEN_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing user active screen:', error);
  }
}

const PERSISTENT_KEYBOARD_MSG_PREFIX = 'user_persistent_keyboard_msg:';

export interface PersistentKeyboardAnchorState {
  chatId: number;
  messageId: number;
}

export async function setPersistentKeyboardMsg(
  telegramId: bigint,
  chatId: number,
  messageId: number
): Promise<void> {
  try {
    await safeRedisSet(
      `${PERSISTENT_KEYBOARD_MSG_PREFIX}${telegramId}`,
      JSON.stringify({ chatId, messageId }),
      86400 * 30
    );
  } catch (error) {
    console.error('⚠️ [REDIS] Error setting persistent keyboard msg:', error);
  }
}

export async function getPersistentKeyboardMsg(
  telegramId: bigint
): Promise<PersistentKeyboardAnchorState | null> {
  try {
    const raw = await safeRedisGet(`${PERSISTENT_KEYBOARD_MSG_PREFIX}${telegramId}`);
    return raw ? (JSON.parse(raw) as PersistentKeyboardAnchorState) : null;
  } catch (error) {
    console.error('⚠️ [REDIS] Error getting persistent keyboard msg:', error);
    return null;
  }
}

export async function clearPersistentKeyboardMsg(telegramId: bigint): Promise<void> {
  try {
    await safeRedisDel(`${PERSISTENT_KEYBOARD_MSG_PREFIX}${telegramId}`);
  } catch (error) {
    console.error('⚠️ [REDIS] Error clearing persistent keyboard msg:', error);
  }
}


