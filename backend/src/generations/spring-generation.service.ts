import { Inject, Injectable } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { mapCanonicalUmlModel } from '@examen-sw1/relational-core';
import { generateSpringProject } from '@examen-sw1/spring-generator';
import type { SafeUser } from '../auth/users.repository.js';
import { ProjectApiError } from '../projects/project.errors.js';
import { ProjectsService } from '../projects/projects.service.js';
import { deriveSpringGenerationMetadata } from './spring-generation.metadata.js';
import { SPRING_ZIP_ARCHIVER, type SpringZipArchiver } from './spring-zip-archiver.js';

export const SPRING_GENERATION_TEMP_ROOT = Symbol('SPRING_GENERATION_TEMP_ROOT');

export interface SpringGenerationDownload {
  filename: string;
  temporaryRoot: string;
  zipPath: string;
}

function generationError(diagnostics: Array<{ code: string; path: string }>): ProjectApiError {
  return new ProjectApiError(422, 'GENERATION_VALIDATION_FAILED', 'The saved UML model cannot be generated.', { diagnostics: diagnostics.slice(0, 20) });
}

function safeGeneratedPath(path: string): boolean {
  return path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some((part) => part === '' || part === '.' || part === '..');
}

function removeTemporaryRoot(root: string): Promise<void> {
  // Windows may retain a just-closed streamed ZIP handle briefly.
  return rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

@Injectable()
export class SpringGenerationService {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(SPRING_ZIP_ARCHIVER) private readonly archiver: SpringZipArchiver,
    @Inject(SPRING_GENERATION_TEMP_ROOT) private readonly temporaryParent: string,
  ) {}

  async generate(user: SafeUser, projectId: string): Promise<SpringGenerationDownload> {
    // ProjectsService returns the access-checked, decoded persisted document; layout is intentionally ignored.
    const resource = await this.projects.get(user, projectId);
    const metadata = deriveSpringGenerationMetadata(resource.project);
    const mapped = mapCanonicalUmlModel(resource.project.model);
    if (!mapped.success) throw generationError(mapped.diagnostics.map(({ code, path }) => ({ code, path })));
    const temporaryRoot = await mkdtemp(join(this.temporaryParent, 'examen-sw1-spring-'));
    try {
      const projectRoot = join(temporaryRoot, metadata.artifactName);
      const generated = await generateSpringProject(mapped.model, { basePackage: metadata.basePackage, outputRoot: projectRoot });
      if (!generated.result) throw generationError(generated.diagnostics.map(({ code, path }) => ({ code, path })));
      const entries = generated.files.map((file) => {
        if (!safeGeneratedPath(file.path)) throw new ProjectApiError(500, 'GENERATION_FAILED', 'The generated artifact could not be created.');
        return { content: file.content, archivePath: `${metadata.artifactName}/${file.path}` };
      });
      const zipPath = join(temporaryRoot, `${metadata.artifactName}.zip`);
      await this.archiver.archive(entries, zipPath);
      return { filename: `${metadata.artifactName}.zip`, temporaryRoot, zipPath };
    } catch (error) {
      await removeTemporaryRoot(temporaryRoot);
      if (error instanceof ProjectApiError) throw error;
      throw new ProjectApiError(500, 'GENERATION_FAILED', 'The generated artifact could not be created.');
    }
  }

  cleanup(download: SpringGenerationDownload): Promise<void> {
    return removeTemporaryRoot(download.temporaryRoot);
  }
}
