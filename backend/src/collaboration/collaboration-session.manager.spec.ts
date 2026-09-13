import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollaborationSessionManager } from './collaboration-session.manager.js';

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
});
