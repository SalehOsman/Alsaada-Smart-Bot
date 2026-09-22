/**
 * TypeSafe AI System One — LLM Guardrails Engine
 * 
 * Implements strict input sanitization, hallucination suppression,
 * RBAC role boundaries, and sensitive data redaction per TypeSafe Guardrails cookbook.
 * 
 * Reference: https://docs.typesafe.ai/cookbooks/llm_guardrails
 */

import type { CatalogFlowEntry, MonorepoCatalog } from '../modules/catalog.js';

export interface GuardrailValidationResult {
  valid: boolean;
  sanitized: string;
  violations: string[];
}

export interface FlowSuggestionValidationResult {
  accepted: boolean;
  reason?: string;
  targetFlow?: CatalogFlowEntry;
}

export const ADVERSARIAL_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /system\s+(?:prompt|override|bypass)/i,
  /roleplay\s+as\s+(?:unrestricted|super_admin|root)/i,
  /grant\s+(?:role|permission|privilege)\s+super_admin/i,
  /DAN\s+mode/i,
  /\bexec\s*\(/i,
  /\beval\s*\(/i,
  /__proto__/i,
  /constructor\s*\[\s*['"]prototype['"]\s*\]/i,
];

export const NATIONAL_ID_REGEX = /\b[23]\d{13}\b/g;
export const SALARY_AMOUNT_REGEX = /(?:^|\s)\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:جنية|جنيه|EGP|LE)(?=\s|$|[.,،])/gi;

export class TypeSafeLLMGuardrailEngine {
  constructor(private readonly catalog: MonorepoCatalog) {}

  /**
   * Sanitizes and validates user input for prompt injection and out-of-bounds payloads.
   */
  validateUserInput(input: string): GuardrailValidationResult {
    const violations: string[] = [];

    // Length check
    if (!input || input.trim().length === 0) {
      return { valid: true, sanitized: '', violations: [] };
    }

    if (input.length > 2000) {
      violations.push('Input exceeds maximum allowed prompt length of 2000 characters.');
    }

    // Check injection patterns
    for (const pattern of ADVERSARIAL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        violations.push(`Adversarial prompt injection pattern detected: ${pattern.source}`);
      }
    }

    // Strip control characters
    const sanitized = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

    return {
      valid: violations.length === 0,
      sanitized,
      violations,
    };
  }

  /**
   * Validates an LLM suggestion against the physical monorepo catalog.
   * Prevents hallucinated flow IDs and unauthorized execution.
   */
  validateFlowSuggestion(
    suggestion: { flowId: string; subAction?: string; confidence?: number },
    userRole = 'WORKER'
  ): FlowSuggestionValidationResult {
    const { flowId, confidence = 1.0 } = suggestion;

    // Minimum confidence threshold
    if (confidence < 0.65) {
      return {
        accepted: false,
        reason: `Confidence score ${confidence} below threshold 0.65.`,
      };
    }

    // Find in physical catalog
    const targetFlow = this.catalog.flows.find((f) => f.id === flowId);
    if (!targetFlow) {
      return {
        accepted: false,
        reason: `Hallucinated Flow ID: "${flowId}" is not registered in the Monorepo Catalog.`,
      };
    }

    // Status check
    if (targetFlow.status !== 'active') {
      return {
        accepted: false,
        reason: `Flow "${flowId}" status is "${targetFlow.status}", not active.`,
        targetFlow,
      };
    }

    // Role boundary check
    if (!targetFlow.allowedRoles.includes(userRole)) {
      return {
        accepted: false,
        reason: `Role privilege boundary: User role "${userRole}" cannot access flow "${flowId}". Required roles: [${targetFlow.allowedRoles.join(', ')}].`,
        targetFlow,
      };
    }

    return {
      accepted: true,
      targetFlow,
    };
  }

  /**
   * Redacts sensitive personal and financial data from prompt contexts.
   */
  redactSensitiveData(text: string): string {
    return text
      .replace(NATIONAL_ID_REGEX, '[REDACTED_NATIONAL_ID]')
      .replace(SALARY_AMOUNT_REGEX, (m) => (m.startsWith(' ') ? ' [REDACTED_SALARY]' : '[REDACTED_SALARY]'));
  }
}
