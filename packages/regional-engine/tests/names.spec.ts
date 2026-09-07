import { describe, it, expect } from 'vitest';
import { extractFirstTwoNames } from '../src/names.js';

describe('Arabic Compound Name Extractor (extractFirstTwoNames)', () => {
  it('extracts regular two names when no compound prefix/suffix', () => {
    expect(extractFirstTwoNames('محمود علي إبراهيم خليل')).toBe('محمود علي');
    expect(extractFirstTwoNames('أحمد حسن')).toBe('أحمد حسن');
  });

  it('handles compound prefixes properly (عبد, أبو, ابن, etc.)', () => {
    expect(extractFirstTwoNames('عبد الله محمد محمود حسن')).toBe('عبد الله محمد');
    expect(extractFirstTwoNames('أبو بكر الصديق حسن إبراهيم')).toBe('أبو بكر الصديق');
    expect(extractFirstTwoNames('عبد الرحمن عبد الرحيم السيد')).toBe('عبد الرحمن عبد الرحيم');
    expect(extractFirstTwoNames('ابن خلدون أحمد')).toBe('ابن خلدون أحمد');
  });

  it('handles compound suffixes properly (الدين, الله, الإسلام, etc.)', () => {
    expect(extractFirstTwoNames('أحمد نور الدين علي مصطفى')).toBe('أحمد نور الدين');
    expect(extractFirstTwoNames('سيف الإسلام محمد حسن')).toBe('سيف الإسلام محمد');
    expect(extractFirstTwoNames('حسام الدين صلاح الدين عثمان')).toBe('حسام الدين صلاح الدين');
  });

  it('handles edge cases gracefully', () => {
    expect(extractFirstTwoNames('')).toBe('-');
    expect(extractFirstTwoNames('محمد')).toBe('محمد');
  });
});
