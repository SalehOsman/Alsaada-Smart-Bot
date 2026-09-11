import { describe, it, expect } from 'vitest';
import { validateChatId, validateSiteId } from '../flow.validators.js';

describe('Flow 00.11: Data & Validation Spec', () => {
  it('validates chat IDs correctly', () => {
    expect(validateChatId('-1001234567890')).toBe(true);
    expect(validateChatId('123456789')).toBe(true);
    expect(validateChatId('invalid-chat-id')).toBe(false);
  });

  it('validates site IDs correctly', () => {
    expect(validateSiteId('site-qna-123')).toBe(true);
    expect(validateSiteId('ab')).toBe(false);
  });
});
