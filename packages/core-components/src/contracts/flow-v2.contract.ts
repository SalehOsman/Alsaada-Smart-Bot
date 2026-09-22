/**
 * Sovereign Flow V2 Contract
 * 
 * Defines standard vertical slice metadata, Telegram mobile budget constraints,
 * idempotent execution rules, and TypeSafe AI System One question integration.
 */

import {
  asFlowId,
  asModuleId,
  type FlowId,
  type ModuleId,
  type TypeSafeQuestionConfig,
} from './typesafe-primitives.contract.js';

export interface TelegramErgonomicsBudget {
  readonly maxUrlBytes: 512;
  readonly maxCallbackBytes: 64;
  readonly maxButtonChars: 16;
  readonly maxKeyboardRows: 7;
  readonly maxButtonsPerRow: 3;
}

export const TELEGRAM_BUDGET: TelegramErgonomicsBudget = {
  maxUrlBytes: 512,
  maxCallbackBytes: 64,
  maxButtonChars: 16,
  maxKeyboardRows: 7,
  maxButtonsPerRow: 3,
} as const;

export interface FlowMenuButtonV2 {
  labelArabic: string;
  callbackData: string;
  subSection: string;
  order: number;
  requiresSuperAdmin?: boolean | undefined;
}

export type FlowStatusV2 = 'draft' | 'active' | 'disabled';

export interface FlowDefinitionV2 {
  schemaVersion: '2.0.0';
  id: FlowId;
  module: ModuleId;
  slug: string;
  titleArabic: string;
  descriptionArabic: string;
  category: string;
  status: FlowStatusV2;
  allowedRoles: readonly string[];
  menuButton?: FlowMenuButtonV2 | undefined;
  telegramBudget: TelegramErgonomicsBudget;
  idempotencyRequired: boolean;
  typesafeQuestions?: readonly TypeSafeQuestionConfig[] | undefined;
  entrypointFiles: {
    contract: string;
    handler: string;
    service: string;
    keyboard: string;
    types: string;
    validators: string;
    messages: string;
    telemetry: string;
    docs: string;
  };
}

export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
  flow?: FlowDefinitionV2;
}

export function validateFlowDefinitionV2(raw: unknown): FlowValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Flow contract must be a valid JSON object.'] };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.schemaVersion !== '2.0.0') {
    errors.push(`Invalid schemaVersion "${String(obj.schemaVersion)}". Expected "2.0.0".`);
  }

  let flowId: FlowId | undefined;
  try {
    flowId = asFlowId(String(obj.id ?? ''));
  } catch (err) {
    errors.push(String(err));
  }

  let moduleId: ModuleId | undefined;
  try {
    moduleId = asModuleId(String(obj.module ?? ''));
  } catch (err) {
    errors.push(String(err));
  }

  if (typeof obj.slug !== 'string' || !/^[a-z0-9-]+$/.test(obj.slug)) {
    errors.push(`Invalid or missing slug "${String(obj.slug)}". Must be lowercase alphanumeric with hyphens.`);
  }

  if (typeof obj.titleArabic !== 'string' || obj.titleArabic.trim().length === 0) {
    errors.push('Missing required titleArabic.');
  }

  if (typeof obj.descriptionArabic !== 'string' || obj.descriptionArabic.trim().length === 0) {
    errors.push('Missing required descriptionArabic.');
  }

  const validStatuses: FlowStatusV2[] = ['draft', 'active', 'disabled'];
  if (!validStatuses.includes(obj.status as FlowStatusV2)) {
    errors.push(`Invalid status "${String(obj.status)}". Allowed: ${validStatuses.join(', ')}.`);
  }

  if (!Array.isArray(obj.allowedRoles) || obj.allowedRoles.length === 0) {
    errors.push('allowedRoles must be a non-empty array of role strings.');
  }

  if (obj.menuButton && typeof obj.menuButton === 'object') {
    const btn = obj.menuButton as Record<string, unknown>;
    if (typeof btn.labelArabic !== 'string' || btn.labelArabic.length > TELEGRAM_BUDGET.maxButtonChars) {
      errors.push(`menuButton.labelArabic exceeds maximum ${TELEGRAM_BUDGET.maxButtonChars} characters.`);
    }
    if (
      typeof btn.callbackData !== 'string' ||
      Buffer.byteLength(btn.callbackData, 'utf8') > TELEGRAM_BUDGET.maxCallbackBytes
    ) {
      errors.push(`menuButton.callbackData exceeds maximum ${TELEGRAM_BUDGET.maxCallbackBytes} bytes.`);
    }
  }

  if (errors.length > 0 || !flowId || !moduleId) {
    return { valid: false, errors };
  }

  const flow: FlowDefinitionV2 = {
    schemaVersion: '2.0.0',
    id: flowId,
    module: moduleId,
    slug: String(obj.slug),
    titleArabic: String(obj.titleArabic),
    descriptionArabic: String(obj.descriptionArabic),
    category: String(obj.category ?? 'general'),
    status: obj.status as FlowStatusV2,
    allowedRoles: obj.allowedRoles as string[],
    menuButton: obj.menuButton as FlowMenuButtonV2 | undefined,
    telegramBudget: TELEGRAM_BUDGET,
    idempotencyRequired: Boolean(obj.idempotencyRequired ?? true),
    typesafeQuestions: (obj.typesafeQuestions as TypeSafeQuestionConfig[]) ?? [],
    entrypointFiles: (obj.entrypointFiles as FlowDefinitionV2['entrypointFiles']) ?? {
      contract: 'flow.contract.json',
      handler: 'flow.handler.ts',
      service: 'flow.service.ts',
      keyboard: 'flow.keyboard.ts',
      types: 'flow.types.ts',
      validators: 'flow.validators.ts',
      messages: 'flow.messages.ts',
      telemetry: 'flow.telemetry.ts',
      docs: 'flow.docs.md',
    },
  };

  return { valid: true, errors: [], flow };
}
