import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiVisionEngine } from '../src/engine.js';
import type { RawVisionApiResponse } from '../src/types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Enterprise AiVisionEngine Unit Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  function mockGeminiResponse(payload: RawVisionApiResponse, status = 200) {
    global.fetch = vi.fn().mockImplementation(() => {
      if (status !== 200) {
        return Promise.resolve({
          ok: false,
          status,
          text: () => Promise.resolve('API Error'),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(payload) }],
                },
              },
            ],
          }),
      });
    });
  }

  it('1. returns error when no Gemini API keys are configured or in env', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: [] });
    const oldEnv = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    // Act & Assert
    try {
      // Act
      const result = await engine.scanDocument(Buffer.from('test-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.userErrorMessage).toContain('GEMINI_API_KEY');
    } finally {
      process.env.GEMINI_API_KEY = oldEnv;
    }
  });

  it('2. rejects blurry or obscured photos with a user-friendly error', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    mockGeminiResponse({
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
      isCoveredOrObscured: true,
      isBlurryOrUnreadable: false,
    });

    // Act
    const result = await engine.scanDocument(Buffer.from('fake-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.isQualityAcceptable).toBe(false);
    expect(result.userErrorMessage).toContain('مغطاة بأصابع اليد');
  });

  it('3. rejects documents when detected doc type does not match expected doc type', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    mockGeminiResponse({
      detectedDocType: 'OTHER',
      isCoveredOrObscured: false,
      isBlurryOrUnreadable: false,
    });

    // Act
    const result = await engine.scanDocument(Buffer.from('fake-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.userErrorMessage).toContain('لا تطابق المستند المطلوب');
  });

  it('4. correctly parses a valid Egyptian National ID front', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    // Valid national ID: 29001012701234 (Born 1990-01-01, Luxor (27), Male)
    mockGeminiResponse({
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
      isCoveredOrObscured: false,
      isBlurryOrUnreadable: false,
      nationalIdNumber: '29001012701234',
      fullName: 'أحمد محمود علي إبراهيم',
      address: 'الأقصر، إسنا، ش أحمد عرابي',
      confidenceScore: 0.98,
    });

    // Act
    const result = await engine.scanDocument(Buffer.from('fake-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.detectedDocType).toBe('EGYPTIAN_NATIONAL_ID_FRONT');
    expect(result.nationalIdNumber).toBe('29001012701234');
    expect(result.fullName).toBe('أحمد محمود علي إبراهيم');
    expect(result.gender).toBe('MALE');
    expect(result.governorateCode).toBe('27');
    expect(result.birthDate).toBeDefined();
    expect(result.age).toBeGreaterThanOrEqual(30);
  });

  it('5. rejects Egyptian National ID front if national ID checksum or length is invalid', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    mockGeminiResponse({
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
      isCoveredOrObscured: false,
      isBlurryOrUnreadable: false,
      nationalIdNumber: '12345', // only 5 digits
      fullName: 'أحمد محمود',
    });

    // Act
    const result = await engine.scanDocument(Buffer.from('fake-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.userErrorMessage).toContain('14 رقماً');
  });

  it('6. correctly parses Egyptian National ID back and extracts expiry date', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    mockGeminiResponse({
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_BACK',
      isCoveredOrObscured: false,
      isBlurryOrUnreadable: false,
      expiryDate: '2028-05-26',
      address: 'محافظة قنا - مركز قوص',
    });

    // Act
    const result = await engine.scanDocument(Buffer.from('fake-image'), 'image/jpeg', 'NATIONAL_ID_BACK');

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.detectedDocType).toBe('EGYPTIAN_NATIONAL_ID_BACK');
    expect(result.expiryDateStr).toBe('26-05-2028');
    expect(result.address).toBe('محافظة قنا - مركز قوص');
  });

  it('7. correctly parses passport document', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    mockGeminiResponse({
      detectedDocType: 'PASSPORT',
      isCoveredOrObscured: false,
      isBlurryOrUnreadable: false,
      passportNumber: 'A12345678',
      fullName: 'Johnathan Doe',
      expiryDate: '2030-10-15',
    });

    // Act
    const result = await engine.scanIdentityDocument(Buffer.from('fake-image'), 'image/jpeg', 'PASSPORT');

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.detectedDocType).toBe('PASSPORT');
    expect(result.passportNumber).toBe('A12345678');
    expect(result.fullName).toBe('Johnathan Doe');
    expect(result.expiryDateStr).toBe('15-10-2030');
  });

  it('8. correctly parses invoices with items and total', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    mockGeminiResponse({
      detectedDocType: 'INVOICE',
      isCoveredOrObscured: false,
      isBlurryOrUnreadable: false,
      vendorName: 'شركة النيل لقطع الغيار',
      invoiceNumber: 'INV-2026-99',
      grandTotal: 15400,
      currency: 'EGP',
      items: [
        { description: 'تيل فرامل لودر', quantity: 2, unitPrice: 7700, totalPrice: 15400 },
      ],
    });

    // Act
    const result = await engine.scanInvoice(Buffer.from('fake-image'));

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.invoiceData?.vendorName).toBe('شركة النيل لقطع الغيار');
    expect(result.invoiceData?.grandTotal).toBe(15400);
    expect(result.invoiceData?.items).toHaveLength(1);
  });

  it('9. fallbacks to next model when primary model fails with HTTP error', async () => {
    // Arrange
    const engine = new AiVisionEngine({
      apiKeys: ['test-key-12345'],
      primaryModel: 'primary-model',
      fallbackModels: ['fallback-model'],
    });

    let calls = 0;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      calls++;
      if (url.includes('primary-model')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          text: () => Promise.resolve('Service Unavailable'),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        detectedDocType: 'PASSPORT',
                        passportNumber: 'B998877',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
      });
    });

    // Act
    const result = await engine.scanDocument(Buffer.from('test'), 'image/jpeg', 'PASSPORT');

    // Assert
    expect(calls).toBe(2);
    expect(result.isValid).toBe(true);
    expect(result.passportNumber).toBe('B998877');
  });

  it('10. successfully parses Gemini responses wrapped in markdown code fences', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '```json\n{\n  "detectedDocType": "EGYPTIAN_NATIONAL_ID_FRONT",\n  "isCoveredOrObscured": false,\n  "isBlurryOrUnreadable": false,\n  "nationalIdNumber": "29001012701234",\n  "fullName": "علي حسن"\n}\n```',
                  },
                ],
              },
            },
          ],
        }),
    });

    // Act
    const result = await engine.scanDocument(Buffer.from('test-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.nationalIdNumber).toBe('29001012701234');
    expect(result.fullName).toBe('علي حسن');
  });

  it('11. properly normalizes Eastern Arabic numerals in national ID without erasing them', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    // Eastern Arabic numerals for 29001012701234
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
                      isCoveredOrObscured: false,
                      isBlurryOrUnreadable: false,
                      nationalIdNumber: '٢٩٠٠١٠١٢٧٠١٢٣٤',
                      fullName: 'أحمد محمود',
                    }),
                  },
                ],
              },
            },
          ],
        }),
    });

    // Act
    const result = await engine.scanDocument(Buffer.from('test-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.nationalIdNumber).toBe('29001012701234');
    expect(result.governorateCode).toBe('27');
    expect(result.gender).toBe('MALE');
  });

  it('12. avoids falsely rejecting photos when isCoveredOrObscured is string "false"', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
                      isCoveredOrObscured: 'false',
                      isBlurryOrUnreadable: 'false',
                      nationalIdNumber: '29001012701234',
                      fullName: 'سعيد عبد الله',
                    }),
                  },
                ],
              },
            },
          ],
        }),
    });

    // Act
    const result = await engine.scanDocument(Buffer.from('test-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.isQualityAcceptable).toBe(true);
    expect(result.nationalIdNumber).toBe('29001012701234');
  });

  it('13. extracts birthDate, age, and gender from passport documents', async () => {
    // Arrange
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      detectedDocType: 'PASSPORT',
                      isCoveredOrObscured: false,
                      isBlurryOrUnreadable: false,
                      passportNumber: 'P12345678',
                      fullName: 'Alexander Smith',
                      birthDate: '1995-04-20',
                      gender: 'MALE',
                      nationality: 'British',
                      expiryDate: '2032-04-19',
                    }),
                  },
                ],
              },
            },
          ],
        }),
    });

    // Act
    const result = await engine.scanIdentityDocument(Buffer.from('test-image'), 'image/jpeg', 'PASSPORT');

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.passportNumber).toBe('P12345678');
    expect(result.fullName).toBe('Alexander Smith');
    expect(result.birthDate).toBeInstanceOf(Date);
    expect(result.gender).toBe('MALE');
    expect(result.governorateCode).toBe('88');
    expect(result.governorateNameAr).toContain('وافد');
    expect(result.age).toBeGreaterThanOrEqual(25);
  });
});
