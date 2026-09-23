import type { SandboxCalcInputDTO, CalcOperationType } from './types.js';

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  error: {
    issues: Array<{ message: string; path: string[] }>;
  };
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const VALID_OPERATIONS = new Set<CalcOperationType>([
  'ADD',
  'SUBTRACT',
  'MULTIPLY',
  'DIVIDE',
  'NET_PAY',
  'MASK_RECORD',
]);

export const SandboxCalcInputSchema = {
  safeParse(input: unknown): ValidationResult<SandboxCalcInputDTO> {
    if (!input || typeof input !== 'object') {
      return {
        success: false,
        error: { issues: [{ message: 'Input must be an object', path: [] }] },
      };
    }

    const obj = input as Record<string, unknown>;
    const issues: Array<{ message: string; path: string[] }> = [];

    if (typeof obj.idempotencyKey !== 'string' || obj.idempotencyKey.length < 8 || obj.idempotencyKey.length > 64) {
      issues.push({ message: 'idempotencyKey must be 8-64 characters', path: ['idempotencyKey'] });
    }

    if (typeof obj.actorTelegramId !== 'string' || obj.actorTelegramId.trim().length < 1) {
      issues.push({ message: 'actorTelegramId must be non-empty', path: ['actorTelegramId'] });
    }

    if (obj.notes !== undefined && (typeof obj.notes !== 'string' || obj.notes.length > 500)) {
      issues.push({ message: 'notes cannot exceed 500 characters', path: ['notes'] });
    }

    if (obj.operation !== undefined) {
      if (typeof obj.operation !== 'string' || !VALID_OPERATIONS.has(obj.operation as CalcOperationType)) {
        issues.push({
          message: `operation must be one of: ${Array.from(VALID_OPERATIONS).join(', ')}`,
          path: ['operation'],
        });
      }
    }

    if (obj.operands !== undefined && (typeof obj.operands !== 'object' || obj.operands === null)) {
      issues.push({ message: 'operands must be an object', path: ['operands'] });
    }

    if (issues.length > 0) {
      return { success: false, error: { issues } };
    }

    return {
      success: true,
      data: {
        idempotencyKey: obj.idempotencyKey as string,
        actorTelegramId: obj.actorTelegramId as string,
        operation: (obj.operation as CalcOperationType) ?? 'NET_PAY',
        operands: obj.operands as SandboxCalcInputDTO['operands'],
        actorRole: typeof obj.actorRole === 'string' ? obj.actorRole : 'WORKER',
        notes: obj.notes as string | undefined,
      },
    };
  },
};

export function validateSandboxCalcInput(input: unknown): ValidationResult<SandboxCalcInputDTO> {
  return SandboxCalcInputSchema.safeParse(input);
}
