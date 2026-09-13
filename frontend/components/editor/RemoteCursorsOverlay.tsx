'use client';

import { Box, Typography } from '@mui/material';
import type { CollaborationParticipant } from '../../lib/collaboration/contracts';
import { avatarInitials } from '../../lib/collaboration/presence-roster';

const colors = ['#1F6F8B', '#8A4F7D', '#52734D', '#A15C38', '#5C6B9E'];

export function remoteCursorColor(userId: string): string {
  let hash = 0;
  for (const character of userId) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length] ?? colors[0]!;
}

export function RemoteCursorsOverlay({ participants, currentUserId }: { participants: CollaborationParticipant[]; currentUserId: string | null }) {
  const remoteParticipants = [...new Map(participants.map((participant) => [participant.userId, participant])).values()].filter((participant) => participant.userId !== currentUserId && participant.online && participant.cursor !== null);
  return <>{remoteParticipants.map((participant) => {
    const cursor = participant.cursor!; const color = remoteCursorColor(participant.userId);
    return <Box key={participant.userId} data-testid={`remote-cursor-${participant.userId}`} aria-label={`Remote cursor for ${participant.email}`} sx={{ position: 'absolute', left: cursor.x, top: cursor.y, pointerEvents: 'none', transform: 'translate(4px, 4px)', display: 'flex', alignItems: 'flex-start', gap: 0.4, color, zIndex: 10 }}>
      <Box component="span" aria-hidden="true" sx={{ fontSize: 18, lineHeight: 1, transform: 'rotate(-45deg)', transformOrigin: 'center' }}>▲</Box>
      <Typography component="span" variant="caption" sx={{ px: 0.55, py: 0.1, borderRadius: 0.5, bgcolor: color, color: '#fff', fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' }}>{avatarInitials(participant)}</Typography>
    </Box>;
  })}</>;
}
