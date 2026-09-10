export function validateDeptCode(code: string): { isValid: boolean; error?: string } {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { isValid: false, error: 'كود القسم مطلوب.' };
  if (!/^[A-Z0-9_-]{2,10}$/.test(trimmed)) {
    return { isValid: false, error: 'كود القسم يجب أن يتكون من حروف وأرقام إنجليزية (مثال: D-ENG).' };
  }
  return { isValid: true };
}

export function validateDeptName(name: string): { isValid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 3) return { isValid: false, error: 'اسم القسم يجب ألا يقل عن 3 أحرف.' };
  return { isValid: true };
}

export function validateSalary(val: string | number): { isValid: boolean; amount?: number; error?: string } {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || num < 0) return { isValid: false, error: 'يرجى إدخال مبلغ صحيح أكبر من أو يساوي 0.' };
  return { isValid: true, amount: num };
}
