import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractFirstTwoNames } from '../src/names.js';

describe('Arabic Compound Name Extractor (extractFirstTwoNames)', () => {
  const PINNED_BASE_TIME = new Date('2026-03-03T12:00:00.000Z');
  let stdoutSpy: any;
  let stderrSpy: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleInfoSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  it('extracts regular two names when no compound prefix/suffix', () => {
    // Arrange
    const fullName1 = 'محمود علي إبراهيم خليل';
    const fullName2 = 'أحمد حسن';

    // Act
    const res1 = extractFirstTwoNames(fullName1);
    const res2 = extractFirstTwoNames(fullName2);

    // Assert
    expect(res1).toBe('محمود علي');
    expect(res2).toBe('أحمد حسن');
    expect(res1).not.toBe('محمود');
    expect(res2).not.toBe('أحمد');
  });

  it('handles compound prefixes properly (عبد, أبو, ابن, etc.)', () => {
    // Arrange
    const compoundAbd = 'عبد الله محمد محمود حسن';
    const compoundAbu = 'أبو بكر الصديق حسن إبراهيم';
    const compoundDoubleAbd = 'عبد الرحمن عبد الرحيم السيد';
    const compoundIbn = 'ابن خلدون أحمد';

    // Act
    const resAbd = extractFirstTwoNames(compoundAbd);
    const resAbu = extractFirstTwoNames(compoundAbu);
    const resDoubleAbd = extractFirstTwoNames(compoundDoubleAbd);
    const resIbn = extractFirstTwoNames(compoundIbn);

    // Assert
    expect(resAbd).toBe('عبد الله محمد');
    expect(resAbu).toBe('أبو بكر الصديق');
    expect(resDoubleAbd).toBe('عبد الرحمن عبد الرحيم');
    expect(resIbn).toBe('ابن خلدون أحمد');
    expect(resAbd).not.toBe('عبد الله');
  });

  it('handles compound suffixes properly (الدين, الله, الإسلام, etc.)', () => {
    // Arrange
    const compoundDeen = 'أحمد نور الدين علي مصطفى';
    const compoundIslam = 'سيف الإسلام محمد حسن';
    const compoundDoubleDeen = 'حسام الدين صلاح الدين عثمان';

    // Act
    const resDeen = extractFirstTwoNames(compoundDeen);
    const resIslam = extractFirstTwoNames(compoundIslam);
    const resDoubleDeen = extractFirstTwoNames(compoundDoubleDeen);

    // Assert
    expect(resDeen).toBe('أحمد نور الدين');
    expect(resIslam).toBe('سيف الإسلام محمد');
    expect(resDoubleDeen).toBe('حسام الدين صلاح الدين');
    expect(resDeen).not.toBe('أحمد نور');
  });

  it('handles edge cases gracefully', () => {
    // Arrange
    const empty = '';
    const whitespace = '   ';
    const single = 'محمد';

    // Act
    const resEmpty = extractFirstTwoNames(empty);
    const resWhitespace = extractFirstTwoNames(whitespace);
    const resSingle = extractFirstTwoNames(single);

    // Assert
    expect(resEmpty).toBe('-');
    expect(resWhitespace).toBe('-');
    expect(resSingle).toBe('محمد');
    expect(resEmpty).not.toBe('محمد');
    expect(resWhitespace).not.toBe('محمد');
  });
});
