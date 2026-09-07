import { describe, it, expect } from 'vitest';
import { resolveTopicId, type ForumTopicConfig } from '../src/index.js';

describe('MultiChannel Topic Router', () => {
  const config: ForumTopicConfig = {
    canteenTopicId: 101,
    advancesTopicId: 102,
    logisticsTopicId: 103,
    fuelsTopicId: 104,
    custodyTopicId: 105,
    workforceTopicId: 106,
    generalTopicId: 1,
  };

  it('routes to specific category topic correctly', () => {
    expect(resolveTopicId('CANTEEN', config)).toBe(101);
    expect(resolveTopicId('ADVANCES', config)).toBe(102);
    expect(resolveTopicId('LOGISTICS', config)).toBe(103);
    expect(resolveTopicId('FUELS', config)).toBe(104);
    expect(resolveTopicId('CUSTODY', config)).toBe(105);
    expect(resolveTopicId('WORKFORCE', config)).toBe(106);
  });

  it('falls back to general topic when specific topic is undefined', () => {
    const sparseConfig: ForumTopicConfig = { generalTopicId: 999 };
    expect(resolveTopicId('CANTEEN', sparseConfig)).toBe(999);
    expect(resolveTopicId('GENERAL', sparseConfig)).toBe(999);
  });
});
