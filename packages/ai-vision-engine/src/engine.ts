import { normalizeDigits, parseFlexibleDate } from '@alsaada/regional-engine';
import { parseEgyptianNationalId } from '@alsaada/national-id-engine';
import { getSystemPromptForDocType } from './prompts.js';
import type {
  ExpectedDocType,
  DetectedDocType,
  AiVisionEngineConfig,
  AiVisionScanResult,
  RawVisionApiResponse,
} from './types.js';

interface GeminiApiContentPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

interface GeminiApiResponsePart {
  text?: string;
}

interface GeminiApiResponseCandidate {
  content?: {
    parts?: GeminiApiResponsePart[];
  };
}

interface GeminiApiResponse {
  candidates?: GeminiApiResponseCandidate[];
}

export function extractJsonFromAiResponse<T = Record<string, unknown>>(text: string): T | null {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Continue to extract from markdown or substring
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // Continue below
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const candidate = trimmed.substring(firstBrace, lastBrace + 1);
      return JSON.parse(candidate) as T;
    } catch {
      // Return null on total failure
    }
  }

  return null;
}

export class AiVisionEngine {
  private readonly primaryModel: string;
  private readonly fallbackModels: string[];
  private readonly configuredApiKeys: string[];
  private readonly temperature: number;
  private readonly timeoutMs: number;

  constructor(config: AiVisionEngineConfig = {}) {
    this.primaryModel = config.primaryModel ?? 'gemini-2.5-flash';
    this.fallbackModels = config.fallbackModels ?? ['gemini-2.0-flash', 'gemini-1.5-flash'];
    this.configuredApiKeys = config.apiKeys ?? [];
    this.temperature = config.temperature ?? 0.1;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  private getApiKeys(): string[] {
    if (this.configuredApiKeys.length > 0) {
      return this.configuredApiKeys;
    }
    const raw = process.env.GEMINI_API_KEY || '';
    return raw
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 5);
  }

