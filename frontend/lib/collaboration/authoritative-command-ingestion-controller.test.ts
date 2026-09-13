import { UmlCommandBus, type ProjectDocument, type ProjectResource } from '@examen-sw1/uml-core';
import { describe, expect, it, vi } from 'vitest';
import { createDemoProjectDocument } from '../editor/demo/demo-document';
import { sha256Canonical } from './canonical-digest';
import { APPLIED_EVENT_CAPACITY, AuthoritativeCommandIngestionController } from './authoritative-command-ingestion-controller';
import type { CollaborationSnapshot, ProjectCommandApplied } from './contracts';

function resource(): ProjectResource {
  return { project: createDemoProjectDocument(), storageVersion: 4, documentSchemaVersion: 1 };
}

async function snapshot(project: ProjectResource, realtimeVersion = 3, sessionId = 'session-a'): Promise<CollaborationSnapshot> {
  return { projectId: project.project.id, resource: project, sessionId, realtimeVersion, accessLevel: 'OWNER', documentDigest: await sha256Canonical(project.project), participants: [] };
}

async function applied(project: ProjectResource, overrides: Partial<ProjectCommandApplied> = {}): Promise<ProjectCommandApplied> {
  const command = overrides.normalizedCommand ?? { type: 'RenameClass', classId: 'class-customer', name: 'Client' };
  const executed = new UmlCommandBus().execute(project.project, command, { now: '2026-09-13T00:00:00.000Z' });
  if (!executed.ok) throw new Error('Fixture command must execute.');
  return {
    projectId: project.project.id,
    sessionId: 'session-a',
    commandId: 'command-a',
    actorUserId: 'server-user',
    baseRealtimeVersion: 3,
    resultingRealtimeVersion: 4,
    baseRevision: project.project.revision,
    resultingRevision: executed.document.revision,
    storageVersion: 5,
    appliedAt: '2026-09-13T00:00:00.000Z',
    normalizedCommand: command,
    resultingDocumentDigest: await sha256Canonical(executed.document),
    ...overrides,
  } as ProjectCommandApplied;
}

describe('AuthoritativeCommandIngestionController', () => {
  it('applies NEXT exactly once with the server-normalized ID and exposes resulting metadata', async () => {
    const initial = resource();
    const onApplied = vi.fn();
    const controller = new AuthoritativeCommandIngestionController({ onApplied });
    await controller.installSnapshot(7, await snapshot(initial));
    const result = await controller.ingest(7, await applied(initial, {
      normalizedCommand: { type: 'CreateClass', classId: 'server-class-id', name: 'Server selected' },
    }));

    expect(result).toMatchObject({ classification: 'NEXT', applied: true, baseline: { realtimeVersion: 4, storageVersion: 5, revision: initial.project.revision + 1 } });
    expect(result.baseline?.resource.project.model.classes.at(-1)).toMatchObject({ id: 'server-class-id', name: 'Server selected' });
    expect(onApplied).toHaveBeenCalledOnce();
    await expect(controller.ingest(7, await applied(initial, { normalizedCommand: { type: 'CreateClass', classId: 'server-class-id', name: 'Server selected' } }))).resolves.toMatchObject({ classification: 'OLD', applied: false });
    expect(onApplied).toHaveBeenCalledOnce();
  });

  it('replays MoveNode and ApplyLayout with authoritative layout data without feedback', async () => {
    const initial = resource();
    const onApplied = vi.fn();
    const controller = new AuthoritativeCommandIngestionController({ onApplied });
    await controller.installSnapshot(7, await snapshot(initial));
    const move = await applied(initial, { normalizedCommand: { type: 'MoveNode', elementId: 'class-customer', nodeId: 'server-node', position: { x: 40, y: 50 } } });
    await controller.ingest(7, move);
    const moved = controller.currentBaseline!.resource;
    const layout = await applied(moved, {
      commandId: 'command-layout', baseRealtimeVersion: 4, resultingRealtimeVersion: 5, baseRevision: moved.project.revision,
      normalizedCommand: { type: 'ApplyLayout', updates: [{ elementId: 'class-customer', nodeId: 'server-node', position: { x: 80, y: 90 } }] },
    });
    await expect(controller.ingest(7, layout)).resolves.toMatchObject({ classification: 'NEXT', applied: true });
    expect(controller.currentBaseline!.resource.project.layout.nodes.find((node) => node.elementId === 'class-customer')?.position).toEqual({ x: 80, y: 90 });
    expect(onApplied).toHaveBeenCalledTimes(2);
  });

  it('classifies OLD, GAP, DIFFERENT_SESSION, STALE_GENERATION, and MISMATCH with one recovery callback', async () => {
    const initial = resource();
    const recover = vi.fn();
    const controller = new AuthoritativeCommandIngestionController({ onRecoveryRequired: recover });
    await controller.installSnapshot(7, await snapshot(initial));
    const next = await applied(initial);
    await controller.ingest(7, next);
    await expect(controller.ingest(7, next)).resolves.toMatchObject({ classification: 'OLD' });
    await expect(controller.ingest(6, next)).resolves.toMatchObject({ classification: 'STALE_GENERATION' });
    await expect(controller.ingest(7, { ...next, commandId: 'other-session', sessionId: 'session-b' })).resolves.toMatchObject({ classification: 'DIFFERENT_SESSION', recoveryRequested: true });
    await expect(controller.ingest(7, { ...next, commandId: 'gap', baseRealtimeVersion: 5, resultingRealtimeVersion: 6 })).resolves.toMatchObject({ classification: 'GAP', recoveryRequested: false });
    await expect(controller.ingest(7, { ...next, commandId: 'mismatch', baseRealtimeVersion: 4, resultingRealtimeVersion: 5, baseRevision: 99, resultingRevision: 100 })).resolves.toMatchObject({ classification: 'MISMATCH', recoveryRequested: false });
    expect(recover).toHaveBeenCalledOnce();
  });

  it('serializes asynchronous digest work, bounds retained IDs, and drops callbacks after a generation replacement', async () => {
    const initial = resource();
    let releaseDigest: (() => void) | undefined;
    let blockDigest = false;
    const controller = new AuthoritativeCommandIngestionController({
      digest: async (document: ProjectDocument) => {
        if (blockDigest) await new Promise<void>((resolve) => { releaseDigest = resolve; });
        return sha256Canonical(document);
      },
    });
    await controller.installSnapshot(7, await snapshot(initial));
    const first = await applied(initial);
    blockDigest = true;
    const pending = controller.ingest(7, first);
    await vi.waitFor(() => expect(releaseDigest).toBeTypeOf('function'));
    controller.clear(8);
    blockDigest = false;
    releaseDigest!();
    releaseDigest = undefined;
    const replacement = resource();
    replacement.project.id = initial.project.id;
    const install = controller.recoverFromSnapshot(8, await snapshot(replacement, 0, 'session-b'));
    await expect(pending).resolves.toMatchObject({ classification: 'STALE_GENERATION' });
    await expect(install).resolves.toMatchObject({ baseline: { generation: 8, sessionId: 'session-b' } });
    expect(APPLIED_EVENT_CAPACITY).toBe(128);
  });
});
