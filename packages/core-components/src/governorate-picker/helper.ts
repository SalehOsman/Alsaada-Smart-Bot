import { EGYPTIAN_GOVERNORATES } from '@alsaada/national-id-engine';
import type { GovernorateItem } from './types.js';

/**
 * Returns the list of 27 official Egyptian governorates, using EGYPTIAN_GOVERNORATES
 * from @alsaada/national-id-engine as the single source of truth (SSOT).
 * Sorted numerically by governorate code (01, 02, ... 35).
 * Excludes code '88' (Born Abroad).
 */
export function getGovernoratesList(): GovernorateItem[] {
  return Object.entries(EGYPTIAN_GOVERNORATES)
    .filter(([code]) => code !== '88')
    .sort(([codeA], [codeB]) => parseInt(codeA, 10) - parseInt(codeB, 10))
    .map(([code, info]) => ({
      code,
      nameAr: info.nameAr,
      nameEn: info.nameEn,
    }));
}