  /**
   * فحص وتحليل صورة المستند أو الوثيقة الرسمية أو الفاتورة بالذكاء الاصطناعي
   */
  async scanDocument(
    imageBuffer: Buffer,
    mimeType: string,
    expectedType: ExpectedDocType
  ): Promise<AiVisionScanResult> {
    const apiKeys = this.getApiKeys();
    if (apiKeys.length === 0) {
      return {
        isValid: false,
        detectedDocType: 'OTHER',
        isQualityAcceptable: false,
        userErrorMessage:
          '⚠️ خدمة الذكاء الاصطناعي غير مهيأة حالياً (مفتاح GEMINI_API_KEY غير متوفر). يرجى استخدام الإدخال اليدوي.',
      };
    }

    const base64Data = imageBuffer.toString('base64');
    const systemPrompt = getSystemPromptForDocType(expectedType);
    const models = [this.primaryModel, ...this.fallbackModels];

    let lastErrorMessage = '';
    let parsedJson: RawVisionApiResponse | null = null;

    for (const key of apiKeys) {
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          const payload = {
            contents: [
              {
                parts: [
                  { text: systemPrompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data,
                    },
                  },
                ] satisfies GeminiApiContentPart[],
              },
            ],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: this.temperature,
            },
          };

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), this.timeoutMs);

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (res.ok) {
            const data = (await res.json()) as GeminiApiResponse;
            const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textContent) {
              const extracted = extractJsonFromAiResponse<RawVisionApiResponse>(textContent);
              if (extracted) {
                parsedJson = extracted;
                break;
              }
            }
          } else {
            const errText = await res.text().catch(() => '');
            lastErrorMessage = `Gemini API error (${res.status}): ${errText}`;
          }
        } catch (err) {
          lastErrorMessage = err instanceof Error ? err.message : String(err);
        }
      }
      if (parsedJson) break;
    }

    if (!parsedJson) {
      return {
        isValid: false,
        detectedDocType: 'OTHER',
        isQualityAcceptable: false,
        userErrorMessage: `⚠️ تعذر تحليل الصورة بالذكاء الاصطناعي بسبب ضغط الشبكة أو استنفاد النماذج (${lastErrorMessage || 'Network error'}). يمكنك إعادة المحاولة أو المتابعة يدوياً.`,
      };
    }

    return this.evaluateApiResponse(parsedJson, expectedType);
  }

  private evaluateApiResponse(
    parsedJson: RawVisionApiResponse,
    expectedType: ExpectedDocType
  ): AiVisionScanResult {
    const validDocTypes: readonly DetectedDocType[] = [
      'EGYPTIAN_NATIONAL_ID_FRONT',
      'EGYPTIAN_NATIONAL_ID_BACK',
      'PASSPORT',
      'INVOICE',
      'RECEIPT',
      'WAYBILL',
      'OTHER',
    ];

    const rawType = parsedJson.detectedDocType || 'OTHER';
    const detectedType: DetectedDocType = (validDocTypes as readonly string[]).includes(rawType)
      ? (rawType as DetectedDocType)
      : 'OTHER';

    const isCovered =
      parsedJson.isCoveredOrObscured === true ||
      String(parsedJson.isCoveredOrObscured).toLowerCase() === 'true';
    const isBlurry =
      parsedJson.isBlurryOrUnreadable === true ||
      String(parsedJson.isBlurryOrUnreadable).toLowerCase() === 'true';

    // 1. حراسة الجودة ومنع التغطية بالأصابع أو التشويش
    if (isCovered || isBlurry) {
      return {
        isValid: false,
        detectedDocType: detectedType,
        isQualityAcceptable: false,
        rawJson: parsedJson as Record<string, unknown>,
        userErrorMessage:
          '⚠️ *الصورة غير مقبولة:*\n' +
          (isCovered ? '• الصورة مغطاة بأصابع اليد أو بأجسام خارجية تحجب الأرقام أو البيانات.\n' : '') +
          (isBlurry ? '• الصورة مشوشة أو باهتة وغير واضحة.\n' : '') +
          'يرجى تصوير المستند كاملاً داخل الإطار بجودة عالية وإضاءة واضحة دون أي تغطية.',
      };
    }

    // 2. حراسة مطابقة نوع المستند (AI Document Type Guardrail)
    const matchesExpected = this.checkTypeMatch(expectedType, detectedType);
    if (!matchesExpected) {
      const isIdentity =
        expectedType === 'NATIONAL_ID_FRONT' ||
        expectedType === 'NATIONAL_ID_BACK' ||
        expectedType === 'PASSPORT';

      const typeLabel =
        expectedType === 'NATIONAL_ID_FRONT'
          ? 'وجه بطاقة الرقم القومي المصري'
          : expectedType === 'NATIONAL_ID_BACK'
          ? 'ظهر بطاقة الرقم القومي المصري'
          : expectedType === 'PASSPORT'
          ? 'جواز السفر'
          : expectedType === 'INVOICE'
          ? 'فاتورة مشتريات'
          : expectedType === 'RECEIPT'
          ? 'إشعار تحويل بنكي / محفظة'
          : 'بوليصة شحن';

      const userErrorMessage = isIdentity
        ? '❌ *الصورة المرفقة ليست لرقم قومي او باسبور يرجى ارفاق صورة بطاقة رقم قومي او باسبور على حسب حالة الاختيار*\n' +
          `لا تطابق المستند المطلوب (${typeLabel}). يرجى التأكد من رفع المستند بجودة عالية وإضاءة واضحة دون أي تغطية.`
        : `❌ *الصورة المرفقة لا تطابق المستند المطلوب (${typeLabel}).*\n` +
          'يرجى التأكد من رفع المستند الصحيح بجودة عالية وإضاءة واضحة.';

      return {
        isValid: false,
        detectedDocType: detectedType,
        isQualityAcceptable: true,
        rawJson: parsedJson as Record<string, unknown>,
        userErrorMessage,
      };
    }

    // 3. معالجة وجه بطاقة الرقم القومي المصري
    if (expectedType === 'NATIONAL_ID_FRONT') {
      const rawNid = normalizeDigits(String(parsedJson.nationalIdNumber || '')).replace(/\D/g, '');
      if (rawNid.length !== 14) {
        return {
          isValid: false,
          detectedDocType: detectedType,
          isQualityAcceptable: false,
          rawJson: parsedJson as Record<string, unknown>,
          userErrorMessage:
            '⚠️ تم التعرف على وجه البطاقة ولكن تعذر استخراج الرقم القومي بدقة (14 رقماً). يرجى إعادة التقاط الصورة بزاوية مستقيمة وإضاءة أوضح.',
        };
      }

      const parsedNid = parseEgyptianNationalId(rawNid);
      if (!parsedNid.isValid || !parsedNid.info) {
        return {
          isValid: false,
          detectedDocType: detectedType,
          isQualityAcceptable: false,
          rawJson: parsedJson as Record<string, unknown>,
          userErrorMessage: `⚠️ الرقم القومي المقروء (${rawNid}) غير صالح تقويمياً أو جغرافياً: ${parsedNid.error || ''}. يرجى إعادة التصوير بوضوح.`,
        };
      }

      return {
        isValid: true,
        detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
        isQualityAcceptable: true,
        nationalIdNumber: rawNid,
        fullName: parsedJson.fullName ? String(parsedJson.fullName).trim() : undefined,
        address: parsedJson.address ? String(parsedJson.address).trim() : undefined,
        birthDate: parsedNid.info.birthDate,
        age: parsedNid.info.age,
        gender: parsedNid.info.gender,
        governorateCode: parsedNid.info.governorateCode,
        governorateNameAr: parsedNid.info.governorateNameAr,
        confidenceScore: parsedJson.confidenceScore ?? 0.95,
        rawJson: parsedJson as Record<string, unknown>,
      };
    }

    // 4. معالجة ظهر بطاقة الرقم القومي المصري (تاريخ السريان والعنوان)
    if (expectedType === 'NATIONAL_ID_BACK') {
      const rawExpiry = String(parsedJson.expiryDate || parsedJson.notes || '').trim();
      const parsedExp = parseFlexibleDate(rawExpiry);
      const expiryDateStr = parsedExp.isValid ? parsedExp.formattedDMY : undefined;

      return {
        isValid: true,
        detectedDocType: 'EGYPTIAN_NATIONAL_ID_BACK',
        isQualityAcceptable: true,
        expiryDateStr,
        address: parsedJson.address ? String(parsedJson.address).trim() : undefined,
        confidenceScore: parsedJson.confidenceScore ?? 0.95,
        rawJson: parsedJson as Record<string, unknown>,
      };
    }

    // 5. معالجة جواز السفر
    if (expectedType === 'PASSPORT') {
      const rawPass = String(parsedJson.passportNumber || '').trim().toUpperCase();
      const rawExpiry = String(parsedJson.expiryDate || parsedJson.notes || '').trim();
      const parsedExp = parseFlexibleDate(rawExpiry);
      const expiryDateStr = parsedExp.isValid ? parsedExp.formattedDMY : undefined;

      let birthDate: Date | undefined;
      let age: number | undefined;
      if (parsedJson.birthDate) {
        const parsedBirth = parseFlexibleDate(parsedJson.birthDate);
        if (parsedBirth.isValid && parsedBirth.date) {
          birthDate = parsedBirth.date;
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }
      }

      const rawGender = String(parsedJson.gender || '').toUpperCase();
      const gender =
        rawGender.includes('FEMALE') || rawGender.includes('أنثى')
          ? 'FEMALE'
          : rawGender
          ? 'MALE'
          : undefined;

      return {
        isValid: true,
        detectedDocType: 'PASSPORT',
        isQualityAcceptable: true,
        passportNumber: rawPass || undefined,
        fullName: parsedJson.fullName ? String(parsedJson.fullName).trim() : undefined,
        address: parsedJson.address ? String(parsedJson.address).trim() : undefined,
        birthDate,
        age: age !== undefined ? Math.max(0, age) : undefined,
        gender,
        governorateCode: '88',
        governorateNameAr: 'خارج الجمهورية (وافد)',
        expiryDateStr,
        confidenceScore: parsedJson.confidenceScore ?? 0.95,
        rawJson: parsedJson as Record<string, unknown>,
      };
    }

    // 6. معالجة الفواتير والإيصالات
    if (expectedType === 'INVOICE' || expectedType === 'RECEIPT' || expectedType === 'WAYBILL') {
      return {
        isValid: true,
        detectedDocType: detectedType,
        isQualityAcceptable: true,
        confidenceScore: parsedJson.confidenceScore ?? 0.9,
        invoiceData: {
          vendorName: parsedJson.vendorName ? String(parsedJson.vendorName).trim() : undefined,
          invoiceNumber: parsedJson.invoiceNumber ? String(parsedJson.invoiceNumber).trim() : undefined,
          transactionDate: parsedJson.transactionDate ? String(parsedJson.transactionDate).trim() : undefined,
          currency: parsedJson.currency ? String(parsedJson.currency).trim() : 'EGP',
          grandTotal: typeof parsedJson.grandTotal === 'number' ? parsedJson.grandTotal : undefined,
          taxAmount: typeof parsedJson.taxAmount === 'number' ? parsedJson.taxAmount : undefined,
          items: Array.isArray(parsedJson.items) ? parsedJson.items : undefined,
          confidenceScore: parsedJson.confidenceScore ?? 0.9,
        },
        rawJson: parsedJson as Record<string, unknown>,
      };
    }

    return {
      isValid: false,
      detectedDocType: detectedType,
      isQualityAcceptable: false,
      rawJson: parsedJson as Record<string, unknown>,
      userErrorMessage: '⚠️ نوع المستند غير معروف.',
    };
  }

  private checkTypeMatch(expected: ExpectedDocType, detected: DetectedDocType): boolean {
    switch (expected) {
      case 'NATIONAL_ID_FRONT':
        return detected === 'EGYPTIAN_NATIONAL_ID_FRONT' || detected.includes('FRONT');
      case 'NATIONAL_ID_BACK':
        return detected === 'EGYPTIAN_NATIONAL_ID_BACK' || detected.includes('BACK');
      case 'PASSPORT':
        return detected === 'PASSPORT';
      case 'INVOICE':
        return detected === 'INVOICE';
      case 'RECEIPT':
        return detected === 'RECEIPT' || detected === 'INVOICE';
      case 'WAYBILL':
        return detected === 'WAYBILL';
      default:
        return false;
    }
  }

  /**
   * مساعد سريع لمسح وثائق الهوية (بطاقة الرقم القومي أو جواز السفر)
   */
  scanIdentityDocument(
    imageBuffer: Buffer,
    mimeType: string,
    expectedType: 'NATIONAL_ID_FRONT' | 'NATIONAL_ID_BACK' | 'PASSPORT'
  ): Promise<AiVisionScanResult> {
    return this.scanDocument(imageBuffer, mimeType, expectedType);
  }

  /**
   * مساعد سريع لمسح فواتير المشتريات
   */
  scanInvoice(imageBuffer: Buffer, mimeType = 'image/jpeg'): Promise<AiVisionScanResult> {
    return this.scanDocument(imageBuffer, mimeType, 'INVOICE');
  }

  /**
   * مساعد سريع لمسح إيصالات التحويل البنكي والمحافظ
   */
  scanReceipt(imageBuffer: Buffer, mimeType = 'image/jpeg'): Promise<AiVisionScanResult> {
    return this.scanDocument(imageBuffer, mimeType, 'RECEIPT');
  }
}

export const aiVisionEngine = new AiVisionEngine();
