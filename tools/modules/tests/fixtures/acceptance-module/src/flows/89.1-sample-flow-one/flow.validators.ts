export interface SampleCreationInput {
  title: string;
  amount: number;
}

export function validateSampleCreation(input: SampleCreationInput): { isValid: boolean; error?: string } {
  if (!input.title || input.title.trim().length < 2) {
    return { isValid: false, error: 'اسم العملية يجب أن يكون حرفين على الأقل.' };
  }
  if (input.title.trim().length > 100) {
    return { isValid: false, error: 'اسم العملية طويل جدًا (الحد الأقصى 100 حرف).' };
  }
  if (typeof input.amount !== 'number' || isNaN(input.amount) || input.amount <= 0) {
    return { isValid: false, error: 'المبلغ يجب أن يكون رقمًا موجبًا.' };
  }
  if (input.amount > 1000000) {
    return { isValid: false, error: 'المبلغ يتجاوز الحد الأقصى المسموح به (1,000,000 ج.م).' };
  }
  return { isValid: true };
}
