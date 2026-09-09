import { Prisma, type Project } from '@prisma/client';
import {
  decodeProjectResource,
  type ProjectResource,
  StructuralDecodeError,
} from '@examen-sw1/uml-core';

export interface ProjectPersistenceData {
  id: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  revision: number;
  storageVersion: number;
  documentSchemaVersion: number;
  model: Prisma.InputJsonValue;
  layout: Prisma.InputJsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export function toProjectPersistenceData(resource: ProjectResource): ProjectPersistenceData {
  const { project } = resource;
  return {
    id: project.id,
    name: project.metadata.name,
    description: project.metadata.description ?? null,
    ownerId: project.ownerId ?? null,
    revision: project.revision,
    storageVersion: resource.storageVersion,
    documentSchemaVersion: resource.documentSchemaVersion,
    model: project.model as unknown as Prisma.InputJsonValue,
    layout: project.layout as unknown as Prisma.InputJsonValue,
    createdAt: new Date(project.timestamps.createdAt),
    updatedAt: new Date(project.timestamps.updatedAt),
  };
}

export function toProjectResource(row: Project): ProjectResource {
  const result = decodeProjectResource({
    project: {
      id: row.id,
      metadata: {
        name: row.name,
        ...(row.description === null ? {} : { description: row.description }),
      },
      ...(row.ownerId === null ? {} : { ownerId: row.ownerId }),
      revision: row.revision,
      timestamps: {
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
      model: row.model,
      layout: row.layout,
    },
    storageVersion: row.storageVersion,
    documentSchemaVersion: row.documentSchemaVersion,
  });

  if (!result.ok) {
    throw new StructuralDecodeError(result.diagnostics);
  }
  return result.value;
}
