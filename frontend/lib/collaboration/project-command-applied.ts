import type { ProjectCommandApplied } from './contracts';

export function isProjectCommandApplied(value: unknown): value is ProjectCommandApplied {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<ProjectCommandApplied>;
  return typeof event.projectId === 'string'
    && typeof event.sessionId === 'string'
    && typeof event.commandId === 'string'
    && typeof event.actorUserId === 'string'
    && Number.isSafeInteger(event.baseRealtimeVersion)
    && Number.isSafeInteger(event.resultingRealtimeVersion)
    && Number.isSafeInteger(event.baseRevision)
    && Number.isSafeInteger(event.resultingRevision)
    && Number.isSafeInteger(event.storageVersion)
    && typeof event.appliedAt === 'string'
    && typeof event.normalizedCommand === 'object'
    && event.normalizedCommand !== null
    && typeof event.resultingDocumentDigest === 'string';
}
