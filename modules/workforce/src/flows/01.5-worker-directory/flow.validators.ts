export function validateDirectorySearchQuery(query: string): { isValid: boolean; cleanQuery?: string; error?: string } {
  const clean = query.trim();
  if (!clean) {
    return { isValid: false, error: 'نص البحث فارغ. يرجى كتابة اسم أو كود العامل للبحث.' };
  }
  if (clean.length > 50) {
    return { isValid: false, error: 'نص البحث طويل جداً (الحد الأقصى 50 حرفاً).' };
  }
  return { isValid: true, cleanQuery: clean };
}

export function validateDirectoryPage(rawPage: string | number): number {
  const page = typeof rawPage === 'number' ? rawPage : parseInt(rawPage, 10);
  if (isNaN(page) || page < 1) {
    return 1;
  }
  return page;
}

export function validateWorkerIdParam(workerId: string): { isValid: boolean; error?: string } {
  const clean = workerId.trim();
  if (!clean) {
    return { isValid: false, error: 'معرف العامل مطلوب.' };
  }
  return { isValid: true };
}
