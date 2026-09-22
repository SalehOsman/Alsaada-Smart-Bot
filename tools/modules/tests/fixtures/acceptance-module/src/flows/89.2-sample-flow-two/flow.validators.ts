export interface QueryFilterInput {
  status?: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
  limit?: number;
}

export function validateQueryFilter(input: QueryFilterInput): { isValid: boolean; error?: string } {
  if (input.status && !['ALL', 'PENDING', 'APPROVED', 'REJECTED'].includes(input.status)) {
    return { isValid: false, error: 'حالة الاستعلام غير معروفة.' };
  }
  if (input.limit !== undefined && (typeof input.limit !== 'number' || input.limit < 1 || input.limit > 50)) {
    return { isValid: false, error: 'حد الاستعلام يجب أن يكون بين 1 و 50.' };
  }
  return { isValid: true };
}
