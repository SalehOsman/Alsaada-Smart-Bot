import type { SandboxPingInputDTO } from './types.js';

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

export const SandboxPingInputSchema = {
  safeParse(input: unknown): ValidationResult<SandboxPingInputDTO> {
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

    if (typeof obj.actorTelegramId !== 'string' || obj.actorTelegramId.length < 1) {
      issues.push({ message: 'actorTelegramId must be non-empty', path: ['actorTelegramId'] });
    }

    if (obj.notes !== undefined && (typeof obj.notes !== 'string' || obj.notes.length > 500)) {
      issues.push({ message: 'notes cannot exceed 500 characters', path: ['notes'] });
    }

    if (issues.length > 0) {
      return { success: false, error: { issues } };
    }

    return {
      success: true,
      data: {
        idempotencyKey: obj.idempotencyKey as string,
        actorTelegramId: obj.actorTelegramId as string,
        notes: obj.notes as string | undefined,
      },
    };
  },
};

export function validateSandboxPingInput(input: unknown): ValidationResult<SandboxPingInputDTO> {
  return SandboxPingInputSchema.safeParse(input);
}
