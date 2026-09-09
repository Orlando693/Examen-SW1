import type { ProjectDocument } from '../model/document.js';

export const INITIAL_STORAGE_VERSION = 0;
export const INITIAL_DOCUMENT_SCHEMA_VERSION = 1;

export interface ProjectResource {
  project: ProjectDocument;
  storageVersion: number;
  documentSchemaVersion: number;
}

export interface StructuralDiagnostic {
  code: 'MALFORMED_JSON' | 'MISSING_FIELD' | 'INVALID_TYPE' | 'UNSUPPORTED_DISCRIMINATOR' | 'UNSUPPORTED_DOCUMENT_SCHEMA_VERSION';
  message: string;
  path: string;
}

export type DecodeResult<T> =
  | { ok: true; value: T }
  | { ok: false; diagnostics: StructuralDiagnostic[] };

export class StructuralDecodeError extends Error {
  constructor(public readonly diagnostics: StructuralDiagnostic[]) {
    super(diagnostics.map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`).join('; '));
    this.name = 'StructuralDecodeError';
  }
}
