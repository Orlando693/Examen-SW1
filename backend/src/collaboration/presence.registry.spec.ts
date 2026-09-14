import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresenceRegistry } from './presence.registry.js';
import type { PresenceInput } from './contracts.js';

describe('PresenceRegistry', () => {
  afterEach(() => vi.useRealTimers());
  it('keeps a user online when one of two sockets is removed', () => {
    const registry = new PresenceRegistry();
    const presence: PresenceInput = { cursor: null, selectionIds: [], editingElementId: null, activity: null };
    const participants = [{ userId: 'user-1', email: 'user@example.com', accessLevel: 'OWNER' as const }];
    registry.update('project-a', 'socket-1', 'user-1', presence);
    registry.update('project-a', 'socket-2', 'user-1', presence);
    expect(registry.roster('project-a', participants)).toMatchObject([{ userId: 'user-1', online: true }]);
    registry.remove('project-a', 'socket-1');
    const roster = registry.roster('project-a', participants);
    expect(roster).toHaveLength(1); expect(roster[0]).toMatchObject({ userId: 'user-1', online: true });
  });

  it('marks a user offline after its last socket is removed', () => {
    const registry = new PresenceRegistry();
    const presence: PresenceInput = { cursor: null, selectionIds: [], editingElementId: null, activity: null };
    const participants = [{ userId: 'user-1', email: 'user@example.com', accessLevel: 'OWNER' as const }];
    registry.update('project-a', 'socket-2', 'user-1', presence);
    expect(registry.roster('project-a', participants)).toMatchObject([{ online: true }]);
    registry.remove('project-a', 'socket-2');
    expect(registry.roster('project-a', participants)).toMatchObject([{ userId: 'user-1', online: false, cursor: null, selectionIds: [], editingElementId: null, activity: null }]);
  });

  it('isolates roster state by project', () => {
    const registry = new PresenceRegistry();
    const presence: PresenceInput = { cursor: null, selectionIds: [], editingElementId: null, activity: null };
    registry.update('project-a', 'socket-a', 'user-a', presence);
    registry.update('project-b', 'socket-b', 'user-b', presence);
    const rosterA = registry.roster('project-a', [{ userId: 'user-a', email: 'a@example.com', accessLevel: 'OWNER' as const }]);
    const rosterB = registry.roster('project-b', [{ userId: 'user-b', email: 'b@example.com', accessLevel: 'OWNER' as const }]);
    expect(rosterA).toMatchObject([{ userId: 'user-a', online: true }]); expect(rosterB).toMatchObject([{ userId: 'user-b', online: true }]);
  });

  it('removes every socket presence for a terminal project deletion', () => {
    const registry = new PresenceRegistry();
    const presence: PresenceInput = { cursor: null, selectionIds: [], editingElementId: null, activity: null };
    registry.update('project-a', 'socket-a', 'user-a', presence);
    registry.update('project-a', 'socket-b', 'user-b', presence);
    registry.clear('project-a');
    expect(registry.roster('project-a', [{ userId: 'user-a', email: 'a@example.com', accessLevel: 'OWNER' }])).toMatchObject([{ online: false }]);
  });

  it('projects the most recently active socket cursor with a server timestamp', () => {
    vi.useFakeTimers(); const registry = new PresenceRegistry();
    const participants = [{ userId: 'user-1', email: 'user@example.com', accessLevel: 'OWNER' as const }];
    vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'));
    registry.update('project-a', 'socket-1', 'user-1', { cursor: { x: 10, y: 20 }, selectionIds: [], editingElementId: null, activity: null });
    vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'));
    registry.update('project-a', 'socket-2', 'user-1', { cursor: { x: 30, y: 40 }, selectionIds: [], editingElementId: null, activity: null });
    expect(registry.roster('project-a', participants)).toMatchObject([{ cursor: { x: 30, y: 40 }, lastActivityAt: '2026-01-01T00:00:02.000Z' }]);
    vi.setSystemTime(new Date('2026-01-01T00:00:03.000Z'));
    registry.update('project-a', 'socket-1', 'user-1', { cursor: { x: 50, y: 60 }, selectionIds: [], editingElementId: null, activity: null });
    expect(registry.roster('project-a', participants)).toMatchObject([{ cursor: { x: 50, y: 60 }, lastActivityAt: '2026-01-01T00:00:03.000Z' }]);
    registry.remove('project-a', 'socket-1');
    expect(registry.roster('project-a', participants)).toMatchObject([{ cursor: { x: 30, y: 40 } }]);
  });

  it('projects selection from the most recently active socket and clears stale values', () => {
    vi.useFakeTimers(); const registry = new PresenceRegistry();
    const participants = [{ userId: 'user-1', email: 'user@example.com', accessLevel: 'OWNER' as const }];
    vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'));
    registry.update('project-a', 'socket-1', 'user-1', { cursor: { x: 1, y: 2 }, selectionIds: ['class-1'], editingElementId: null, activity: null });
    vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'));
    registry.update('project-a', 'socket-2', 'user-1', { cursor: null, selectionIds: ['class-2', 'class-3'], editingElementId: null, activity: null });
    expect(registry.roster('project-a', participants)).toMatchObject([{ selectionIds: ['class-2', 'class-3'], lastActivityAt: '2026-01-01T00:00:02.000Z' }]);
    vi.setSystemTime(new Date('2026-01-01T00:00:03.000Z'));
    registry.update('project-a', 'socket-1', 'user-1', { cursor: { x: 1, y: 2 }, selectionIds: ['relationship-1'], editingElementId: null, activity: null });
    expect(registry.roster('project-a', participants)).toMatchObject([{ cursor: { x: 1, y: 2 }, selectionIds: ['relationship-1'] }]);
    registry.remove('project-a', 'socket-1');
    expect(registry.roster('project-a', participants)).toMatchObject([{ selectionIds: ['class-2', 'class-3'] }]);
    registry.update('project-a', 'socket-2', 'user-1', { cursor: null, selectionIds: [], editingElementId: null, activity: null });
    expect(registry.roster('project-a', participants)).toMatchObject([{ selectionIds: [] }]);
  });

  it('projects editing and activity from the most recently active socket', () => {
    vi.useFakeTimers(); const registry = new PresenceRegistry();
    const participants = [{ userId: 'user-1', email: 'user@example.com', accessLevel: 'OWNER' as const }];
    vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'));
    registry.update('project-a', 'socket-1', 'user-1', { cursor: null, selectionIds: [], editingElementId: 'class-1', activity: 'editing' });
    vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'));
    registry.update('project-a', 'socket-2', 'user-1', { cursor: null, selectionIds: [], editingElementId: 'class-2', activity: 'dragging' });
    expect(registry.roster('project-a', participants)).toMatchObject([{ editingElementId: 'class-2', activity: 'dragging', lastActivityAt: '2026-01-01T00:00:02.000Z' }]);
    vi.setSystemTime(new Date('2026-01-01T00:00:03.000Z'));
    registry.update('project-a', 'socket-1', 'user-1', { cursor: null, selectionIds: [], editingElementId: null, activity: null });
    expect(registry.roster('project-a', participants)).toMatchObject([{ editingElementId: null, activity: null }]);
    registry.remove('project-a', 'socket-1');
    expect(registry.roster('project-a', participants)).toMatchObject([{ editingElementId: 'class-2', activity: 'dragging' }]);
  });
});
