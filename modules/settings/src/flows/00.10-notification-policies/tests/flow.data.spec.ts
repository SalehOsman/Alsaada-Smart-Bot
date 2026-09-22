import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FEATURE_POLICIES_CATALOG } from '@alsaada/core-components';
import { validateFeatureKey, validatePolicyScope } from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.10 Data & Validation Spec — سياسات الإشعارات', () => {
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

  it('validates recognized policy scopes successfully', () => {
    // Arrange
    const validSite = 'site';
    const validHq = 'hq';

    // Act
    const siteResult = validatePolicyScope(validSite);
    const hqResult = validatePolicyScope(validHq);

    // Assert
    expect(siteResult).toBe(true);
    expect(hqResult).toBe(true);
  });

  it('rejects unrecognized policy scopes with negative verdict', () => {
    // Arrange
    const invalidScope = 'invalid-scope-name';

    // Act
    const res = validatePolicyScope(invalidScope);

    // Assert
    expect(res).toBe(false);
  });

  it('validates known feature keys against the system catalog', () => {
    // Arrange
    const knownKey = 'canteen:cigarettes';

    // Act
    const res = validateFeatureKey(knownKey);

    // Assert
    expect(res).toBe(true);
    expect(FEATURE_POLICIES_CATALOG.length).toBeGreaterThan(10);
  });

  it('rejects unknown or malformed feature keys', () => {
    // Arrange
    const unknownKey = 'unknown:custom_action_key';

    // Act
    const res = validateFeatureKey(unknownKey);

    // Assert
    expect(res).toBe(false);
  });
});
