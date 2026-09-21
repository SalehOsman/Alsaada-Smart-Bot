/**
 * Array Chunking and Pagination Domain Helpers
 */

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface PaginationResult<T> {
  items: T[];
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export function paginate<T>(
  items: T[],
  page = 1,
  pageSize = 10,
): PaginationResult<T> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
  const validPage = Math.min(safePage, totalPages);

  const start = (validPage - 1) * safePageSize;
  const pageItems = items.slice(start, start + safePageSize);

  return {
    items: pageItems,
    currentPage: validPage,
    pageSize: safePageSize,
    totalCount,
    totalPages,
    hasNext: validPage < totalPages,
    hasPrevious: validPage > 1,
  };
}
