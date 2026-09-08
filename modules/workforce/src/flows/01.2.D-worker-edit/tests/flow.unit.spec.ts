import { describe, it, expect } from 'vitest';
import {
  FIELD_KEY_SHORT_MAP,
  FIELD_TO_SHORT_MAP,
  FIELD_LABELS,
  validateFieldValue,
} from '../flow.validators.js';
import type { EditableWorkerField } from '../flow.types.js';

describe('Flow 01.2.D Unit Tests — Worker Edit Governance & Short Mappings', () => {
  it('should bidirectionally map all editable fields without loss', () => {
    const fields = Object.keys(FIELD_LABELS) as EditableWorkerField[];

    for (const f of fields) {
      const short = FIELD_TO_SHORT_MAP[f];
      expect(short).toBeDefined();
      expect(short.length).toBeLessThanOrEqual(7);

      const recovered = FIELD_KEY_SHORT_MAP[short];
      expect(recovered).toBe(f);
    }
  });

  it('should validate phone values and normalize digits', () => {
    const valid = validateFieldValue('phone', '01012345678');
    expect(valid.isValid).toBe(true);
    expect(valid.cleanValue).toBe('01012345678');

    const invalid = validateFieldValue('phone', '01912345678');
    expect(invalid.isValid).toBe(false);
  });

  it('should validate flexible dates for expiry dates', () => {
    const valid = validateFieldValue('idCardExpiryDate', '26-05-2028');
    expect(valid.isValid).toBe(true);

    const invalid = validateFieldValue('idCardExpiryDate', 'bad-date');
    expect(invalid.isValid).toBe(false);
  });

  it('should validate name field and require at least two names', () => {
    const valid = validateFieldValue('name', 'سالم حسن علي');
    expect(valid.isValid).toBe(true);

    const single = validateFieldValue('name', 'سالم');
    expect(single.isValid).toBe(false);
  });
});
