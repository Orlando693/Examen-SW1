'use client';

import { useInternalNode } from '@xyflow/react';
import { Box, Typography } from '@mui/material';
import type { CollaborationParticipant } from '../../lib/collaboration/contracts';
import type { ProjectDocumentFlow } from '../../lib/editor/projection/project-document-to-flow';
import { remoteCursorColor } from './RemoteCursorsOverlay';

function RemoteNodeEditing({ participant, elementId }: { participant: CollaborationParticipant; elementId: string }) {
  const node = useInternalNode(elementId);
  const position = node?.internals.positionAbsolute;
  if (!position) return null;
  const color = remoteCursorColor(participant.userId);
  return <Box data-testid={`remote-editing-${participant.userId}`} sx={{ position: 'absolute', left: position.x, top: position.y - 22, pointerEvents: 'none', zIndex: 10 }}><Typography variant="caption" sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, bgcolor: color, color: '#fff' }}>{participant.initials} editing</Typography></Box>;
}

export function RemoteEditingOverlay({ participants, currentUserId, flow }: { participants: CollaborationParticipant[]; currentUserId: string | null; flow: ProjectDocumentFlow }) {
  const nodeIds = new Set(flow.nodes.map((node) => node.id));
  return <>{participants.filter((participant) => participant.userId !== currentUserId && participant.online && participant.editingElementId !== null && nodeIds.has(participant.editingElementId)).map((participant) => <RemoteNodeEditing key={participant.userId} participant={participant} elementId={participant.editingElementId!} />)}</>;
}
