import { describe, expect, it } from 'vitest';
import { CollaborationSessionBridge, JOIN_BUFFER_CAPACITY, type CollaborationSessionClient } from './collaboration-session-bridge';
import type { CollaborationAck, CollaborationSnapshot } from './contracts';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; }); return { promise, resolve }; }
function snapshot(projectId: string, sessionId: string, realtimeVersion: number): CollaborationSnapshot { return { projectId, sessionId, realtimeVersion, accessLevel: 'OWNER', documentDigest: null, participants: [], resource: { project: { id: projectId, revision: 7 } as never, storageVersion: 4 } as never }; }

describe('CollaborationSessionBridge', () => {
  it('installs a successful authoritative join and captures session metadata', async () => {
    const client: CollaborationSessionClient = { joinProject: async () => ({ ok: true, data: snapshot('project-a', 'session-a', 3) }), resync: async () => ({ ok: false, error: { code: 'PROJECT_NOT_JOINED', message: '' }, action: 'LEAVE' }) };
    const installed: string[] = []; const bridge = new CollaborationSessionBridge(client, (resource) => installed.push(resource.project.id));
    await expect(bridge.join('project-a')).resolves.toMatchObject({ applied: true }); expect(installed).toHaveLength(1); expect(bridge.session).toMatchObject({ projectId: 'project-a', sessionId: 'session-a', realtimeVersion: 3, storageVersion: 4, revision: 7 });
  });

  it('ignores a stale join after a project switch', async () => {
    const a = deferred<CollaborationAck<CollaborationSnapshot>>(); const b = deferred<CollaborationAck<CollaborationSnapshot>>();
    const client: CollaborationSessionClient = { joinProject: (projectId) => projectId === 'project-a' ? a.promise : b.promise, resync: async () => ({ ok: false, error: { code: 'PROJECT_NOT_JOINED', message: '' }, action: 'LEAVE' }) };
    const installed: string[] = []; const bridge = new CollaborationSessionBridge(client, (resource) => installed.push(resource.project.id));
    const joinA = bridge.join('project-a'); const joinB = bridge.join('project-b'); b.resolve({ ok: true, data: snapshot('project-b', 'session-b', 2) }); await joinB; a.resolve({ ok: true, data: snapshot('project-a', 'session-a', 1) }); await expect(joinA).resolves.toMatchObject({ applied: false }); expect(installed).toEqual(['project-b']); expect(bridge.session).toMatchObject({ projectId: 'project-b', sessionId: 'session-b' });
  });

  it('installs current resync snapshots and ignores stale resync after clear', async () => {
    const pendingResync = deferred<CollaborationAck<CollaborationSnapshot>>();
    let resyncCount = 0;
    const client: CollaborationSessionClient = { joinProject: async () => ({ ok: true, data: snapshot('project-a', 'session-a', 1) }), resync: () => ++resyncCount === 1 ? Promise.resolve({ ok: true, data: snapshot('project-a', 'session-b', 2) }) : pendingResync.promise };
    const installed: string[] = []; const bridge = new CollaborationSessionBridge(client, (resource) => installed.push(resource.project.id));
    await bridge.join('project-a'); await expect(bridge.resync()).resolves.toMatchObject({ applied: true }); expect(bridge.session).toMatchObject({ sessionId: 'session-b', realtimeVersion: 2 });
    const resync = bridge.resync(); bridge.clear(); pendingResync.resolve({ ok: true, data: snapshot('project-a', 'session-c', 3) }); await expect(resync).resolves.toMatchObject({ applied: false }); expect(installed).toEqual(['project-a', 'project-a']); expect(bridge.session).toBeNull();
  });

  it('buffers project presence until the join snapshot installs, then replays FIFO', async () => {
    const pending = deferred<CollaborationAck<CollaborationSnapshot>>(); const client: CollaborationSessionClient = { joinProject: () => pending.promise, resync: async () => ({ ok: false, error: { code: 'PROJECT_NOT_JOINED', message: '' }, action: 'LEAVE' }) }; const roster: string[] = []; const bridge = new CollaborationSessionBridge(client, () => undefined, (_projectId, participants) => roster.push(participants[0]?.userId ?? 'snapshot'));
    const join = bridge.join('project-a'); expect(bridge.receivePresence('project-a', [{ userId: 'first' } as never])).toBe('BUFFERED'); expect(roster).toEqual([]); expect(bridge.receivePresence('project-a', [{ userId: 'second' } as never])).toBe('BUFFERED'); pending.resolve({ ok: true, data: snapshot('project-a', 'session-a', 0) }); await join; expect(roster).toEqual(['snapshot', 'first', 'second']); expect(bridge.receivePresence('project-a', [{ userId: 'live' } as never])).toBe('APPLIED');
  });

  it('discards pending buffers on switch, failure, and clear while bounding capacity', async () => {
    const pending = deferred<CollaborationAck<CollaborationSnapshot>>(); const client: CollaborationSessionClient = { joinProject: () => pending.promise, resync: async () => ({ ok: false, error: { code: 'PROJECT_NOT_JOINED', message: '' }, action: 'LEAVE' }) }; const bridge = new CollaborationSessionBridge(client, () => undefined); const join = bridge.join('project-a'); for (let index = 0; index < JOIN_BUFFER_CAPACITY; index += 1) expect(bridge.receivePresence('project-a', [])).toBe('BUFFERED'); expect(bridge.receivePresence('project-a', [])).toBe('OVERFLOW'); bridge.clear(); pending.resolve({ ok: false, error: { code: 'PROJECT_NOT_FOUND', message: '' }, action: 'LEAVE' }); await expect(join).resolves.toMatchObject({ applied: false }); expect(bridge.receivePresence('project-a', [])).toBe('IGNORED');
  });

  it('recovers an overflowed current join with one authoritative resync and no partial replay', async () => {
    const joined = deferred<CollaborationAck<CollaborationSnapshot>>(); const recovered = deferred<CollaborationAck<CollaborationSnapshot>>(); let resyncCalls = 0; const installed: string[] = []; const roster: string[] = [];
    const client: CollaborationSessionClient = { joinProject: () => joined.promise, resync: () => { resyncCalls += 1; return recovered.promise; } }; const bridge = new CollaborationSessionBridge(client, (resource) => installed.push(resource.project.id), (_projectId, participants) => roster.push(participants[0]?.userId ?? 'snapshot'));
    const join = bridge.join('project-a'); for (let index = 0; index < JOIN_BUFFER_CAPACITY; index += 1) bridge.receivePresence('project-a', [{ userId: `old-${index}` } as never]); expect(bridge.receivePresence('project-a', [])).toBe('OVERFLOW'); bridge.receivePresence('project-a', []);
    joined.resolve({ ok: true, data: snapshot('project-a', 'join', 0) }); recovered.resolve({ ok: true, data: snapshot('project-a', 'resync', 1) }); await join;
    expect(resyncCalls).toBe(1); expect(installed).toEqual(['project-a', 'project-a']); expect(roster).toEqual(['snapshot', 'snapshot']); expect(bridge.receivePresence('project-a', [{ userId: 'live' } as never])).toBe('APPLIED');
  });
});
