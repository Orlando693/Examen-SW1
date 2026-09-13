import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';
import { CollaborationGateway } from './collaboration.gateway.js';
import type { CollaborationService } from './collaboration.service.js';
import type { CollaborationSnapshot } from './contracts.js';
import { PRESENCE_BURST_CAPACITY, PresenceRateLimiter } from './presence-rate-limiter.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

describe('CollaborationGateway lifecycle generation', () => {
  afterEach(() => vi.useRealTimers());
  it('does not restore a stale join after leave', async () => {
    const pending = deferred<CollaborationSnapshot>();
    const started = deferred<void>();
    let joinStarted = false; let staleCleanup = false;
    const service = {
      join: async () => { joinStarted = true; started.resolve(); return pending.promise; },
      leave: () => { staleCleanup = true; },
    } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({ revalidate: async () => ({ id: 'user-a', email: 'user@example.com' }) } as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<unknown[]> } } }).server = { in: () => ({ fetchSockets: async () => [] }) };
    const socket = {
      id: 'socket-a', connected: true, data: { collaboration: { lifecycleGeneration: 0, activeProjectId: null, activeSessionId: null, user: { id: 'user-a', email: 'user@example.com' }, expiresAt: Date.now() + 60_000, expirationTimer: null, presenceWindowStartedAt: Date.now(), presenceCount: 0 } },
      join: async () => undefined, leave: async () => undefined, emit: () => undefined,
    } as unknown as Socket;
    const joinPromise = gateway.join(socket, { projectId: 'project-a' });
    await started.promise; expect(joinStarted).toBe(true);
    await gateway.leaveEvent(socket);
    const state = socket.data.collaboration as { activeProjectId: string | null };
    expect(state.activeProjectId).toBeNull();
    pending.resolve({ projectId: 'project-a', resource: {} as CollaborationSnapshot['resource'], sessionId: 'session-a', realtimeVersion: 0, accessLevel: 'OWNER', documentDigest: null, participants: [] });
    const result = await joinPromise;
    expect(result).toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_JOINED' } });
    expect(state.activeProjectId).toBeNull(); expect(staleCleanup).toBe(true);
  });

  it('does not let a stale join overwrite a newer project', async () => {
    const pendingA = deferred<CollaborationSnapshot>(); const startedA = deferred<void>();
    const service = {
      join: async (projectId: string) => {
        if (projectId === 'project-a') { startedA.resolve(); return pendingA.promise; }
        return { projectId: 'project-b', resource: {} as CollaborationSnapshot['resource'], sessionId: 'session-b', realtimeVersion: 0, accessLevel: 'OWNER' as const, documentDigest: null, participants: [] };
      },
      leave: () => undefined,
    } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({ revalidate: async () => ({ id: 'user-a', email: 'user@example.com' }) } as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<unknown[]> } } }).server = { in: () => ({ fetchSockets: async () => [] }) };
    const socket = { id: 'socket-a', connected: true, data: { collaboration: { lifecycleGeneration: 0, activeProjectId: null, activeSessionId: null, user: { id: 'user-a', email: 'user@example.com' }, expiresAt: Date.now() + 60_000, expirationTimer: null, presenceWindowStartedAt: Date.now(), presenceCount: 0 } }, join: async () => undefined, leave: async () => undefined, emit: () => undefined } as unknown as Socket;
    const joinA = gateway.join(socket, { projectId: 'project-a' }); await startedA.promise;
    const joinB = await gateway.join(socket, { projectId: 'project-b' }); expect(joinB.ok).toBe(true);
    const state = socket.data.collaboration as { activeProjectId: string | null; activeSessionId: string | null };
    expect(state.activeProjectId).toBe('project-b'); expect(state.activeSessionId).toBe('session-b');
    pendingA.resolve({ projectId: 'project-a', resource: {} as CollaborationSnapshot['resource'], sessionId: 'session-a', realtimeVersion: 0, accessLevel: 'OWNER', documentDigest: null, participants: [] });
    expect(await joinA).toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_JOINED' } });
    expect(state.activeProjectId).toBe('project-b'); expect(state.activeSessionId).toBe('session-b');
  });

  it('skips protected emission to an expired recipient', async () => {
    const emitted: string[] = [];
    const recipient = { id: 'socket-a', connected: true, data: { collaboration: { user: { id: 'user-a', email: 'user@example.com' }, expiresAt: Date.now() - 1 } }, emit: (event: string) => emitted.push(event), disconnect: () => undefined } as unknown as Socket;
    const service = { revalidate: async () => undefined, leave: () => undefined } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({ revalidate: async () => { throw new Error('expired'); } } as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<Socket[]>; socketsLeave: (room: string) => void } } }).server = { in: () => ({ fetchSockets: async () => [recipient], socketsLeave: () => undefined }) };
    await (gateway as unknown as { emitProtected: (projectId: string, event: string, payload: unknown) => Promise<void> }).emitProtected('project-a', 'project:presence', { protected: true });
    expect(emitted).not.toContain('project:presence');
  });

  it('rechecks current project access before protected emission', async () => {
    const revokedEvents: string[] = []; const ownerEvents: string[] = [];
    const revoked = { id: 'editor-socket', connected: true, data: { collaboration: { user: { id: 'editor', email: 'editor@example.com' }, expiresAt: Date.now() + 60_000 } }, emit: (event: string) => revokedEvents.push(event), disconnect: () => undefined } as unknown as Socket;
    const owner = { id: 'owner-socket', connected: true, data: { collaboration: { user: { id: 'owner', email: 'owner@example.com' }, expiresAt: Date.now() + 60_000 } }, emit: (event: string) => ownerEvents.push(event), disconnect: () => undefined } as unknown as Socket;
    const service = { revalidate: async (_projectId: string, user: { id: string }) => { if (user.id === 'editor') throw new Error('revoked'); }, leave: () => undefined } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({ revalidate: async (user: { id: string }) => user } as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<Socket[]>; socketsLeave: (room: string) => void } } }).server = { in: () => ({ fetchSockets: async () => [revoked, owner], socketsLeave: () => undefined }) };
    await (gateway as unknown as { emitProtected: (projectId: string, event: string, payload: unknown) => Promise<void> }).emitProtected('project-a', 'project:presence', { protected: true });
    expect(revokedEvents).not.toContain('project:presence'); expect(ownerEvents).toContain('project:presence');
  });

  it('broadcasts presence only to sockets in the active project room', async () => {
    const events = new Map<string, string[]>();
    const socket = (id: string, projectId: string) => {
      const received: string[] = []; events.set(id, received);
      return { id, connected: true, data: { collaboration: { activeProjectId: projectId, user: { id, email: `${id}@example.com` }, expiresAt: Date.now() + 60_000 } }, emit: (event: string) => received.push(event), disconnect: () => undefined } as unknown as Socket;
    };
    const a1 = socket('a1', 'project-a'); const a2 = socket('a2', 'project-a'); const b1 = socket('b1', 'project-b'); const updated: string[] = [];
    const service = { updatePresence: async (projectId: string) => { updated.push(projectId); return []; }, revalidate: async () => undefined, leave: () => undefined } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({ revalidate: async (user: { id: string }) => user } as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<Socket[]>; socketsLeave: () => void } } }).server = { in: (room) => ({ fetchSockets: async () => room === 'project:project-a' ? [a1, a2] : [b1], socketsLeave: () => undefined }) };
    const presence = { cursor: { x: 0, y: 0 }, selectionIds: [], editingElementId: null, activity: null };
    expect((await gateway.presence(a1, presence)).ok).toBe(true);
    expect(events.get('a2')).toContain('project:presence'); expect(events.get('b1')).not.toContain('project:presence');
    events.get('a1')?.splice(0); events.get('a2')?.splice(0); events.get('b1')?.splice(0);
    expect((await gateway.presence(b1, presence)).ok).toBe(true);
    expect(events.get('b1')).toContain('project:presence'); expect(events.get('a1')).not.toContain('project:presence'); expect(events.get('a2')).not.toContain('project:presence'); expect(updated).toEqual(['project-a', 'project-b']);
  });

  it('cancels the expiry timer when a socket disconnects first', async () => {
    vi.useFakeTimers(); let disconnects = 0;
    const gateway = new CollaborationGateway({} as never, { leave: () => undefined } as unknown as CollaborationService);
    const socket = { id: 'socket-a', connected: true, data: { collaborationAuthentication: { user: { id: 'user-a', email: 'user@example.com' }, expiresAt: Date.now() + 1_000 } }, emit: () => undefined, disconnect: () => { disconnects += 1; } } as unknown as Socket;
    await gateway.handleConnection(socket);
    const state = socket.data.collaboration as { expirationTimer: NodeJS.Timeout | null };
    expect(state.expirationTimer).not.toBeNull();
    socket.connected = false; gateway.handleDisconnect(socket);
    vi.advanceTimersByTime(1_000);
    expect(disconnects).toBe(0); expect(state.expirationTimer).not.toBeNull();
  });

  it('keeps cleanup idempotent when disconnect follows expiry', async () => {
    vi.useFakeTimers(); let leaves = 0;
    const gateway = new CollaborationGateway({} as never, { leave: () => { leaves += 1; }, roster: async () => [] } as unknown as CollaborationService);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<unknown[]> } } }).server = { in: () => ({ fetchSockets: async () => [] }) };
    const socket = { id: 'socket-a', connected: true, data: { collaborationAuthentication: { user: { id: 'user-a', email: 'user@example.com' }, expiresAt: Date.now() + 1_000 } }, emit: () => undefined, disconnect: () => { socket.connected = false; }, leave: async () => undefined } as unknown as Socket;
    await gateway.handleConnection(socket);
    const state = socket.data.collaboration as { activeProjectId: string | null; activeSessionId: string | null };
    state.activeProjectId = 'project-a'; state.activeSessionId = 'session-a';
    await vi.advanceTimersByTimeAsync(1_000);
    expect(state.activeProjectId).toBeNull(); expect(leaves).toBe(1);
    gateway.handleDisconnect(socket);
    expect(leaves).toBe(1); expect(state.activeProjectId).toBeNull();
  });

  it('rejects a NaN cursor x without replacing the last valid presence', async () => {
    const updates: Array<{ cursor: { x: number; y: number } | null }> = [];
    const service = { updatePresence: async (_projectId: string, _socketId: string, _user: unknown, input: { cursor: { x: number; y: number } | null }) => { updates.push({ cursor: input.cursor }); return []; } } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({} as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<unknown[]> } } }).server = { in: () => ({ fetchSockets: async () => [] }) };
    const socket = { id: 'socket-a', data: { collaboration: { activeProjectId: 'project-a', user: { id: 'user-a', email: 'user@example.com' }, presenceWindowStartedAt: Date.now(), presenceCount: 0 } } } as unknown as Socket;
    const valid = { cursor: { x: 10, y: 20 }, selectionIds: [], editingElementId: null, activity: null };
    expect(await gateway.presence(socket, valid)).toMatchObject({ ok: true });
    const invalid = { ...valid, cursor: { x: Number.NaN, y: 20 } };
    expect(await gateway.presence(socket, invalid)).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(updates).toEqual([{ cursor: { x: 10, y: 20 } }]);
  });

  it('rejects a NaN cursor y without replacing the last valid presence', async () => {
    const updates: Array<{ cursor: { x: number; y: number } | null }> = [];
    const service = { updatePresence: async (_projectId: string, _socketId: string, _user: unknown, input: { cursor: { x: number; y: number } | null }) => { updates.push({ cursor: input.cursor }); return []; } } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({} as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<unknown[]> } } }).server = { in: () => ({ fetchSockets: async () => [] }) };
    const socket = { id: 'socket-a', data: { collaboration: { activeProjectId: 'project-a', user: { id: 'user-a', email: 'user@example.com' }, presenceWindowStartedAt: Date.now(), presenceCount: 0 } } } as unknown as Socket;
    const valid = { cursor: { x: 10, y: 20 }, selectionIds: [], editingElementId: null, activity: null };
    expect(await gateway.presence(socket, valid)).toMatchObject({ ok: true });
    expect(await gateway.presence(socket, { ...valid, cursor: { x: 10, y: Number.NaN } })).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(updates).toEqual([{ cursor: { x: 10, y: 20 } }]);
  });

  it('rejects infinite cursor coordinates without replacing valid presence', async () => {
    const updates: Array<{ cursor: { x: number; y: number } | null }> = [];
    const service = { updatePresence: async (_projectId: string, _socketId: string, _user: unknown, input: { cursor: { x: number; y: number } | null }) => { updates.push({ cursor: input.cursor }); return []; } } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({} as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<unknown[]> } } }).server = { in: () => ({ fetchSockets: async () => [] }) };
    const socket = { id: 'socket-a', data: { collaboration: { activeProjectId: 'project-a', user: { id: 'user-a', email: 'user@example.com' }, presenceWindowStartedAt: Date.now(), presenceCount: 0 } } } as unknown as Socket;
    const valid = { cursor: { x: 10, y: 20 }, selectionIds: [], editingElementId: null, activity: null };
    expect(await gateway.presence(socket, valid)).toMatchObject({ ok: true });
    for (const cursor of [{ x: Infinity, y: 20 }, { x: -Infinity, y: 20 }, { x: 10, y: Infinity }, { x: 10, y: -Infinity }]) expect(await gateway.presence(socket, { ...valid, cursor })).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(updates).toEqual([{ cursor: { x: 10, y: 20 } }]);
  });

  it('accepts the selection limit and rejects one additional selection', async () => {
    const updates: Array<{ selectionIds: string[] }> = [];
    const service = { updatePresence: async (_projectId: string, _socketId: string, _user: unknown, input: { selectionIds: string[] }) => { updates.push({ selectionIds: input.selectionIds }); return []; } } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({} as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<unknown[]> } } }).server = { in: () => ({ fetchSockets: async () => [] }) };
    const socket = { id: 'socket-a', data: { collaboration: { activeProjectId: 'project-a', user: { id: 'user-a', email: 'user@example.com' }, presenceWindowStartedAt: Date.now(), presenceCount: 0 } } } as unknown as Socket;
    const maximum = Array.from({ length: 50 }, (_, index) => `element-${index}`);
    const valid = { cursor: null, selectionIds: maximum, editingElementId: null, activity: null };
    expect(await gateway.presence(socket, valid)).toMatchObject({ ok: true });
    expect(await gateway.presence(socket, { ...valid, selectionIds: [...maximum, 'element-50'] })).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(updates).toEqual([{ selectionIds: maximum }]);
  });

  it('rejects malformed selection entries without replacing valid selection', async () => {
    const updates: Array<{ selectionIds: string[] }> = [];
    const service = { updatePresence: async (_projectId: string, _socketId: string, _user: unknown, input: { selectionIds: string[] }) => { updates.push({ selectionIds: input.selectionIds }); return []; } } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({} as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<unknown[]> } } }).server = { in: () => ({ fetchSockets: async () => [] }) };
    const socket = { id: 'socket-a', data: { collaboration: { activeProjectId: 'project-a', user: { id: 'user-a', email: 'user@example.com' }, presenceWindowStartedAt: Date.now(), presenceCount: 0 } } } as unknown as Socket;
    const valid = { cursor: null, selectionIds: ['class-1', 'relationship-1'], editingElementId: null, activity: null };
    expect(await gateway.presence(socket, valid)).toMatchObject({ ok: true });
    const invalidPayloads: unknown[] = [{ ...valid, selectionIds: ['class-1', 123] }, { ...valid, selectionIds: ['class-1', null] }, { ...valid, selectionIds: ['class-1', { id: 'class-2' }] }, { ...valid, selectionIds: 'class-1' }];
    for (const payload of invalidPayloads) expect(await gateway.presence(socket, payload)).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(updates).toEqual([{ selectionIds: ['class-1', 'relationship-1'] }]);
  });

  it('rejects an unknown activity without replacing valid activity', async () => {
    const updates: Array<{ activity: string | null }> = [];
    const service = { updatePresence: async (_projectId: string, _socketId: string, _user: unknown, input: { activity: string | null }) => { updates.push({ activity: input.activity }); return []; } } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({} as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<unknown[]> } } }).server = { in: () => ({ fetchSockets: async () => [] }) };
    const socket = { id: 'socket-a', data: { collaboration: { activeProjectId: 'project-a', user: { id: 'user-a', email: 'user@example.com' }, presenceWindowStartedAt: Date.now(), presenceCount: 0 } } } as unknown as Socket;
    const valid = { cursor: null, selectionIds: [], editingElementId: null, activity: 'dragging' };
    expect(await gateway.presence(socket, valid)).toMatchObject({ ok: true });
    expect(await gateway.presence(socket, { ...valid, activity: 'totally-invalid-activity' })).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(await gateway.presence(socket, { ...valid, activity: null })).toMatchObject({ ok: true });
    expect(updates).toEqual([{ activity: 'dragging' }, { activity: null }]);
  });

  it('accepts the editing identifier limit and rejects one additional character', async () => {
    const updates: Array<{ editingElementId: string | null }> = [];
    const service = { updatePresence: async (_projectId: string, _socketId: string, _user: unknown, input: { editingElementId: string | null }) => { updates.push({ editingElementId: input.editingElementId }); return []; } } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({} as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<unknown[]> } } }).server = { in: () => ({ fetchSockets: async () => [] }) };
    const socket = { id: 'socket-a', data: { collaboration: { activeProjectId: 'project-a', user: { id: 'user-a', email: 'user@example.com' }, presenceWindowStartedAt: Date.now(), presenceCount: 0 } } } as unknown as Socket;
    const valid = { cursor: null, selectionIds: [], editingElementId: 'class-1', activity: null };
    const boundary = 'x'.repeat(64);
    expect(await gateway.presence(socket, valid)).toMatchObject({ ok: true });
    expect(await gateway.presence(socket, { ...valid, editingElementId: boundary })).toMatchObject({ ok: true });
    expect(await gateway.presence(socket, { ...valid, editingElementId: `${boundary}x` })).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(await gateway.presence(socket, { ...valid, editingElementId: null })).toMatchObject({ ok: true });
    expect(updates).toEqual([{ editingElementId: 'class-1' }, { editingElementId: boundary }, { editingElementId: null }]);
  });

  it('limits presence per socket after valid payload validation', async () => {
    let updates = 0;
    const service = { updatePresence: async () => { updates += 1; return []; } } as unknown as CollaborationService;
    const gateway = new CollaborationGateway({} as never, service);
    (gateway as unknown as { server: { in: (room: string) => { fetchSockets: () => Promise<unknown[]> } } }).server = { in: () => ({ fetchSockets: async () => [] }) };
    const state = () => ({ activeProjectId: 'project-a', user: { id: 'user-a', email: 'user@example.com' }, presenceWindowStartedAt: Date.now(), presenceCount: 0 });
    const socket1 = { id: 'socket-1', data: { collaboration: state() } } as unknown as Socket;
    const socket2 = { id: 'socket-2', data: { collaboration: state() } } as unknown as Socket;
    const payload = { cursor: null, selectionIds: [], editingElementId: null, activity: null };
    for (let index = 0; index < 5; index += 1) expect(await gateway.presence(socket1, payload)).toMatchObject({ ok: true });
    expect(await gateway.presence(socket1, payload)).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
    expect(await gateway.presence(socket2, payload)).toMatchObject({ ok: true });
    expect(updates).toBe(6);
  });

  it('removes the rate-limit bucket using the disconnecting socket id', () => {
    const limiter = new PresenceRateLimiter();
    for (let index = 0; index < PRESENCE_BURST_CAPACITY; index += 1) limiter.allow('socket-1', 0);
    const gateway = new CollaborationGateway({} as never, {} as never, limiter);
    const socket = { id: 'socket-1', connected: false, data: {} } as unknown as Socket;
    gateway.handleDisconnect(socket);
    expect(limiter.allow('socket-1', 0)).toBe(true);
  });
});
