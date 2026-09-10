export function validateSiteName(name: string): { isValid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, error: 'اسم الموقع مطلوب.' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'اسم الموقع يجب ألا يقل عن 3 أحرف.' };
  }
  if (trimmed.length > 100) {
    return { isValid: false, error: 'اسم الموقع طويل جداً (الحد الأقصى 100 حرف).' };
  }
  return { isValid: true };
}

export function validateSiteCode(code: string): { isValid: boolean; error?: string } {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    return { isValid: false, error: 'كود الموقع مطلوب.' };
  }
  if (!/^[A-Z0-9_-]{2,20}$/.test(trimmed)) {
    return { isValid: false, error: 'كود الموقع يجب أن يحتوي على حروف وأرقام إنجليزية فقط (مثال: STE-01).' };
  }
  return { isValid: true };
}

export function parseSiteCoordinates(text: string): { lat: number; lng: number } | null {
  const regex = /(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/;
  const match = text.match(regex);
  if (!match || !match[1] || !match[2]) return null;

  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng };
}
