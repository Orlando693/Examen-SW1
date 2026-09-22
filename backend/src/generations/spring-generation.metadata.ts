import { ProjectApiError } from '../projects/project.errors.js';

export interface SpringGenerationMetadata {
  artifactName: string;
  basePackage: string;
  databaseName: string;
}

const MAX_PROJECT_NAME_LENGTH = 120;

function metadataError(): never {
  throw new ProjectApiError(422, 'GENERATION_VALIDATION_FAILED', 'The project metadata cannot be used for Spring generation.', {
    diagnostics: [{ code: 'INVALID_GENERATION_METADATA', path: 'project.metadata.name' }],
  });
}

export function deriveSpringGenerationMetadata(project: { id: string; metadata: { name: string } }): SpringGenerationMetadata {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(project.id)) metadataError();
  const name = project.metadata.name.trim();
  if (name.length === 0 || name.length > MAX_PROJECT_NAME_LENGTH) metadataError();
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug.length === 0) metadataError();
  const safeSlug = `${/^[a-z]/.test(slug) ? '' : 'project-'}${slug}`.slice(0, 48).replace(/-+$/g, '');
  const idFragment = project.id.replaceAll('-', '').slice(0, 12).toLowerCase();
  return {
    artifactName: `${safeSlug}-${idFragment}`,
    basePackage: `com.generated.${safeSlug.replaceAll('-', '_')}_${idFragment}`,
    databaseName: `generated_${safeSlug.replaceAll('-', '_')}_${idFragment}`,
  };
}
