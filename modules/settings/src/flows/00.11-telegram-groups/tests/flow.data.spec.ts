import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateChatId, validateSiteId } from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.11 Data & Validation Spec — مجموعات تليجرام', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates supergroup and normal telegram chat identifiers', () => {
    // Arrange
    const supergroupId = '-1001234567890';
    const standardId = '123456789';

    // Act
    const supergroupValid = validateChatId(supergroupId);
    const standardValid = validateChatId(standardId);

    // Assert
    expect(supergroupValid).toBe(true);
    expect(standardValid).toBe(true);
  });

  it('rejects malformed and non-numeric chat identifiers', () => {
    // Arrange
    const malformedId = 'invalid-chat-id';

    // Act
    const res = validateChatId(malformedId);

    // Assert
    expect(res).toBe(false);
  });

  it('validates site ID format conforming to site code rules', () => {
    // Arrange
    const validSiteId = 'site-qna-123';

    // Act
    const res = validateSiteId(validSiteId);

    // Assert
    expect(res).toBe(true);
  });

  it('rejects overly short site ID values', () => {
    // Arrange
    const shortId = 'ab';

    // Act
    const res = validateSiteId(shortId);

    // Assert
    expect(res).toBe(false);
  });
});
