import type { Uuid } from '../ids.js';

export type ValidationSeverity = 'ERROR' | 'WARNING';

export interface ValidationDiagnostic {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path: string;
  elementId?: Uuid;
  elementType?: string;
}

export interface ValidationResult {
  diagnostics: ValidationDiagnostic[];
  errors: ValidationDiagnostic[];
  warnings: ValidationDiagnostic[];
  hasErrors: boolean;
}

export function createValidationResult(diagnostics: ValidationDiagnostic[]): ValidationResult {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'ERROR');
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'WARNING');

  return {
    diagnostics,
    errors,
    warnings,
    hasErrors: errors.length > 0,
  };
}
