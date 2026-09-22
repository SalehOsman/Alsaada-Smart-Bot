import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveTopicId, type ForumTopicConfig } from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('MultiChannel Topic Router', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const config: ForumTopicConfig = {
    canteenTopicId: 101,
    advancesTopicId: 102,
    logisticsTopicId: 103,
    fuelsTopicId: 104,
    custodyTopicId: 105,
    workforceTopicId: 106,
    hqSiteClosuresTopicId: 107,
    hqFinancialDigestsTopicId: 108,
    hqLogisticsFuelTopicId: 109,
    hqExecutiveDecreesTopicId: 110,
    generalTopicId: 1,
  };

  it('1. routes to specific category topic correctly', () => {
    // Arrange
    const categories = [
      { cat: 'CANTEEN' as const, expected: 101 },
      { cat: 'ADVANCES' as const, expected: 102 },
      { cat: 'LOGISTICS' as const, expected: 103 },
      { cat: 'FUELS' as const, expected: 104 },
      { cat: 'CUSTODY' as const, expected: 105 },
      { cat: 'WORKFORCE' as const, expected: 106 },
      { cat: 'HQ_SITE_CLOSURES' as const, expected: 107 },
      { cat: 'HQ_FINANCIAL_DIGESTS' as const, expected: 108 },
      { cat: 'HQ_LOGISTICS_FUEL' as const, expected: 109 },
      { cat: 'HQ_EXECUTIVE_DECREES' as const, expected: 110 },
    ];

    // Act
    const results = categories.map(({ cat }) => resolveTopicId(cat, config));

    // Assert
    categories.forEach(({ expected }, index) => {
      expect(results[index]).toBe(expected);
      expect(results[index]).not.toBe(config.generalTopicId);
    });
  });

  it('2. falls back to general topic when specific topic is undefined', () => {
    // Arrange
    const sparseConfig: ForumTopicConfig = { generalTopicId: 999 };

    // Act
    const resCanteen = resolveTopicId('CANTEEN', sparseConfig);
    const resGeneral = resolveTopicId('GENERAL', sparseConfig);
    const resDecrees = resolveTopicId('HQ_EXECUTIVE_DECREES', sparseConfig);

    // Assert
    expect(resCanteen).toBe(999);
    expect(resGeneral).toBe(999);
    expect(resDecrees).toBe(999);
    expect(resCanteen).toBeDefined();
  });

  it('3. returns undefined when neither specific category nor general fallback is configured', () => {
    // Arrange
    const emptyConfig: ForumTopicConfig = {};

    // Act
    const resCanteen = resolveTopicId('CANTEEN', emptyConfig);
    const resAdvances = resolveTopicId('ADVANCES', emptyConfig);
    const resGeneral = resolveTopicId('GENERAL', emptyConfig);

    // Assert
    expect(resCanteen).toBeUndefined();
    expect(resAdvances).toBeUndefined();
    expect(resGeneral).toBeUndefined();
    expect(resCanteen).not.toBe(1);
  });
});
