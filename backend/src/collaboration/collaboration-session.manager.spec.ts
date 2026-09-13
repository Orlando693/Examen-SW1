import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollaborationSessionManager } from './collaboration-session.manager.js';
import { ProjectMutationCoordinator } from './project-mutation-coordinator.js';

describe('CollaborationSessionManager', () => {
  afterEach(() => { vi.useRealTimers(); delete process.env.COLLABORATION_RECONNECT_TTL_MS; });
  function manager() { return new CollaborationSessionManager(new ProjectMutationCoordinator()); }

  it('returns one logical session for concurrent first callers', () => {
    const sessions = manager();
    const [first, second] = [sessions.getOrCreate('project'), sessions.getOrCreate('project')];
    expect(first).toBe(second); expect(first.sessionId).toBe(second.sessionId); expect(first.realtimeVersion).toBe(0);
  });

  it('evicts an empty session only after its valid timer', () => {
    vi.useFakeTimers(); process.env.COLLABORATION_RECONNECT_TTL_MS = '10';
    const sessions = manager(); sessions.join('project', 'socket'); sessions.leave('project', 'socket');
    vi.advanceTimersByTime(10);
    expect(sessions.get('project')).toBeUndefined();
  });

  it('cancels an old eviction when the session is reactivated', () => {
    vi.useFakeTimers(); process.env.COLLABORATION_RECONNECT_TTL_MS = '10';
    const sessions = manager(); const first = sessions.join('project', 'socket-a'); sessions.leave('project', 'socket-a');
    const reactivated = sessions.join('project', 'socket-b'); vi.advanceTimersByTime(10);
    expect(sessions.get('project')).toBe(reactivated); expect(reactivated.generation).toBe(first.generation);
  });
});
