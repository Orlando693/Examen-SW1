import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteEditingOverlay } from './RemoteEditingOverlay';
import type { CollaborationParticipant } from '../../lib/collaboration/contracts';
import type { ProjectDocumentFlow } from '../../lib/editor/projection/project-document-to-flow';

const useInternalNodeMock = vi.hoisted(() => vi.fn());
vi.mock('@xyflow/react', () => ({ useInternalNode: useInternalNodeMock }));

const flow: ProjectDocumentFlow = { nodes: [{ id: 'class-1', type: 'umlClass', position: { x: 1, y: 2 }, selected: false, data: { elementId: 'class-1', name: 'Class', attributes: [], operations: [], errorCount: 0, warningCount: 0 } }], edges: [] };
function participant(userId: string, editingElementId: string | null, online = true): CollaborationParticipant { return { userId, email: `${userId}@x.com`, initials: userId, accessLevel: 'EDITOR', online, lastActivityAt: null, cursor: null, selectionIds: [], editingElementId, activity: null }; }

describe('RemoteEditingOverlay', () => {
  beforeEach(() => useInternalNodeMock.mockReturnValue({ internals: { positionAbsolute: { x: 120, y: 80 } } }));

  it('renders online remote editing at current React Flow coordinates without changing local selection', () => {
    render(<RemoteEditingOverlay flow={flow} currentUserId="owner" participants={[participant('a', 'class-1'), participant('b', 'class-1')]} />);
    expect(screen.getByTestId('remote-editing-a')).toHaveStyle({ left: '120px', top: '58px', pointerEvents: 'none' });
    expect(screen.getByTestId('remote-editing-b')).toBeInTheDocument();
    expect(flow.nodes[0]?.selected).toBe(false);
  });

  it('hides current, offline, cleared, and unknown editing', () => {
    render(<RemoteEditingOverlay flow={flow} currentUserId="owner" participants={[participant('owner', 'class-1'), participant('offline', 'class-1', false), participant('clear', null), participant('unknown', 'missing')]} />);
    expect(screen.queryByTestId('remote-editing-owner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remote-editing-offline')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remote-editing-unknown')).not.toBeInTheDocument();
  });
});
