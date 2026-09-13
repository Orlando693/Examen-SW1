import { describe, expect, it } from 'vitest';
import { avatarInitials, PresenceRoster } from './presence-roster';
import type { CollaborationParticipant } from './contracts';

function participant(userId: string, online = true): CollaborationParticipant { return { userId, email: `${userId}.user@example.com`, accessLevel: 'EDITOR', initials: userId === 'fallback' ? '' : userId.slice(0, 1).toUpperCase(), online, lastActivityAt: null, cursor: null, selectionIds: [], editingElementId: null, activity: null }; }

describe('PresenceRoster', () => {
  it('installs the join roster and deduplicates by user id', () => {
    const roster = new PresenceRoster(); expect(roster.replace('project-a', [participant('a'), { ...participant('a'), online: false }])).toEqual([expect.objectContaining({ userId: 'a', online: false })]);
  });

  it('updates online state without removing offline participants', () => {
    const roster = new PresenceRoster(); roster.replace('project-a', [participant('a')]); expect(roster.update('project-a', [participant('a', false)])).toEqual([expect.objectContaining({ userId: 'a', online: false })]);
  });

  it('isolates project rosters and ignores stale project events', () => {
    const roster = new PresenceRoster(); roster.replace('project-a', [participant('a')]); expect(roster.replace('project-b', [participant('b')])).toEqual([expect.objectContaining({ userId: 'b' })]); expect(roster.update('project-a', [participant('a')])).toBeNull();
  });

  it('clears participants and derives deterministic avatar initials', () => {
    const roster = new PresenceRoster(); roster.replace('project-a', [participant('a')]); roster.clear(); expect(roster.update('project-a', [participant('a')])).toBeNull(); expect(avatarInitials(participant('fallback'))).toBe('FU');
  });
});
