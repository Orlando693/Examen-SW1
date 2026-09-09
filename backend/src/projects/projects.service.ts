import { Inject, Injectable } from '@nestjs/common';
import {
  createProjectDocument,
  decodeProjectDocument,
  INITIAL_DOCUMENT_SCHEMA_VERSION,
  INITIAL_STORAGE_VERSION,
  StructuralDecodeError,
  validateProjectDocument,
  type ProjectDocument,
  type ProjectResource,
} from '@examen-sw1/uml-core';
import type { Project } from '@prisma/client';
import { toProjectPersistenceData, toProjectResource } from '../persistence/project-persistence.mapper.js';
import { documentValidationError, ProjectApiError, StoredProjectDataError } from './project.errors.js';
import type { CreateProjectDto, SaveProjectDocumentDto, UpdateProjectMetadataDto } from './projects.dto.js';
import { ProjectsRepository } from './projects.repository.js';

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  storageVersion: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ProjectsService {
  constructor(@Inject(ProjectsRepository) private readonly repository: ProjectsRepository) {}

  async create(input: CreateProjectDto): Promise<ProjectResource> {
    const document = createProjectDocument({ name: input.name, ...(input.description === undefined || input.description === null ? {} : { description: input.description }) });
    const row = await this.repository.create(toProjectPersistenceData({ project: document, storageVersion: INITIAL_STORAGE_VERSION, documentSchemaVersion: INITIAL_DOCUMENT_SCHEMA_VERSION }));
    return this.resource(row);
  }

  async list(): Promise<{ items: ProjectSummary[] }> {
    const rows = await this.repository.list();
    return { items: rows.map((row) => ({ id: row.id, name: row.name, description: row.description, storageVersion: row.storageVersion, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })) };
  }

  async get(id: string): Promise<ProjectResource> {
    return this.resource(await this.requireRow(id));
  }

  async saveDocument(id: string, input: SaveProjectDocumentDto): Promise<ProjectResource> {
    const row = await this.requireRow(id);
    const candidate = this.decodeCandidate(row, input.document);
    const validation = validateProjectDocument(candidate);
    if (validation.hasErrors) throw documentValidationError(validation.errors);

    const updated = await this.repository.updateIfVersion(id, input.baseStorageVersion, {
      revision: candidate.revision,
      model: candidate.model as never,
      layout: candidate.layout as never,
    });
    if (!updated) await this.throwMutationFailure(id);
    return this.get(id);
  }

  async updateMetadata(id: string, input: UpdateProjectMetadataDto): Promise<ProjectResource> {
    if (input.name === undefined && input.description === undefined) {
      throw new ProjectApiError(400, 'INVALID_REQUEST', 'At least one editable metadata field is required.');
    }
    const data = {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
    };
    const updated = await this.repository.updateIfVersion(id, input.baseStorageVersion, data);
    if (!updated) await this.throwMutationFailure(id);
    return this.get(id);
  }

  async delete(id: string, baseStorageVersion: number): Promise<void> {
    const deleted = await this.repository.deleteIfVersion(id, baseStorageVersion);
    if (!deleted) await this.throwMutationFailure(id);
  }

  private decodeCandidate(row: Project, document: SaveProjectDocumentDto['document']): ProjectDocument {
    const decoded = decodeProjectDocument({
      id: row.id,
      metadata: { name: row.name, ...(row.description === null ? {} : { description: row.description }) },
      ...(row.ownerId === null ? {} : { ownerId: row.ownerId }),
      revision: document.revision,
      timestamps: { createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() },
      model: document.model,
      layout: document.layout,
    });
    if (!decoded.ok) throw new StructuralDecodeError(decoded.diagnostics);
    return decoded.value;
  }

  private async requireRow(id: string): Promise<Project> {
    const row = await this.repository.findById(id);
    if (!row) throw new ProjectApiError(404, 'PROJECT_NOT_FOUND', 'The project was not found.');
    return row;
  }

  private async throwMutationFailure(id: string): Promise<never> {
    if (await this.repository.findById(id)) {
      throw new ProjectApiError(409, 'PROJECT_REVISION_CONFLICT', 'The project was modified by another operation.');
    }
    throw new ProjectApiError(404, 'PROJECT_NOT_FOUND', 'The project was not found.');
  }

  private resource(row: Project): ProjectResource {
    try {
      const resource = toProjectResource(row);
      if (validateProjectDocument(resource.project).hasErrors) {
        throw new StoredProjectDataError(false);
      }
      return resource;
    } catch (error) {
      if (error instanceof StructuralDecodeError) {
        throw new StoredProjectDataError(error.diagnostics.some((diagnostic) => diagnostic.code === 'UNSUPPORTED_DOCUMENT_SCHEMA_VERSION'));
      }
      throw error;
    }
  }
}
