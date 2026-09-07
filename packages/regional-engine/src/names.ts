/**
 * استخراج أول اسمين مع مراعاة كاملة للأسماء العربية المركبة:
 * - "عبد الله محمد أحمد" -> "عبد الله محمد"
 * - "أحمد نور الدين محمود" -> "أحمد نور الدين"
 * - "أبو بكر الصديق علي" -> "أبو بكر الصديق"
 * - "سيف الإسلام عبد الرحمن جابر" -> "سيف الإسلام عبد الرحمن"
 */
export function extractFirstTwoNames(fullName: string): string {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '-';

  const tokens = trimmed.split(' ');
  if (tokens.length <= 2) return trimmed;

  const COMPOUND_PREFIXES = [
    'عبد',
    'أبو',
    'ابو',
    'أم',
    'ام',
    'ابن',
    'بن',
    'آل',
    'ال',
  ];

  const COMPOUND_SUFFIXES = [
    'الدين',
    'الله',
    'الرحمن',
    'الإسلام',
    'الاسلام',
    'الحق',
    'النصر',
  ];

  const parsedParts: string[] = [];
  let i = 0;

  while (i < tokens.length && parsedParts.length < 2) {
    const currentToken = tokens[i];
    if (!currentToken) {
      i += 1;
      continue;
    }

    let currentPart = currentToken;
    const nextToken = i + 1 < tokens.length ? tokens[i + 1] : undefined;

    // إذا كان المقطع الحالي بادئة مركبة مثل "عبد" أو "أبو"
    if (nextToken && COMPOUND_PREFIXES.includes(currentPart)) {
      currentPart = `${currentPart} ${nextToken}`;
      i += 2;
    } else if (nextToken && COMPOUND_SUFFIXES.includes(nextToken)) {
      // إذا كان المقطع التالي لاحقة مركبة مثل "نور الدين" أو "سيف الدين"
      currentPart = `${currentPart} ${nextToken}`;
      i += 2;
    } else {
      i += 1;
    }

    parsedParts.push(currentPart);
  }

  return parsedParts.join(' ') || trimmed;
}
