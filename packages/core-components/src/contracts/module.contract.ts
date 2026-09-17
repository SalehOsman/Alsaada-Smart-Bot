import type { Bot, Context } from 'grammy';
import type { PrismaClient } from '@alsaada/database';

export interface ModuleRuntimeContext<C extends Context = Context> {
  prisma: PrismaClient;
  redis: any; // Redis client instance with status checking
  api: Bot<C>['api'];
  telemetry?: any;
  screenFlow?: any;
}

export type ModuleStatus = 'active' | 'draft' | 'maintenance';

export interface AppModuleDefinition<C extends Context = Context> {
  name: string;
  titleArabic: string;
  version: string;
  status: ModuleStatus;
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
  runtime: ModuleRuntimeContext<C>
) => AppModuleDefinition<C>;
