import type { Context } from 'grammy';
import type { PrismaClient } from '@alsaada/database';
import type { Redis } from 'ioredis';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'GENERAL_ADMIN'
  | 'FIELD_ADMIN'
  | 'ACCOUNTANT'
  | 'EXECUTIVE'
  | 'WORKER'
  | 'SUPPLIER'
  | 'GUEST';

export interface ImpersonatedEntityInfo {
  type: 'WORKER' | 'SUPPLIER' | 'SITE';
  id: string;
  name: string;
  code?: string | undefined;
  siteId?: string | undefined;
  siteName?: string | undefined;
}

export interface SettingsModuleContext extends Context {
  effectiveRole?: UserRole;
  isRealSuperAdmin?: boolean;
  isImpersonating?: boolean;
  assignedSiteId?: string | null;
  adminSites?: string[];
  workerId?: string | undefined;
  workerCode?: string | undefined;
  impersonatedEntity?: ImpersonatedEntityInfo | undefined;
  dbUser?: {
    id: string;
    telegramId: bigint;
    role: string;
    fullName?: string | null;
    phone?: string | null;
  } | null;
}

export interface SettingsModuleOptions {
  prisma: PrismaClient;
  redis?: Redis | null | undefined;
  encryptionKey?: string | undefined;
  onImpersonationChange?: ((telegramId: bigint, targetRole?: string) => Promise<void>) | undefined;
  screenFlow?: {
    ensurePersistentKeyboard: (ctx: SettingsModuleContext, customText?: string, forceRefresh?: boolean) => Promise<void>;
  } | undefined;
}

