import type { ProjectDocument } from '../model/document.js';
import { createValidationResult, type ValidationResult } from './diagnostics.js';
import { validationRules, type ValidationRule } from './rules.js';

export interface ValidateProjectDocumentOptions {
  rules?: ValidationRule[];
}

export function validateProjectDocument(document: ProjectDocument, options: ValidateProjectDocumentOptions = {}): ValidationResult {
  const rules = options.rules ?? validationRules;
  return createValidationResult(rules.flatMap((rule) => rule(document)));
}
