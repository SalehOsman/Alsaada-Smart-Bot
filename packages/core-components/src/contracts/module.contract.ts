import type { Bot, Context } from 'grammy';
import type { PrismaClient } from '@alsaada/database';

export interface TypedRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string | string[]): Promise<number>;
  ping(): Promise<string>;
  [method: string]: unknown;
}

export interface TypedTelemetryLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  [method: string]: unknown;
}

export interface ModuleRuntimeContext<C extends Context = Context> {
  prisma: PrismaClient;
  redis: TypedRedisClient | null; // Strictly typed Redis client instance
  api: Bot<C>['api'];
  telemetry?: TypedTelemetryLogger;
  screenFlow?: unknown;
  [key: string]: unknown;
}

export type ModuleStatus = 'active' | 'draft' | 'maintenance';

export interface AppModuleDefinition<C extends Context = Context> {
  name: string;
  titleArabic: string;
  version: string;
  status: ModuleStatus;
  critical?: boolean;
  requiredServices?: string[];
  navigationPatterns?: string[];
  callbackPrefixes: string[];
  init?: (bot: Bot<C>, runtime: ModuleRuntimeContext<C>) => Promise<void>;
  shutdown?: () => Promise<void>;
  registerRoutes: (bot: Bot<C>, runtime: ModuleRuntimeContext<C>) => void;
  onTextInput?: (ctx: C, text: string) => Promise<boolean>;
  onPhotoInput?: (ctx: C, fileId: string) => Promise<boolean>;
  onDocumentInput?: (ctx: C, doc: NonNullable<NonNullable<Context['message']>['document']>) => Promise<boolean>;
  onLocationInput?: (ctx: C, location: NonNullable<NonNullable<Context['message']>['location']>) => Promise<boolean>;
  getPersistentReplyButtons?: (role: string) => string[];
}

export type ModuleFactory<C extends Context = Context> = (
  runtime: ModuleRuntimeContext<C>,
  options?: Record<string, unknown>
) => AppModuleDefinition<C>;

export interface ModuleContractJson {
  moduleName: string;
  displayName?: string;
  version?: string;
  critical?: boolean;
  requiredServices?: string[];
  navigationPatterns?: string[];
  flows?: string[];
  dependencies?: string[];
  owner?: string;
  [key: string]: unknown;
}
