export interface ValidationResult {
  isValid: boolean;
  error?: string | undefined;
}

export function validateSearchQuery(query?: string | null): ValidationResult {
  if (!query || query.trim().length === 0) {
    return { isValid: false, error: 'يرجى إدخال اسم العامل أو كوده الوظيفي للبحث.' };
  }
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { isValid: false, error: 'كلمة البحث قصيرة للغاية، يجب ألا تقل عن حرفين أو رقمين.' };
  }
  if (trimmed.length > 50) {
    return { isValid: false, error: 'كلمة البحث تتجاوز الحد الأقصى المسموح به (50 حرفاً).' };
  }
  return { isValid: true };
}

export function validatePageNumber(page?: number | null, totalPages = 1): ValidationResult {
  if (page === undefined || page === null || isNaN(page)) {
    return { isValid: false, error: 'رقم الصفحة غير صالح.' };
  }
  if (page < 1) {
    return { isValid: false, error: 'رقم الصفحة يجب أن يكون 1 أو أكثر.' };
  }
  if (page > Math.max(1, totalPages)) {
    return { isValid: false, error: 'رقم الصفحة يتجاوز إجمالي الصفحات المتاحة.' };
  }
  return { isValid: true };
}

export function validateEvaluationPeriod(days?: number | null): ValidationResult {
  if (days === undefined || days === null || isNaN(days)) {
    return { isValid: false, error: 'فترة التقييم يجب أن تكون رقماً.' };
  }
  if (days < 7 || days > 365) {
    return { isValid: false, error: 'فترة التقييم يجب أن تكون بين 7 أيام و 365 يوماً.' };
  }
  return { isValid: true };
}
