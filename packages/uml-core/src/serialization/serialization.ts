import type { ProjectDocument } from '../model/document.js';
import { decodeSerializedProjectDocument } from '../persistence/decoder.js';
import { StructuralDecodeError } from '../persistence/project-resource.js';

export function serializeProjectDocument(document: ProjectDocument): string {
  return JSON.stringify(document);
}

export function deserializeProjectDocument(serialized: string): ProjectDocument {
  const result = decodeSerializedProjectDocument(serialized);
  if (!result.ok) {
    throw new StructuralDecodeError(result.diagnostics);
  }
  return result.value;
}
