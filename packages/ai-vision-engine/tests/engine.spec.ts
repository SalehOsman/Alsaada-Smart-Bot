import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiVisionEngine } from '../src/engine.js';
import type { RawVisionApiResponse } from '../src/types.js';

describe('Enterprise AiVisionEngine Unit Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
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

  it('should return error when no Gemini API keys are configured or in env', async () => {
    const engine = new AiVisionEngine({ apiKeys: [] });
    const oldEnv = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await engine.scanDocument(Buffer.from('test-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');
      expect(result.isValid).toBe(false);
      expect(result.userErrorMessage).toContain('GEMINI_API_KEY');
    } finally {
      process.env.GEMINI_API_KEY = oldEnv;
    }
  });

  it('should reject blurry or obscured photos with a user-friendly error', async () => {
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    mockGeminiResponse({
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
      isCoveredOrObscured: true,
      isBlurryOrUnreadable: false,
    });

    const result = await engine.scanDocument(Buffer.from('fake-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');
    expect(result.isValid).toBe(false);
    expect(result.isQualityAcceptable).toBe(false);
    expect(result.userErrorMessage).toContain('مغطاة بأصابع اليد');
  });

  it('should reject documents when detected doc type does not match expected doc type', async () => {
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    mockGeminiResponse({
      detectedDocType: 'OTHER',
      isCoveredOrObscured: false,
      isBlurryOrUnreadable: false,
    });

    const result = await engine.scanDocument(Buffer.from('fake-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');
    expect(result.isValid).toBe(false);
    expect(result.userErrorMessage).toContain('لا تطابق المستند المطلوب');
  });

  it('should correctly parse a valid Egyptian National ID front', async () => {
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

    const result = await engine.scanDocument(Buffer.from('fake-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');
    expect(result.isValid).toBe(true);
    expect(result.detectedDocType).toBe('EGYPTIAN_NATIONAL_ID_FRONT');
    expect(result.nationalIdNumber).toBe('29001012701234');
    expect(result.fullName).toBe('أحمد محمود علي إبراهيم');
    expect(result.gender).toBe('MALE');
    expect(result.governorateCode).toBe('27');
    expect(result.birthDate).toBeDefined();
    expect(result.age).toBeGreaterThanOrEqual(30);
  });

  it('should reject Egyptian National ID front if national ID checksum or length is invalid', async () => {
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    mockGeminiResponse({
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
      isCoveredOrObscured: false,
      isBlurryOrUnreadable: false,
      nationalIdNumber: '12345', // only 5 digits
      fullName: 'أحمد محمود',
    });

    const result = await engine.scanDocument(Buffer.from('fake-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');
    expect(result.isValid).toBe(false);
    expect(result.userErrorMessage).toContain('14 رقماً');
  });

  it('should correctly parse Egyptian National ID back and extract expiry date', async () => {
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    mockGeminiResponse({
      detectedDocType: 'EGYPTIAN_NATIONAL_ID_BACK',
      isCoveredOrObscured: false,
      isBlurryOrUnreadable: false,
      expiryDate: '2028-05-26',
      address: 'محافظة قنا - مركز قوص',
    });

    const result = await engine.scanDocument(Buffer.from('fake-image'), 'image/jpeg', 'NATIONAL_ID_BACK');
    expect(result.isValid).toBe(true);
    expect(result.detectedDocType).toBe('EGYPTIAN_NATIONAL_ID_BACK');
    expect(result.expiryDateStr).toBe('26-05-2028');
    expect(result.address).toBe('محافظة قنا - مركز قوص');
  });

  it('should correctly parse passport document', async () => {
    const engine = new AiVisionEngine({ apiKeys: ['test-key-12345'] });
    mockGeminiResponse({
      detectedDocType: 'PASSPORT',
      isCoveredOrObscured: false,
      isBlurryOrUnreadable: false,
      passportNumber: 'A12345678',
      fullName: 'Johnathan Doe',
      expiryDate: '2030-10-15',
    });

    const result = await engine.scanIdentityDocument(Buffer.from('fake-image'), 'image/jpeg', 'PASSPORT');
    expect(result.isValid).toBe(true);
    expect(result.detectedDocType).toBe('PASSPORT');
    expect(result.passportNumber).toBe('A12345678');
    expect(result.fullName).toBe('Johnathan Doe');
    expect(result.expiryDateStr).toBe('15-10-2030');
  });

  it('should correctly parse invoices with items and total', async () => {
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

    const result = await engine.scanInvoice(Buffer.from('fake-image'));
    expect(result.isValid).toBe(true);
    expect(result.invoiceData?.vendorName).toBe('شركة النيل لقطع الغيار');
    expect(result.invoiceData?.grandTotal).toBe(15400);
    expect(result.invoiceData?.items).toHaveLength(1);
  });

  it('should fallback to next model when primary model fails with HTTP error', async () => {
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

    const result = await engine.scanDocument(Buffer.from('test'), 'image/jpeg', 'PASSPORT');
    expect(calls).toBe(2);
    expect(result.isValid).toBe(true);
    expect(result.passportNumber).toBe('B998877');
  });

  it('should successfully parse Gemini responses wrapped in markdown code fences', async () => {
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

    const result = await engine.scanDocument(Buffer.from('test-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');
    expect(result.isValid).toBe(true);
    expect(result.nationalIdNumber).toBe('29001012701234');
    expect(result.fullName).toBe('علي حسن');
  });

  it('should properly normalize Eastern Arabic numerals in national ID without erasing them', async () => {
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

    const result = await engine.scanDocument(Buffer.from('test-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');
    expect(result.isValid).toBe(true);
    expect(result.nationalIdNumber).toBe('29001012701234');
    expect(result.governorateCode).toBe('27');
    expect(result.gender).toBe('MALE');
  });

  it('should not falsely reject photos when isCoveredOrObscured is string "false"', async () => {
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

    const result = await engine.scanDocument(Buffer.from('test-image'), 'image/jpeg', 'NATIONAL_ID_FRONT');
    expect(result.isValid).toBe(true);
    expect(result.isQualityAcceptable).toBe(true);
    expect(result.nationalIdNumber).toBe('29001012701234');
  });

  it('should extract birthDate, age, and gender from passport documents', async () => {
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

    const result = await engine.scanIdentityDocument(Buffer.from('test-image'), 'image/jpeg', 'PASSPORT');
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
