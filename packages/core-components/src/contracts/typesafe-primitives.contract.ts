/**
 * TypeSafe AI Primitives & Nominal Branded Types Contract
 * 
 * Single Source of Truth for System One (Jev-1.13) evaluation primitives,
 * confidence scoring thresholds, and strict nominal ID typing.
 */

// ============================================================================
// 1. Nominal Branded Types (Zero Primitive Obsession)
// ============================================================================

declare const __brand: unique symbol;
export type Brand<K, T> = K & { readonly [__brand]: T };

export type ModuleId = Brand<string, 'ModuleId'>;
export type FlowId = Brand<string, 'FlowId'>;
export type CapabilityId = Brand<string, 'CapabilityId'>;

const MODULE_ID_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const FLOW_ID_REGEX = /^\d{2}\.\d+(\.[A-Z0-9]+)?$/;
const CAPABILITY_ID_REGEX = /^[a-z0-9-]+:[a-z0-9-]+$/;

export function asModuleId(raw: string): ModuleId {
  const trimmed = raw.trim();
  if (!MODULE_ID_REGEX.test(trimmed)) {
    throw new Error(`Invalid ModuleId "${raw}". Must be lowercase alphanumeric with hyphens (e.g. "workforce", "sample-domain").`);
  }
  return trimmed as ModuleId;
}

export function asFlowId(raw: string): FlowId {
  const trimmed = raw.trim();
  if (!FLOW_ID_REGEX.test(trimmed)) {
    throw new Error(`Invalid FlowId "${raw}". Must conform to ##.##[.EXT] pattern (e.g. "01.1", "01.2.D", "89.1").`);
  }
  return trimmed as FlowId;
}

export function asCapabilityId(raw: string): CapabilityId {
  const trimmed = raw.trim();
  if (!CAPABILITY_ID_REGEX.test(trimmed)) {
    throw new Error(`Invalid CapabilityId "${raw}". Must conform to "domain:feature" format (e.g. "storage:attachment", "ledger:double-entry").`);
  }
  return trimmed as CapabilityId;
}

// ============================================================================
// 2. TypeSafe AI System One Question Primitives
// ============================================================================

export type TypeSafeQuestionType = 'choice' | 'noul' | 'score';

export interface BaseQuestionConfig {
  id: string;
  question: string;
  contextPrompt?: string | undefined;
  defaultFallback?: unknown;
}

export interface ChoiceQuestionConfig<T extends string = string> extends BaseQuestionConfig {
  type: 'choice';
  options: readonly T[];
  confidenceThreshold?: number | undefined; // 0.0 to 1.0
  defaultFallback?: T | undefined;
}

export interface NoulQuestionConfig extends BaseQuestionConfig {
  type: 'noul'; // Boolean / ternary safe evaluation
  confidenceThreshold?: number | undefined; // 0.0 to 1.0
  defaultFallback?: boolean | null | undefined;
}

export interface ScoreQuestionConfig extends BaseQuestionConfig {
  type: 'score'; // Continuous numerical evaluation (0 to 1)
  minAcceptableScore?: number | undefined;
  maxScore?: number | undefined;
  defaultFallback?: number | undefined;
}

export type TypeSafeQuestionConfig =
  | ChoiceQuestionConfig<string>
  | NoulQuestionConfig
  | ScoreQuestionConfig;

// ============================================================================
// 3. Evaluation & Judgment Receipts
// ============================================================================

export interface TypeSafeJudgment<T = unknown> {
  questionId: string;
  questionType: TypeSafeQuestionType;
  answer: T;
  confidence: number; // 0.0 to 1.0
  latencyMs: number;
  source: 'system_one' | 'deterministic_fallback';
  model?: string | undefined;
  explanation?: string | undefined;
}

export function assertNever(value: never, errorMessage = 'Unexpected unreachable branch encountered'): never {
  throw new Error(`${errorMessage}: ${JSON.stringify(value)}`);
}
