import type { ProjectResource } from '@examen-sw1/uml-core';
import { digestProjectDocument } from './canonical-digest.js';
import type { NormalizedRealtimeCommand } from './realtime-command-normalizer.js';

export interface ProjectCommandApplied {
  projectId: string;
  sessionId: string;
  commandId: string;
  actorUserId: string;
  baseRealtimeVersion: number;
  resultingRealtimeVersion: number;
  baseRevision: number;
  resultingRevision: number;
  storageVersion: number;
  appliedAt: string;
  normalizedCommand: NormalizedRealtimeCommand['command'];
  resultingDocumentDigest: string;
}

export interface AuthoritativeResourceSnapshot { resource: ProjectResource; documentDigest: string; }
export function createAuthoritativeResourceSnapshot(resource: ProjectResource): AuthoritativeResourceSnapshot { return { resource, documentDigest: digestProjectDocument(resource.project) }; }
export function createProjectCommandApplied(input: Omit<ProjectCommandApplied, 'resultingRevision' | 'storageVersion' | 'appliedAt' | 'normalizedCommand' | 'resultingDocumentDigest'> & { normalized: NormalizedRealtimeCommand; resultingResource: ProjectResource }): ProjectCommandApplied {
  const snapshot = createAuthoritativeResourceSnapshot(input.resultingResource);
  return { projectId: input.projectId, sessionId: input.sessionId, commandId: input.commandId, actorUserId: input.actorUserId, baseRealtimeVersion: input.baseRealtimeVersion, resultingRealtimeVersion: input.resultingRealtimeVersion, baseRevision: input.baseRevision, resultingRevision: snapshot.resource.project.revision, storageVersion: snapshot.resource.storageVersion, appliedAt: input.normalized.appliedAt, normalizedCommand: input.normalized.command, resultingDocumentDigest: snapshot.documentDigest };
}
