import type { ProjectDocument } from '../model/document.js';

export function serializeProjectDocument(document: ProjectDocument): string {
  return JSON.stringify(document);
}

export function deserializeProjectDocument(serialized: string): ProjectDocument {
  return JSON.parse(serialized) as ProjectDocument;
}
