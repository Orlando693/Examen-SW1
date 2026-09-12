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
import type { SafeUser } from '../auth/users.repository.js';
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
  access: 'OWNER' | 'EDITOR';
}

@Injectable()
export class ProjectsService {
  constructor(@Inject(ProjectsRepository) private readonly repository: ProjectsRepository) {}

  async create(user: SafeUser, input: CreateProjectDto): Promise<ProjectResource> {
    const document = createProjectDocument({ name: input.name, ...(input.description === undefined || input.description === null ? {} : { description: input.description }), ownerId: user.id });
    const row = await this.repository.create(toProjectPersistenceData({ project: document, storageVersion: INITIAL_STORAGE_VERSION, documentSchemaVersion: INITIAL_DOCUMENT_SCHEMA_VERSION }));
    return this.resource(row);
  }

  async list(user: SafeUser): Promise<{ items: ProjectSummary[] }> {
    const rows = await this.repository.listAccessible(user.id);
    return { items: rows.map((row) => ({ id: row.id, name: row.name, description: row.description, storageVersion: row.storageVersion, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), access: row.ownerId === user.id ? 'OWNER' : 'EDITOR' })) };
  }

  async get(user: SafeUser, id: string): Promise<ProjectResource> {
    return this.resource(await this.requireAccessibleRow(user.id, id));
  }

  async saveDocument(user: SafeUser, id: string, input: SaveProjectDocumentDto): Promise<ProjectResource> {
    const row = await this.requireAccessibleRow(user.id, id);
    const candidate = this.decodeCandidate(row, input.document);
    const validation = validateProjectDocument(candidate);
    if (validation.hasErrors) throw documentValidationError(validation.errors);

    const updated = await this.repository.updateIfAccessibleVersion(id, user.id, input.baseStorageVersion, {
      revision: candidate.revision,
      model: candidate.model as never,
      layout: candidate.layout as never,
    });
    if (!updated) await this.throwAccessibleMutationFailure(user.id, id);
    return this.get(user, id);
  }

  async updateMetadata(user: SafeUser, id: string, input: UpdateProjectMetadataDto): Promise<ProjectResource> {
    if (input.name === undefined && input.description === undefined) {
      throw new ProjectApiError(400, 'INVALID_REQUEST', 'At least one editable metadata field is required.');
    }
    const data = {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
    };
    const updated = await this.repository.updateIfOwnerVersion(id, user.id, input.baseStorageVersion, data);
    if (!updated) await this.throwOwnerMutationFailure(user.id, id);
    return this.get(user, id);
  }

  async delete(user: SafeUser, id: string, baseStorageVersion: number): Promise<void> {
    const deleted = await this.repository.deleteIfOwnerVersion(id, user.id, baseStorageVersion);
    if (!deleted) await this.throwOwnerMutationFailure(user.id, id);
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

  private async requireAccessibleRow(userId: string, id: string): Promise<Project> {
    const row = await this.repository.findAccessibleById(id, userId);
    if (!row) throw new ProjectApiError(404, 'PROJECT_NOT_FOUND', 'The project was not found.');
    return row;
  }

  private async throwAccessibleMutationFailure(userId: string, id: string): Promise<never> {
    if (await this.repository.findAccessibleById(id, userId)) {
      throw new ProjectApiError(409, 'PROJECT_REVISION_CONFLICT', 'The project was modified by another operation.');
    }
    throw new ProjectApiError(404, 'PROJECT_NOT_FOUND', 'The project was not found.');
  }

  private async throwOwnerMutationFailure(userId: string, id: string): Promise<never> {
    if (await this.repository.findOwnedById(id, userId)) {
      throw new ProjectApiError(409, 'PROJECT_REVISION_CONFLICT', 'The project was modified by another operation.');
    }
    if (await this.repository.findAccessibleById(id, userId)) {
      throw new ProjectApiError(403, 'FORBIDDEN', 'Only the project owner can administer this project.');
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
