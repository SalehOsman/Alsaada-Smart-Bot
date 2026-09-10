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

export interface SettingsModuleContext extends Context {
  effectiveRole?: UserRole;
  isRealSuperAdmin?: boolean;
  isImpersonating?: boolean;
  assignedSiteId?: string | null;
  adminSites?: string[];
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
  redis?: Redis | null;
  encryptionKey?: string;
}
