export class WorkforceError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'WORKFORCE_ERROR',
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'WorkforceError';
  }
}

export class WorkforceUnauthorizedError extends WorkforceError {
  constructor(message = 'غير مصرح لك بتنفيذ هذا الإجراء في قطاع الموارد البشرية.') {
    super(message, 'UNAUTHORIZED_WORKFORCE_ACCESS', 403);
    this.name = 'WorkforceUnauthorizedError';
  }
}

export class WorkforceValidationError extends WorkforceError {
  constructor(message: string) {
    super(message, 'VALIDATION_FAILED', 422);
    this.name = 'WorkforceValidationError';
  }
}
