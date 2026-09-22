import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiVisionEngine } from '@alsaada/ai-vision-engine';
import { extractFirstTwoNames } from '@alsaada/regional-engine';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('AI Vision ID Service & Document Verification Engine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Document Type Guardrails & Strict Rejection Messages', () => {
    it('rejects invalid document with specified error message when image is not an ID card or passport', async () => {
      // Arrange
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    detectedDocType: 'OTHER',
                    isCoveredOrObscured: false,
                    isBlurryOrUnreadable: false,
                    nationalIdNumber: null,
                    passportNumber: null,
                    expiryDate: null,
                    fullName: null,
                    notes: 'This is a driving license or receipt, not a national ID or passport',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGeminiResponse,
      } as any);

      vi.spyOn(aiVisionEngine as any, 'getApiKeys').mockReturnValue(['test-gemini-key']);
      const dummyBuffer = Buffer.from('fake-image-bytes');

      // Act
      const result = await aiVisionEngine.scanDocument(dummyBuffer, 'image/jpeg', 'NATIONAL_ID_FRONT');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.detectedDocType).toBe('OTHER');
      expect(result.userErrorMessage).toContain(
        'الصورة المرفقة ليست لرقم قومي او باسبور يرجى ارفاق صورة بطاقة رقم قومي او باسبور على حسب حالة الاختيار'
      );
    });

    it('rejects image when covered by fingers or blurry', async () => {
      // Arrange
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
                    isCoveredOrObscured: true,
                    isBlurryOrUnreadable: false,
                    nationalIdNumber: '29504200101234',
                    passportNumber: null,
                    expiryDate: null,
                    fullName: 'محمد علي',
                    notes: 'Fingers cover the bottom numbers',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGeminiResponse,
      } as any);

      vi.spyOn(aiVisionEngine as any, 'getApiKeys').mockReturnValue(['test-gemini-key']);
      const dummyBuffer = Buffer.from('fake-image-bytes');

      // Act
      const result = await aiVisionEngine.scanDocument(dummyBuffer, 'image/jpeg', 'NATIONAL_ID_FRONT');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.isQualityAcceptable).toBe(false);
      expect(result.userErrorMessage).toContain('الصورة مغطاة بأصابع اليد أو بأجسام خارجية');
    });

    it('returns configuration error when GEMINI_API_KEY is missing', async () => {
      // Arrange
      vi.spyOn(aiVisionEngine as any, 'getApiKeys').mockReturnValue([]);
      const dummyBuffer = Buffer.from('fake-image-bytes');

      // Act
      const result = await aiVisionEngine.scanDocument(dummyBuffer, 'image/jpeg', 'NATIONAL_ID_FRONT');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.userErrorMessage).toContain('مفتاح GEMINI_API_KEY غير متوفر');
    });
  });

  describe('National ID & Expiry Extraction', () => {
    it('extracts 14-digit Egyptian National ID, name, and demographic info from front photo', async () => {
      // Arrange
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
                    isCoveredOrObscured: false,
                    isBlurryOrUnreadable: false,
                    nationalIdNumber: '29504200101234',
                    passportNumber: null,
                    expiryDate: null,
                    fullName: 'عبد الله محمود حسن إبراهيم',
                    notes: 'Clear national ID front',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGeminiResponse,
      } as any);

      vi.spyOn(aiVisionEngine as any, 'getApiKeys').mockReturnValue(['test-gemini-key']);
      const dummyBuffer = Buffer.from('fake-image-bytes');

      // Act
      const result = await aiVisionEngine.scanDocument(dummyBuffer, 'image/jpeg', 'NATIONAL_ID_FRONT');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.nationalIdNumber).toBe('29504200101234');
      expect(result.fullName).toBe('عبد الله محمود حسن إبراهيم');
      expect(result.gender).toBe('MALE');
      expect(result.governorateNameAr).toBe('القاهرة');
      expect(result.birthDate).toBeInstanceOf(Date);
      expect(result.userErrorMessage).toBeUndefined();
    });

    it('extracts expiration date from back photo', async () => {
      // Arrange
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    detectedDocType: 'EGYPTIAN_NATIONAL_ID_BACK',
                    isCoveredOrObscured: false,
                    isBlurryOrUnreadable: false,
                    nationalIdNumber: null,
                    passportNumber: null,
                    expiryDate: '2029-08-15',
                    fullName: null,
                    notes: 'Valid until 2029-08-15',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGeminiResponse,
      } as any);

      vi.spyOn(aiVisionEngine as any, 'getApiKeys').mockReturnValue(['test-gemini-key']);
      const dummyBuffer = Buffer.from('fake-image-bytes');

      // Act
      const result = await aiVisionEngine.scanDocument(dummyBuffer, 'image/jpeg', 'NATIONAL_ID_BACK');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.expiryDateStr).toBe('15-08-2029');
    });

    it('extracts passport number, name and expiry from passport photo', async () => {
      // Arrange
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    detectedDocType: 'PASSPORT',
                    isCoveredOrObscured: false,
                    isBlurryOrUnreadable: false,
                    nationalIdNumber: null,
                    passportNumber: 'A12345678',
                    expiryDate: '2030-05-20',
                    fullName: 'جون دو سميث',
                    notes: 'Valid passport',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGeminiResponse,
      } as any);

      vi.spyOn(aiVisionEngine as any, 'getApiKeys').mockReturnValue(['test-gemini-key']);
      const dummyBuffer = Buffer.from('fake-image-bytes');

      // Act
      const result = await aiVisionEngine.scanDocument(dummyBuffer, 'image/jpeg', 'PASSPORT');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.passportNumber).toBe('A12345678');
      expect(result.fullName).toBe('جون دو سميث');
      expect(result.expiryDateStr).toBe('20-05-2030');
    });
  });

  describe('Auto-Nickname Generation from Full Name', () => {
    it('generates first two names respecting compound prefixes', () => {
      // Arrange
      const inputFullName = 'عبد الله محمود حسن إبراهيم';

      // Act
      const nick = extractFirstTwoNames(inputFullName);

      // Assert
      expect(nick).toBe('عبد الله محمود');
    });

    it('generates first two names respecting compound suffixes', () => {
      // Arrange
      const inputFullName = 'أحمد سيف الدين علي مصطفى';

      // Act
      const nick = extractFirstTwoNames(inputFullName);

      // Assert
      expect(nick).toBe('أحمد سيف الدين');
    });

    it('returns hyphen for empty input name string', () => {
      // Arrange
      const input = '';

      // Act
      const nick = extractFirstTwoNames(input);

      // Assert
      expect(nick).toBe('-');
    });
  });
});
