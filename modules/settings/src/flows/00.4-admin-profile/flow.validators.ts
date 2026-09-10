export function validateAdminFullName(name: string): { isValid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 3) return { isValid: false, error: 'الاسم يجب ألا يقل عن 3 أحرف.' };
  return { isValid: true };
}

export function validateAdminPhone(phone: string): { isValid: boolean; normalized?: string; error?: string } {
  const clean = phone.replace(/[\s\-\+]/g, '');
  if (!/^01[0125][0-9]{8}$/.test(clean)) {
    return { isValid: false, error: 'رقم الهاتف يجب أن يكون رقماً مصرياً صحيحاً مكوناً من 11 رقماً ويبدأ بـ 01.' };
  }
  return { isValid: true, normalized: clean };
}
