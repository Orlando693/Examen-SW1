import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollaborationCapacityError, CollaborationSessionManager } from './collaboration-session.manager.js';

describe('CollaborationSessionManager', () => {
  const originalTtl = process.env.COLLABORATION_RECONNECT_TTL_MS;

  afterEach(() => {
    if (originalTtl === undefined) delete process.env.COLLABORATION_RECONNECT_TTL_MS;
    else process.env.COLLABORATION_RECONNECT_TTL_MS = originalTtl;
    vi.useRealTimers();
  });

  it('cancels a pending eviction on rejoin and prevents its old timer from removing the later epoch', () => {
    vi.useFakeTimers();
    process.env.COLLABORATION_RECONNECT_TTL_MS = '100';
    const manager = new CollaborationSessionManager({ isIdle: () => true } as never);
    const first = manager.join('project-a', 'socket-a');
    manager.leave('project-a', 'socket-a');
    manager.join('project-a', 'socket-b');
    vi.advanceTimersByTime(100);
    expect(manager.get('project-a')).toBe(first);
    manager.leave('project-a', 'socket-b');
    vi.advanceTimersByTime(100);
    expect(manager.get('project-a')).toBeUndefined();
    const replacement = manager.join('project-a', 'socket-c');
    expect(replacement.sessionId).not.toBe(first.sessionId);
    vi.advanceTimersByTime(100);
    expect(manager.get('project-a')).toBe(replacement);
    manager.onModuleDestroy();
  });

  it('terminally removes the session, dedupe state, and pending eviction timer', () => {
    vi.useFakeTimers();
    process.env.COLLABORATION_RECONNECT_TTL_MS = '100';
    const manager = new CollaborationSessionManager({ isIdle: () => true } as never);
    const session = manager.join('project-a', 'socket-a');
    session.dedupe.set('command-a', {} as never);
    manager.leave('project-a', 'socket-a');
    expect(session.evictionTimer).not.toBeNull();
    manager.terminate('project-a');
    expect(session.socketIds).toEqual(new Set());
    expect(session.dedupe).toEqual(new Map());
    expect(session.evictionTimer).toBeNull();
    expect(manager.get('project-a')).toBeUndefined();
    vi.advanceTimersByTime(100);
    expect(manager.get('project-a')).toBeUndefined();
  });

  it('rejects a new session at capacity without growing the registry', () => {
    process.env.COLLABORATION_SESSION_CAPACITY = '1';
    const manager = new CollaborationSessionManager({ isIdle: () => true } as never);
    manager.join('project-a', 'socket-a');
    expect(() => manager.join('project-b', 'socket-b')).toThrow(CollaborationCapacityError);
    expect(manager.get('project-b')).toBeUndefined();
    manager.onModuleDestroy();
    delete process.env.COLLABORATION_SESSION_CAPACITY;
  });
});
