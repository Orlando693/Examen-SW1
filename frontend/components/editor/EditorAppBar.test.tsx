import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { EditorAppBar } from './EditorAppBar';
import { resetEditorStoreForTests } from '../../stores/editor-store';
import { createDemoProjectDocument } from '../../lib/editor/demo/demo-document';
import type { CollaborationParticipant } from '../../lib/collaboration/contracts';

function participant(userId: string, online: boolean, activity: CollaborationParticipant['activity']): CollaborationParticipant {
  return { userId, email: `${userId}@example.com`, accessLevel: userId === 'owner' ? 'OWNER' : 'EDITOR', initials: userId.slice(0, 2).toUpperCase(), online, lastActivityAt: '2026-09-13T12:00:00.000Z', cursor: null, selectionIds: [], editingElementId: null, activity };
}

describe('EditorAppBar collaboration roster', () => {
  beforeEach(() => resetEditorStoreForTests(createDemoProjectDocument()));

  it('keeps the authorized roster, online state, and activity accessible through desktop, mobile, tablet, and desktop presentation', () => {
    const collaborators = [participant('owner', true, 'editing'), participant('editor', false, null)];
    const { rerender } = render(<EditorAppBar compact={false} currentUserId="owner" participants={collaborators} />);
    expect(screen.getByLabelText('Collaborators')).toBeInTheDocument();
    expect(screen.getByLabelText(/owner@example.com is editing; activity/)).toBeInTheDocument();
    expect(screen.getByLabelText(/editor@example.com is offline; activity/)).toBeInTheDocument();

    rerender(<EditorAppBar compact currentUserId="owner" participants={collaborators} />);
    expect(screen.getByLabelText('Collaborators')).toBeInTheDocument();
    rerender(<EditorAppBar compact={false} currentUserId="owner" participants={collaborators} />);
    expect(screen.getAllByLabelText(/owner@example.com is editing; activity/)).toHaveLength(1);
  });
});
