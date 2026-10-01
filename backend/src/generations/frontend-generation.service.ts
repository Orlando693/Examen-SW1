import { Inject, Injectable } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { generateDomainManifest } from '@examen-sw1/domain-manifest';
import { generateFrontendProject } from '@examen-sw1/frontend-generator';
import { validateGeneratedOpenApi, withGeneratedOpenApi } from '@examen-sw1/generated-api-contracts';
import { mapCanonicalUmlModel } from '@examen-sw1/relational-core';
import type { SafeUser } from '../auth/users.repository.js';
import { ProjectApiError } from '../projects/project.errors.js';
import { ProjectsService } from '../projects/projects.service.js';
import { deriveSpringGenerationMetadata } from './spring-generation.metadata.js';
import { SPRING_GENERATION_TEMP_ROOT } from './spring-generation.service.js';
import { SPRING_ZIP_ARCHIVER, type SpringZipArchiver } from './spring-zip-archiver.js';

export interface FrontendGenerationDownload {
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
  return rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

@Injectable()
export class FrontendGenerationService {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(SPRING_ZIP_ARCHIVER) private readonly archiver: SpringZipArchiver,
    @Inject(SPRING_GENERATION_TEMP_ROOT) private readonly temporaryParent: string,
  ) {}

  async generate(user: SafeUser, projectId: string): Promise<FrontendGenerationDownload> {
    const resource = await this.projects.get(user, projectId);
    const metadata = deriveSpringGenerationMetadata(resource.project);
    const mapped = mapCanonicalUmlModel(resource.project.model);
    if (!mapped.success) throw generationError(mapped.diagnostics.map(({ code, path }) => ({ code, path })));
    const temporaryRoot = await mkdtemp(join(this.temporaryParent, 'examen-sw1-frontend-'));
    const artifactName = `${metadata.artifactName}-frontend`;
    try {
      const generated = await withGeneratedOpenApi(resource.project.model, {}, async ({ document }) => {
        const contract = validateGeneratedOpenApi(document);
        if (!contract.contract) throw generationError(contract.diagnostics.map(({ path }) => ({ code: 'OPENAPI_INVALID', path })));
        const domain = generateDomainManifest(mapped.model, contract.contract);
        if (!domain.manifest) throw generationError(domain.diagnostics.map(({ path }) => ({ code: 'DOMAIN_MANIFEST_DERIVATION_FAILED', path })));
        return generateFrontendProject(domain.manifest, contract.contract);
      });
      if (generated.diagnostics.length > 0) throw generationError(generated.diagnostics.map(({ path }) => ({ code: 'FRONTEND_GENERATION_FAILED', path })));
      const entries = generated.files.map((file) => {
        if (!safeGeneratedPath(file.path)) throw new ProjectApiError(500, 'GENERATION_FAILED', 'The generated artifact could not be created.');
        return { content: file.content, archivePath: `${artifactName}/${file.path}` };
      });
      const zipPath = join(temporaryRoot, `${artifactName}.zip`);
      await this.archiver.archive(entries, zipPath);
      return { filename: `${artifactName}.zip`, temporaryRoot, zipPath };
    } catch (error) {
      await removeTemporaryRoot(temporaryRoot);
      if (error instanceof ProjectApiError) throw error;
      throw new ProjectApiError(422, 'GENERATION_VALIDATION_FAILED', 'The saved UML model cannot be generated.', {
        diagnostics: [{ code: 'OPENAPI_FETCH_FAILED', path: 'contract' }],
      });
    }
  }

  cleanup(download: FrontendGenerationDownload): Promise<void> {
    return removeTemporaryRoot(download.temporaryRoot);
  }
}
