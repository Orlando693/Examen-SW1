'use client';

import { Box } from '@mui/material';
import { useInternalNode } from '@xyflow/react';
import type { CollaborationParticipant } from '../../lib/collaboration/contracts';
import { remoteCursorColor } from './RemoteCursorsOverlay';
import type { ProjectDocumentFlow } from '../../lib/editor/projection/project-document-to-flow';

function RemoteNodeSelection({ participant, elementId }: { participant: CollaborationParticipant; elementId: string }) {
  const node = useInternalNode(elementId);
  const position = node?.internals.positionAbsolute;
  const width = node?.measured.width;
  const height = node?.measured.height;
  if (!position || width === undefined || height === undefined) return null;
  return <Box data-testid={`remote-selection-${participant.userId}-${elementId}`} sx={{ position: 'absolute', left: position.x, top: position.y, width, height, boxSizing: 'border-box', border: `3px solid ${remoteCursorColor(participant.userId)}`, borderRadius: 1, pointerEvents: 'none', zIndex: 9 }} />;
}

export function RemoteSelectionOverlay({ participants, currentUserId, flow }: { participants: CollaborationParticipant[]; currentUserId: string | null; flow: ProjectDocumentFlow }) {
  const nodes = new Map(flow.nodes.map((node) => [node.id, node])); const edges = new Map(flow.edges.map((edge) => [edge.id, edge]));
  return <>{participants.filter((participant) => participant.userId !== currentUserId && participant.online).flatMap((participant) => participant.selectionIds.map((elementId) => ({ participant, elementId }))).map(({ participant, elementId }) => {
    const color = remoteCursorColor(participant.userId); const node = nodes.get(elementId);
    if (node) return <RemoteNodeSelection key={`${participant.userId}:${elementId}`} participant={participant} elementId={elementId} />;
    const edge = edges.get(elementId); if (!edge) return null;
    const source = nodes.get(edge.source); const target = nodes.get(edge.target); if (!source || !target) return null;
    return <Box key={`${participant.userId}:${elementId}`} data-testid={`remote-selection-${participant.userId}-${elementId}`} sx={{ position: 'absolute', left: (source.position.x + target.position.x) / 2, top: (source.position.y + target.position.y) / 2, width: 10, height: 10, borderRadius: '50%', bgcolor: color, pointerEvents: 'none', zIndex: 9 }} />;
  })}</>;
}
