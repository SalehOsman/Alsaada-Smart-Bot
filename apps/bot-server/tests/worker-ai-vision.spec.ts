import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiVisionIdService } from '../src/services/ai-vision-id.service.js';
import { extractFirstTwoNames } from '@alsaada/regional-engine';

describe('AI Vision ID Service & Document Verification Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Document Type Guardrails & Strict Rejection Messages', () => {
    it('should reject invalid document with the exact specified error message when image is not an ID card or passport', async () => {
      // Mock fetch response from Gemini API indicating an irrelevant document
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

      // Temporary set API key for test
      vi.spyOn(aiVisionIdService as any, 'getApiKeys').mockReturnValue(['test-gemini-key']);

      const dummyBuffer = Buffer.from('fake-image-bytes');
      const result = await aiVisionIdService.scanDocument(dummyBuffer, 'image/jpeg', 'NATIONAL_ID_FRONT');

      expect(result.isValid).toBe(false);
      expect(result.detectedDocType).toBe('OTHER');
      expect(result.userErrorMessage).toContain(
        'الصورة المرفقة ليست لرقم قومي او باسبور يرجى ارفاق صورة بطاقة رقم قومي او باسبور على حسب حالة الاختيار'
      );
    });

    it('should reject image if it is obscured by fingers or blurry', async () => {
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

      vi.spyOn(aiVisionIdService as any, 'getApiKeys').mockReturnValue(['test-gemini-key']);

      const dummyBuffer = Buffer.from('fake-image-bytes');
      const result = await aiVisionIdService.scanDocument(dummyBuffer, 'image/jpeg', 'NATIONAL_ID_FRONT');

      expect(result.isValid).toBe(false);
      expect(result.isQualityAcceptable).toBe(false);
      expect(result.userErrorMessage).toContain('الصورة مغطاة بأصابع اليد أو بأجسام خارجية');
    });
  });

  describe('National ID & Expiry Extraction', () => {
    it('should extract 14-digit Egyptian National ID, name, and demographic info from front photo', async () => {
      // 29504200101234 -> Born 1995-04-20, Cairo (01), Male (23 -> odd)
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

      vi.spyOn(aiVisionIdService as any, 'getApiKeys').mockReturnValue(['test-gemini-key']);

      const dummyBuffer = Buffer.from('fake-image-bytes');
      const result = await aiVisionIdService.scanDocument(dummyBuffer, 'image/jpeg', 'NATIONAL_ID_FRONT');

      expect(result.isValid).toBe(true);
      expect(result.nationalIdNumber).toBe('29504200101234');
      expect(result.fullName).toBe('عبد الله محمود حسن إبراهيم');
      expect(result.gender).toBe('MALE');
      expect(result.governorateNameAr).toBe('القاهرة');
      expect(result.birthDate).toBeInstanceOf(Date);
    });

    it('should extract expiration date from back photo', async () => {
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

      vi.spyOn(aiVisionIdService as any, 'getApiKeys').mockReturnValue(['test-gemini-key']);

      const dummyBuffer = Buffer.from('fake-image-bytes');
      const result = await aiVisionIdService.scanDocument(dummyBuffer, 'image/jpeg', 'NATIONAL_ID_BACK');

      expect(result.isValid).toBe(true);
      expect(result.expiryDateStr).toBe('2029-08-15');
    });

    it('should extract passport number, name and expiry from passport photo', async () => {
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

      vi.spyOn(aiVisionIdService as any, 'getApiKeys').mockReturnValue(['test-gemini-key']);

      const dummyBuffer = Buffer.from('fake-image-bytes');
      const result = await aiVisionIdService.scanDocument(dummyBuffer, 'image/jpeg', 'PASSPORT');

      expect(result.isValid).toBe(true);
      expect(result.passportNumber).toBe('A12345678');
      expect(result.fullName).toBe('جون دو سميث');
      expect(result.expiryDateStr).toBe('2030-05-20');
    });
  });

  describe('Auto-Nickname Generation from Full Name', () => {
    it('should generate first two names respecting compound prefixes (عبد الله محمود حسن -> عبد الله محمود)', () => {
      const nick = extractFirstTwoNames('عبد الله محمود حسن إبراهيم');
      expect(nick).toBe('عبد الله محمود');
    });

    it('should generate first two names respecting compound suffixes (أحمد سيف الدين علي -> أحمد سيف الدين)', () => {
      const nick = extractFirstTwoNames('أحمد سيف الدين علي مصطفى');
      expect(nick).toBe('أحمد سيف الدين');
    });
  });
});
