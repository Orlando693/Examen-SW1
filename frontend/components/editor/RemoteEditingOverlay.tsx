'use client';
import { Box, Typography } from '@mui/material';
import type { CollaborationParticipant } from '../../lib/collaboration/contracts';
import type { ProjectDocumentFlow } from '../../lib/editor/projection/project-document-to-flow';
import { remoteCursorColor } from './RemoteCursorsOverlay';
export function RemoteEditingOverlay({ participants, currentUserId, flow }: { participants: CollaborationParticipant[]; currentUserId: string | null; flow: ProjectDocumentFlow }) { const nodes = new Map(flow.nodes.map((node) => [node.id, node])); return <>{participants.filter((p) => p.userId !== currentUserId && p.online && p.editingElementId !== null).map((p) => { const node = nodes.get(p.editingElementId!); if (!node) return null; const color = remoteCursorColor(p.userId); return <Box key={p.userId} data-testid={`remote-editing-${p.userId}`} sx={{ position: 'absolute', left: node.position.x, top: node.position.y - 22, pointerEvents: 'none', zIndex: 10 }}><Typography variant="caption" sx={{ px: .5, py: .1, borderRadius: .5, bgcolor: color, color: '#fff' }}>{p.initials} editing</Typography></Box>; })}</>; }
