import { describe, expect, it } from 'vitest';
import { CollaborationClient } from './collaboration-client';

type Listener = (...args: never[]) => void;

class MockSocket {
  readonly listeners = new Map<string, Set<Listener>>();
  readonly emitted: { event: string; args: unknown[] }[] = [];
  disconnects = 0;
  connected = true;
  on(event: string, listener: Listener): this { const listeners = this.listeners.get(event) ?? new Set<Listener>(); listeners.add(listener); this.listeners.set(event, listeners); return this; }
  off(event: string, listener: Listener): this { this.listeners.get(event)?.delete(listener); return this; }
  emit(event: string, ...args: unknown[]): this { this.emitted.push({ event, args }); return this; }
  disconnect(): this { this.disconnects += 1; return this; }
  acknowledge<T>(event: string, ack: T): void { const emitted = this.emitted.find((entry) => entry.event === event); (emitted?.args.at(-1) as ((value: T) => void) | undefined)?.(ack); }
}

function setup() { const sockets: MockSocket[] = []; const calls: { url: string; options: unknown }[] = []; const client = new CollaborationClient((url, options) => { calls.push({ url, options }); const socket = new MockSocket(); sockets.push(socket); return socket; }, 'http://realtime.test'); return { client, sockets, calls }; }

describe('CollaborationClient', () => {
  it('uses namespace auth transport without a token query parameter', () => {
    const { client, sockets, calls } = setup(); client.connect('access-token');
    expect(sockets).toHaveLength(1); expect(calls).toEqual([{ url: 'http://realtime.test/collaboration', options: { auth: { token: 'access-token' }, transports: ['websocket'] } }]); expect(calls[0]?.url).not.toContain('?');
  });

  it('joins, leaves, and tracks the active project using gateway events', async () => {
    const { client, sockets } = setup(); client.connect('token'); const socket = sockets[0]!;
    const join = client.joinProject('project-a'); expect(socket.emitted[0]?.event).toBe('project:join'); expect(socket.emitted[0]?.args[0]).toEqual({ projectId: 'project-a' });
    socket.acknowledge('project:join', { ok: true, data: { projectId: 'project-a' } }); await join; expect(client.activeProjectId).toBe('project-a');
    const leave = client.leaveProject(); expect(socket.emitted[1]?.event).toBe('project:leave'); socket.acknowledge('project:leave', { ok: true, data: { left: true } }); await leave; expect(client.activeProjectId).toBeNull();
  });

  it('resyncs only while a project is active', async () => {
    const { client, sockets } = setup(); client.connect('token');
    await expect(client.resync()).resolves.toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_JOINED' } });
    const join = client.joinProject('project-a'); sockets[0]!.acknowledge('project:join', { ok: true, data: { projectId: 'project-a' } }); await join;
    const resync = client.resync(); expect(sockets[0]!.emitted.at(-1)?.event).toBe('project:resync'); sockets[0]!.acknowledge('project:resync', { ok: true, data: { projectId: 'project-a' } }); await resync;
  });

  it('publishes only a flow-space cursor for an active joined session', async () => {
    const { client, sockets } = setup(); client.connect('token'); const socket = sockets[0]!;
    expect(client.publishPresence({ cursor: { x: 1, y: 2 }, selectionIds: [], editingElementId: null, activity: null })).toBe(false);
    const join = client.joinProject('project-a'); socket.acknowledge('project:join', { ok: true, data: { projectId: 'project-a' } }); await join;
    expect(client.publishPresence({ cursor: { x: 20, y: 30 }, selectionIds: [], editingElementId: null, activity: null })).toBe(true); expect(socket.emitted.at(-1)).toMatchObject({ event: 'project:presence', args: [{ cursor: { x: 20, y: 30 }, selectionIds: [], editingElementId: null, activity: null }] });
  });

  it('submits the typed project command envelope unchanged', async () => {
    const { client, sockets } = setup(); client.connect('token');
    const command = client.submitRealtimeCommand({ projectId: 'project-a', sessionId: 'session-a', commandId: 'command-a', baseRealtimeVersion: 4, baseRevision: 2, command: { type: 'RenameClass', classId: 'class-a', name: 'Renamed' } });
    expect(sockets[0]!.emitted.at(-1)).toMatchObject({ event: 'project:command', args: [{ projectId: 'project-a', sessionId: 'session-a', commandId: 'command-a', baseRealtimeVersion: 4, baseRevision: 2, command: { type: 'RenameClass', classId: 'class-a', name: 'Renamed' } }, expect.any(Function)] });
    sockets[0]!.acknowledge('project:command', { ok: true, status: 'APPLIED', data: { commandId: 'command-a' } });
    await expect(command).resolves.toMatchObject({ ok: true, status: 'APPLIED', data: { commandId: 'command-a' } });
  });

  it('cleans listeners and state idempotently without reconnect duplication', () => {
    const { client, sockets } = setup(); let calls = 0; client.subscribe('auth:expired', () => { calls += 1; }); client.connect('token'); client.connect('token');
    expect(sockets[0]!.disconnects).toBe(1); expect(sockets[0]!.listeners.get('auth:expired')?.size).toBe(0); expect(sockets[1]!.listeners.get('auth:expired')?.size).toBe(1);
    for (const listener of sockets[1]!.listeners.get('auth:expired') ?? []) listener(); expect(calls).toBe(1);
    client.disconnect(); client.disconnect(); expect(sockets[1]!.disconnects).toBe(1); expect(client.activeProjectId).toBeNull(); expect(sockets[1]!.listeners.get('auth:expired')?.size).toBe(0);
  });
});
