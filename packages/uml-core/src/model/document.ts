import type { Uuid } from '../ids.js';
import { createUuid } from '../ids.js';
import { createEmptyDiagramLayout, type DiagramLayout } from './layout.js';
import { createEmptyUmlModel, type CanonicalUmlModel } from './model.js';

export interface ProjectMetadata {
  name: string;
  description?: string;
}

export interface ProjectTimestamps {
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocument {
  id: Uuid;
  metadata: ProjectMetadata;
  ownerId?: Uuid;
  revision: number;
  timestamps: ProjectTimestamps;
  model: CanonicalUmlModel;
  layout: DiagramLayout;
}

export interface CreateProjectDocumentInput {
  id?: Uuid;
  name: string;
  description?: string;
  ownerId?: Uuid;
  revision?: number;
  now?: string;
  model?: CanonicalUmlModel;
  layout?: DiagramLayout;
}

export function createProjectDocument(input: CreateProjectDocumentInput): ProjectDocument {
  const now = input.now ?? new Date().toISOString();

  return {
    id: createUuid(input.id),
    metadata: {
      name: input.name,
      ...(input.description === undefined ? {} : { description: input.description }),
    },
    ...(input.ownerId === undefined ? {} : { ownerId: input.ownerId }),
    revision: input.revision ?? 0,
    timestamps: {
      createdAt: now,
      updatedAt: now,
    },
    model: input.model ?? createEmptyUmlModel(),
    layout: input.layout ?? createEmptyDiagramLayout(),
  };
}

export function cloneProjectDocument(document: ProjectDocument): ProjectDocument {
  return structuredClone(document);
}

export function touchProjectDocument(document: ProjectDocument, now = new Date().toISOString()): ProjectDocument {
  return {
    ...document,
    revision: document.revision + 1,
    timestamps: {
      ...document.timestamps,
      updatedAt: now,
    },
  };
}
