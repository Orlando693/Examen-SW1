import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteSelectionOverlay } from './RemoteSelectionOverlay';
import type { CollaborationParticipant } from '../../lib/collaboration/contracts';
import type { ProjectDocumentFlow } from '../../lib/editor/projection/project-document-to-flow';

const useInternalNodeMock = vi.hoisted(() => vi.fn());
vi.mock('@xyflow/react', () => ({ useInternalNode: useInternalNodeMock }));

const flow: ProjectDocumentFlow = { nodes: [{ id: 'class-1', type: 'umlClass', position: { x: 40, y: 60 }, selected: false, data: { elementId: 'class-1', name: 'Class', attributes: [], operations: [], errorCount: 0, warningCount: 0 } }], edges: [] };
function participant(userId: string, selectionIds: string[], online = true): CollaborationParticipant { return { userId, email: `${userId}@example.com`, initials: userId[0]!.toUpperCase(), accessLevel: 'EDITOR', online, lastActivityAt: null, cursor: null, selectionIds, editingElementId: null, activity: null }; }

describe('RemoteSelectionOverlay', () => {
  beforeEach(() => useInternalNodeMock.mockReturnValue({ internals: { positionAbsolute: { x: 120, y: 80 } }, measured: { width: 240, height: 140 } }));
  it('renders remote node decorations without changing local selected state', () => { render(<RemoteSelectionOverlay flow={flow} currentUserId="owner" participants={[participant('editor', ['class-1'])]} />); expect(screen.getByTestId('remote-selection-editor-class-1')).toBeInTheDocument(); expect(flow.nodes[0]?.selected).toBe(false); });
  it('uses the current measured React Flow node bounds without viewport offsets', () => { render(<RemoteSelectionOverlay flow={flow} currentUserId="owner" participants={[participant('editor', ['class-1'])]} />); expect(screen.getByTestId('remote-selection-editor-class-1')).toHaveStyle({ left: '120px', top: '80px', width: '240px', height: '140px', boxSizing: 'border-box' }); });
  it('ignores current, offline, empty, and unknown remote selections', () => { render(<RemoteSelectionOverlay flow={flow} currentUserId="owner" participants={[participant('owner', ['class-1']), participant('offline', ['class-1'], false), participant('empty', []), participant('unknown', ['missing'])]} />); expect(screen.queryByTestId('remote-selection-owner-class-1')).not.toBeInTheDocument(); expect(screen.queryByTestId('remote-selection-offline-class-1')).not.toBeInTheDocument(); expect(screen.queryByTestId('remote-selection-unknown-missing')).not.toBeInTheDocument(); });
  it('keeps multiple remote users independent on the same element', () => { render(<RemoteSelectionOverlay flow={flow} currentUserId="owner" participants={[participant('a', ['class-1']), participant('b', ['class-1'])]} />); expect(screen.getByTestId('remote-selection-a-class-1')).toBeInTheDocument(); expect(screen.getByTestId('remote-selection-b-class-1')).toBeInTheDocument(); });
});
