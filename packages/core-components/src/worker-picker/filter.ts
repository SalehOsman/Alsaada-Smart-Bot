import { normalizeDigits } from '@alsaada/regional-engine';
import type { WorkerItem, PaginationState } from '../types.js';

/**
 * Normalizes Arabic text for flexible matching (unifying alef, taa marbuta, etc.).
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return normalizeDigits(text.trim())
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْ~]/g, '') // Remove tashkeel diacritics
    .toLowerCase();
}

export interface WorkerFilterOptions {
  query?: string;
  siteLocation?: string;
  jobTitle?: string;
}

/**
 * Filters a list of workers by query (name or code), site, or job title.
 */
export function filterWorkers(workers: WorkerItem[], options: WorkerFilterOptions = {}): WorkerItem[] {
  let filtered = [...workers];

  if (options.siteLocation) {
    filtered = filtered.filter((w) => w.siteLocation === options.siteLocation);
  }

  if (options.jobTitle) {
    filtered = filtered.filter((w) => w.jobTitle === options.jobTitle);
  }

  if (options.query) {
    const normalizedQuery = normalizeArabicText(options.query);
    filtered = filtered.filter((w) => {
      const nameMatch = normalizeArabicText(w.name).includes(normalizedQuery);
      const codeMatch = normalizeDigits(w.code).includes(normalizedQuery);
      return nameMatch || codeMatch;
    });
  }

  return filtered;
}

/**
 * Paginates an array of items.
 */
export function paginateItems<T>(items: T[], page = 1, pageSize = 6): { items: T[]; pagination: PaginationState } {
  const safePageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const startIndex = (safePage - 1) * safePageSize;
  const paginatedItems = items.slice(startIndex, startIndex + safePageSize);

  return {
    items: paginatedItems,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages,
    },
  };
}
