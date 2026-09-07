import { config } from '../config/env.js';
import { normalizeDigits } from '@alsaada/regional-engine';
import { parseEgyptianNationalId } from '@alsaada/national-id-engine';

export type ExpectedDocType = 'NATIONAL_ID_FRONT' | 'NATIONAL_ID_BACK' | 'PASSPORT';

export interface AiVisionScanResult {
  isValid: boolean;
  detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT' | 'EGYPTIAN_NATIONAL_ID_BACK' | 'PASSPORT' | 'OTHER';
  isQualityAcceptable: boolean;
  nationalIdNumber?: string;
  passportNumber?: string;
  expiryDateStr?: string; // YYYY-MM-DD
  fullName?: string;
  address?: string; // محل الإقامة / العنوان الكامل
  birthDate?: Date;
  gender?: 'MALE' | 'FEMALE';
  governorateNameAr?: string;
  userErrorMessage?: string;
  rawJson?: any;
}

export class AiVisionIdService {
  private primaryModel = 'gemini-2.5-flash';
  private fallbackModels = ['gemini-2.0-flash', 'gemini-1.5-flash'];

  private getApiKeys(): string[] {
    const raw = config.geminiApiKey || process.env.GEMINI_API_KEY || '';
    const keys = raw
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 5);
    return keys;
  }

  /**
   * فحص وتحليل صورة وثيقة الهوية (وجه أو ظهر بطاقة رقم قومي أو جواز سفر) بالذكاء الاصطناعي
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
        userErrorMessage: '⚠️ خدمة الذكاء الاصطناعي غير مهيأة حالياً (مفتاح GEMINI_API_KEY غير متوفر). يرجى استخدام الإدخال اليدوي.',
      };
    }

    const base64Data = imageBuffer.toString('base64');
    const expectedLabel =
      expectedType === 'NATIONAL_ID_FRONT'
        ? 'وجه بطاقة الرقم القومي المصري'
        : expectedType === 'NATIONAL_ID_BACK'
        ? 'ظهر بطاقة الرقم القومي المصري'
        : 'جواز السفر';

    const systemPrompt = `أنت خبير فحص وثائق رسمية بالذكاء الاصطناعي متخصص في بطاقات الرقم القومي المصرية وجوازات السفر.
المطلوب منك فحص الصورة المرفقة بدقة بالغة واستخراج البيانات وفق الشروط التالية:

المستند المتوقع: "${expectedLabel}".

المعايير الصارمة:
1. نوع المستند (detectedDocType):
   - "EGYPTIAN_NATIONAL_ID_FRONT": الوجه الأمامي لبطاقة الرقم القومي المصرية الصادرة من وزارة الداخلية قطاع مصلحة الأحوال المدنية (يحمل النسر، صورة الشخص، والـ 14 رقماً بالأسفل أو بالأعلى).
   - "EGYPTIAN_NATIONAL_ID_BACK": الوجه الخلفي لبطاقة الرقم القومي المصرية (يحمل الباركود، وتاريخ انتهاء السريان "سارية حتى YYYY/MM/DD"، والمهنة ومحل الإقامة).
   - "PASSPORT": صفحة البيانات الرئيسية لجواز السفر (تحمل صورة المسافر، رقم الجواز، الجنسية، وتاريخ الانتهاء).
   - "OTHER": أي صورة أخرى (رخصة قيادة، بطاقة تأمين، كارنيه نقابة، إيصال، صورة شخصية عادية، مستند غير متعلق، أو مستند من دولة أخرى).

2. جودة الصورة (isQualityAcceptable):
   - يجب أن تكون البطاقة كاملة وظاهرة داخل الإطار دون اقتطاع أركانها.
   - يجب ألا تكون مغطاة بأصابع اليد أو بأي جسم خارجي يغطي الأرقام أو البيانات (isCoveredOrObscured).
   - يجب ألا تكون مشوشة أو باهتة بدرجة تمنع القراءة الدقيقة (isBlurryOrUnreadable).

3. استخراج البيانات:
   - nationalIdNumber: الرقم القومي المصري المكون من 14 رقماً بالضبط، مستخرجاً كأرقام إنجليزية (0-9).
   - passportNumber: رقم جواز السفر.
   - expiryDate: تاريخ انتهاء سريان البطاقة أو الجواز بصيغة "YYYY-MM-DD". في ظهر البطاقة المصرية ابحث عن عبارة "سارية حتى" أو تاريخ الانتهاء.
   - fullName: اسم الشخص الكامل المدون على البطاقة/الجواز.
   - address: العنوان الكامل ومحل الإقامة المدون على البطاقة (سواء في الوجه أو الظهر) أو جواز السفر (مثل: المحافظة، المركز/القسم، القرية/الشارع).

أرجع النتيجة حصراً بصيغة JSON التالية دون أي نصوص إضافية:
{
  "detectedDocType": "EGYPTIAN_NATIONAL_ID_FRONT" | "EGYPTIAN_NATIONAL_ID_BACK" | "PASSPORT" | "OTHER",
  "isCoveredOrObscured": true | false,
  "isBlurryOrUnreadable": true | false,
  "nationalIdNumber": "14 digits or null",
  "passportNumber": "string or null",
  "expiryDate": "YYYY-MM-DD or null",
  "fullName": "string or null",
  "address": "string or null",
  "notes": "string"
}`;

    const models = [this.primaryModel, ...this.fallbackModels];
    let lastError: any = null;
    let parsedJson: any = null;

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
                ],
              },
            ],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.1,
            },
          };

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const data = (await res.json()) as any;
            const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textContent) {
              parsedJson = JSON.parse(textContent);
              break;
            }
          } else {
            const errText = await res.text();
            lastError = new Error(`Gemini API error (${res.status}): ${errText}`);
          }
        } catch (err) {
          lastError = err;
        }
      }
      if (parsedJson) break;
    }

    if (!parsedJson) {
      console.error('❌ [AI-VISION] Failed all Gemini models/keys:', lastError);
      return {
        isValid: false,
        detectedDocType: 'OTHER',
        isQualityAcceptable: false,
        userErrorMessage: '⚠️ تعذر تحليل الصورة بالذكاء الاصطناعي بسبب ضغط الشبكة. يمكنك إعادة المحاولة أو إدخال الرقم يدوياً.',
      };
    }

    const detectedType = parsedJson.detectedDocType || 'OTHER';
    const isCovered = Boolean(parsedJson.isCoveredOrObscured);
    const isBlurry = Boolean(parsedJson.isBlurryOrUnreadable);

    // 1. حراسة الجودة ومنع التغطية بالأصابع
    if (isCovered || isBlurry) {
      return {
        isValid: false,
        detectedDocType: detectedType,
        isQualityAcceptable: false,
        rawJson: parsedJson,
        userErrorMessage:
          '⚠️ *الصورة غير مقبولة:*\n' +
          (isCovered ? '• الصورة مغطاة بأصابع اليد أو بأجسام خارجية تحجب الأرقام.\n' : '') +
          (isBlurry ? '• الصورة مشوشة أو باهتة وغير واضحة.\n' : '') +
          'يرجى تصوير البطاقة كاملة داخل الإطار بجودة عالية وإضاءة واضحة دون أي تغطية.',
      };
    }

    // 2. حراسة نوع المستند (AI Document Type Guardrail)
    const matchesExpected =
      (expectedType === 'NATIONAL_ID_FRONT' && detectedType === 'EGYPTIAN_NATIONAL_ID_FRONT') ||
      (expectedType === 'NATIONAL_ID_BACK' && detectedType === 'EGYPTIAN_NATIONAL_ID_BACK') ||
      (expectedType === 'PASSPORT' && detectedType === 'PASSPORT');

    if (!matchesExpected) {
      return {
        isValid: false,
        detectedDocType: detectedType,
        isQualityAcceptable: true,
        rawJson: parsedJson,
        userErrorMessage:
          '❌ *الصورة المرفقة ليست لرقم قومي او باسبور يرجى ارفاق صورة بطاقة رقم قومي او باسبور على حسب حالة الاختيار*\n' +
          'يرجى مراعاة أن تكون الصورة واضحة وكاملة وغير مغطاة بأي أصابع أو أجسام خارجية.',
      };
    }

    // 3. التحقق من الرقم القومي المصري عند فحص الوجه
    if (expectedType === 'NATIONAL_ID_FRONT') {
      const rawNid = normalizeDigits(String(parsedJson.nationalIdNumber || '').replace(/\D/g, ''));
      if (rawNid.length !== 14) {
        return {
          isValid: false,
          detectedDocType: detectedType,
          isQualityAcceptable: false,
          rawJson: parsedJson,
          userErrorMessage: '⚠️ تم التعرف على البطاقة ولكن تعذر استخراج الرقم القومي بدقة (14 رقماً). يرجى إعادة التقاط الصورة بزاوية مستقيمة وإضاءة أوضح.',
        };
      }

      // تدقيق الرقم عبر national-id-engine
      const parsedNid = parseEgyptianNationalId(rawNid);
      if (!parsedNid.isValid || !parsedNid.info) {
        return {
          isValid: false,
          detectedDocType: detectedType,
          isQualityAcceptable: false,
          rawJson: parsedJson,
          userErrorMessage: `⚠️ الرقم القومي المقروء (${rawNid}) غير صالح تقويمياً أو جغرافياً: ${parsedNid.error || ''}. يرجى إعادة التصوير بوضوح.`,
        };
      }

      return {
        isValid: true,
        detectedDocType: detectedType,
        isQualityAcceptable: true,
        nationalIdNumber: rawNid,
        fullName: parsedJson.fullName || undefined,
        address: parsedJson.address ? String(parsedJson.address).trim() : undefined,
        birthDate: parsedNid.info.birthDate,
        gender: parsedNid.info.gender,
        governorateNameAr: parsedNid.info.governorateNameAr,
        rawJson: parsedJson,
      };
    }

    // 4. استخراج تاريخ الانتهاء عند فحص ظهر البطاقة
    if (expectedType === 'NATIONAL_ID_BACK') {
      let expiry = (parsedJson.expiryDate || '').trim();
      expiry = normalizeDigits(expiry.replace(/[\/.]/g, '-'));

      let expiryDate: string | undefined = undefined;
      if (expiry.match(/^\d{4}-\d{2}-\d{2}$/)) {
        expiryDate = expiry;
      }

      return {
        isValid: true,
        detectedDocType: detectedType,
        isQualityAcceptable: true,
        expiryDateStr: expiryDate,
        address: parsedJson.address ? String(parsedJson.address).trim() : undefined,
        rawJson: parsedJson,
      };
    }

    // 5. فحص جواز السفر
    const rawPass = (parsedJson.passportNumber || '').trim().toUpperCase();
    return {
      isValid: true,
      detectedDocType: detectedType,
      isQualityAcceptable: true,
      passportNumber: rawPass || undefined,
      fullName: parsedJson.fullName || undefined,
      address: parsedJson.address ? String(parsedJson.address).trim() : undefined,
      expiryDateStr: parsedJson.expiryDate || undefined,
      rawJson: parsedJson,
    };
  }
}

export const aiVisionIdService = new AiVisionIdService();
