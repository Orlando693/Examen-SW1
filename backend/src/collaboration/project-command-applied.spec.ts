import { describe, expect, it } from 'vitest';
import type { ProjectResource } from '@examen-sw1/uml-core';
import { digestProjectDocument } from './canonical-digest.js';
import { createAuthoritativeResourceSnapshot, createProjectCommandApplied } from './project-command-applied.js';

const id = '123e4567-e89b-42d3-a456-426614174000';
const resource: ProjectResource = { storageVersion: 7, documentSchemaVersion: 1, project: { id, metadata: { name: 'Project' }, revision: 4, timestamps: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' }, model: { packages: [], classes: [], enumerations: [], relationships: [] }, layout: { nodes: [] } } };
const normalized = { appliedAt: '2026-02-01T00:00:00.000Z', command: { type: 'CreateClass' as const, classId: '223e4567-e89b-42d3-a456-426614174000', name: 'Class' } };

describe('ProjectCommandApplied contracts', () => {
  it('derives authoritative result versions and digest without mutating inputs', () => {
    const before = JSON.stringify({ resource, normalized }); const result = createProjectCommandApplied({ projectId: id, sessionId: '323e4567-e89b-42d3-a456-426614174000', commandId: '423e4567-e89b-42d3-a456-426614174000', actorUserId: '523e4567-e89b-42d3-a456-426614174000', baseRealtimeVersion: 2, resultingRealtimeVersion: 3, baseRevision: 3, normalized, resultingResource: resource });
    expect(result).toMatchObject({ baseRealtimeVersion: 2, resultingRealtimeVersion: 3, baseRevision: 3, resultingRevision: 4, storageVersion: 7, appliedAt: normalized.appliedAt, normalizedCommand: normalized.command }); expect(result.resultingDocumentDigest).toBe(digestProjectDocument(resource.project)); expect(JSON.stringify({ resource, normalized })).toBe(before);
  });
  it('creates a full resource snapshot whose digest matches the applied result', () => {
    const snapshot = createAuthoritativeResourceSnapshot(resource); const applied = createProjectCommandApplied({ projectId: id, sessionId: '323e4567-e89b-42d3-a456-426614174000', commandId: '423e4567-e89b-42d3-a456-426614174000', actorUserId: '523e4567-e89b-42d3-a456-426614174000', baseRealtimeVersion: 0, resultingRealtimeVersion: 9, baseRevision: 0, normalized, resultingResource: resource });
    expect(snapshot.resource).toBe(resource); expect(snapshot.documentDigest).toBe(digestProjectDocument(resource.project)); expect(applied.resultingDocumentDigest).toBe(snapshot.documentDigest); expect(createAuthoritativeResourceSnapshot({ ...resource, project: { ...resource.project, revision: 5 } }).documentDigest).not.toBe(snapshot.documentDigest);
  });
});
