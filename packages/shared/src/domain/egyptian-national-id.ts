/**
 * Egyptian National ID Verification & Extraction Utilities
 */

import { normalizeArabicDigits } from "./arabic-text.js";

export interface NationalIdValidationResult {
  isValid: boolean;
  birthDate?: Date;
  gender?: "male" | "female";
  governorateCode?: string;
  error?: string;
}

const GOVERNORATE_CODES: Record<string, string> = {
  "01": "Cairo",
  "02": "Alexandria",
  "03": "Port Said",
  "04": "Suez",
  "11": "Damietta",
  "12": "Dakahlia",
  "13": "Ash Sharqia",
  "14": "Al Qalyubia",
  "15": "Kafr El Sheikh",
  "16": "Gharbia",
  "17": "Monufia",
  "18": "El Beheira",
  "19": "Ismailia",
  "21": "Giza",
  "22": "Beni Suef",
  "23": "Faiyum",
  "24": "Minya",
  "25": "Asyut",
  "26": "Sohag",
  "27": "Qena",
  "28": "Aswan",
  "29": "Luxor",
  "31": "Red Sea",
  "32": "New Valley",
  "33": "Matrouh",
  "34": "North Sinai",
  "35": "South Sinai",
  "88": "Foreign Born",
};

export function validateEgyptianNationalId(
  rawId: string,
): NationalIdValidationResult {
  const normalized = normalizeArabicDigits(rawId).trim();

  if (!/^\d{14}$/.test(normalized)) {
    return { isValid: false, error: "National ID must be exactly 14 digits" };
  }

  const centuryCode = normalized[0];
  if (centuryCode !== "2" && centuryCode !== "3") {
    return { isValid: false, error: "Invalid century code" };
  }

  const yearPrefix = centuryCode === "2" ? "19" : "20";
  const year = parseInt(yearPrefix + normalized.slice(1, 3), 10);
  const month = parseInt(normalized.slice(3, 5), 10);
  const day = parseInt(normalized.slice(5, 7), 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { isValid: false, error: "Invalid birth date encoded in ID" };
  }

  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) {
    return { isValid: false, error: "Invalid calendar date" };
  }

  const govCode = normalized.slice(7, 9);
  if (!GOVERNORATE_CODES[govCode]) {
    return { isValid: false, error: "Invalid governorate code" };
  }

  const genderDigit = parseInt(normalized[12] ?? "0", 10);
  const gender: "male" | "female" = genderDigit % 2 === 1 ? "male" : "female";

  return {
    isValid: true,
    birthDate,
    gender,
    governorateCode: govCode,
  };
}
