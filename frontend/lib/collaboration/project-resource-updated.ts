import type { ProjectResourceUpdated } from './contracts';

export function isProjectResourceUpdated(value: unknown): value is ProjectResourceUpdated {
  if (!value || typeof value !== 'object') return false;
  const update = value as Partial<ProjectResourceUpdated>;
  return typeof update.projectId === 'string' && typeof update.sessionId === 'string' && typeof update.documentDigest === 'string' && !!update.resource && typeof update.resource === 'object';
}
