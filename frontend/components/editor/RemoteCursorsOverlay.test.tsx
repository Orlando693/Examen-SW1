import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RemoteCursorsOverlay, remoteCursorColor } from './RemoteCursorsOverlay';
import type { CollaborationParticipant } from '../../lib/collaboration/contracts';

function participant(userId: string, cursor: { x: number; y: number } | null, online = true): CollaborationParticipant { return { userId, email: `${userId}@example.com`, accessLevel: 'EDITOR', initials: userId.toUpperCase(), online, lastActivityAt: null, cursor, selectionIds: [], editingElementId: null, activity: null }; }

describe('RemoteCursorsOverlay', () => {
  it('renders an online remote flow-space cursor once per user', () => {
    render(<RemoteCursorsOverlay currentUserId="owner" participants={[participant('editor', { x: 120, y: 80 }), { ...participant('editor', { x: 200, y: 160 }), initials: 'E2' }]} />);
    const cursor = screen.getByTestId('remote-cursor-editor'); expect(cursor).toHaveStyle({ left: '200px', top: '160px', pointerEvents: 'none' }); expect(screen.getAllByTestId('remote-cursor-editor')).toHaveLength(1);
  });

  it('does not render current, offline, or cleared cursors', () => {
    render(<RemoteCursorsOverlay currentUserId="owner" participants={[participant('owner', { x: 1, y: 1 }), participant('offline', { x: 2, y: 2 }, false), participant('cleared', null)]} />);
    expect(screen.queryByTestId('remote-cursor-owner')).not.toBeInTheDocument(); expect(screen.queryByTestId('remote-cursor-offline')).not.toBeInTheDocument(); expect(screen.queryByTestId('remote-cursor-cleared')).not.toBeInTheDocument();
  });

  it('assigns each user a deterministic cursor color', () => { expect(remoteCursorColor('editor')).toBe(remoteCursorColor('editor')); expect(remoteCursorColor('editor')).not.toBe(''); });
});
