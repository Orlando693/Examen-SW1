import type { ValidationDiagnostic } from '@examen-sw1/uml-core';

export type ProjectErrorCode =
  | 'INVALID_REQUEST'
  | 'PROJECT_NOT_FOUND'
  | 'PROJECT_REVISION_CONFLICT'
  | 'DOCUMENT_VALIDATION_FAILED'
  | 'UNSUPPORTED_DOCUMENT_SCHEMA_VERSION'
  | 'PAYLOAD_TOO_LARGE'
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INTERNAL_ERROR';

export class ProjectApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ProjectErrorCode,
    message: string,
    public readonly details: object = {},
  ) {
    super(message);
    this.name = 'ProjectApiError';
  }
}

export class StoredProjectDataError extends Error {
  constructor(public readonly unsupportedFormat: boolean) {
    super('Stored project data cannot be decoded.');
    this.name = 'StoredProjectDataError';
  }
}

export function documentValidationError(diagnostics: ValidationDiagnostic[]): ProjectApiError {
  return new ProjectApiError(422, 'DOCUMENT_VALIDATION_FAILED', 'The UML document has blocking validation errors.', { diagnostics });
}
