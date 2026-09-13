'use client';

import { AppBar, Avatar, Badge, Box, Button, Stack, Toolbar, Tooltip, Typography } from '@mui/material';
import type { CollaborationParticipant } from '../../lib/collaboration/contracts';
import { avatarInitials } from '../../lib/collaboration/presence-roster';
import { useEditorStore } from '../../stores/editor-store';

export function EditorAppBar({ compact, participants = [], currentUserId = null }: { compact: boolean; participants?: CollaborationParticipant[]; currentUserId?: string | null }) {
  const document = useEditorStore((state) => state.currentDocument);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const undoCount = useEditorStore((state) => state.undoCount);
  const redoCount = useEditorStore((state) => state.redoCount);
  const applyAutoLayout = useEditorStore((state) => state.applyAutoLayout);
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar);
  const toggleInspector = useEditorStore((state) => state.toggleInspector);
  const save = useEditorStore((state) => state.save);
  const reloadProject = useEditorStore((state) => state.reloadProject);
  const saveState = useEditorStore((state) => state.saveState);

  return (
    <AppBar position="static" elevation={0} sx={{ bgcolor: '#0B1F33', borderBottom: '1px solid rgba(216,226,232,0.16)' }}>
      <Toolbar variant="dense" sx={{ gap: { xs: 0.5, sm: 1 }, flexWrap: 'nowrap', minWidth: 0, overflow: 'hidden', minHeight: { xs: 38, sm: 42 } }}>
        {compact && <Button size="small" color="inherit" aria-label="Menu" onClick={toggleSidebar} sx={{ flex: '0 0 auto', minWidth: 44, px: 0.75, textTransform: 'none' }}>Menu</Button>}
        <Box sx={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
          {!compact && <Typography variant="caption" sx={{ opacity: 0.74, letterSpacing: 0.5, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}>CASE / UML / WORKBENCH</Typography>}
          <Typography variant={compact ? 'body2' : 'subtitle1'} fontWeight={700} noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{document.metadata.name}</Typography>
        </Box>
        {!compact && participants.length > 0 && <Stack direction="row" spacing={-0.5} aria-label="Collaborators" sx={{ flex: '0 0 auto' }}>
          {participants.map((participant) => <Tooltip key={participant.userId} title={`${participant.email}${participant.userId === currentUserId ? ' (You)' : ''}${participant.userId !== currentUserId && participant.online && participant.activity ? `: ${participant.activity}` : ''}`}><Badge overlap="circular" variant="dot" color={participant.online ? 'success' : 'default'} aria-label={`${participant.email} is ${participant.online ? (participant.activity ?? 'active') : 'offline'}`}><Avatar sx={{ width: 26, height: 26, fontSize: 11, border: '2px solid #0B1F33', bgcolor: participant.online ? '#2F6B8A' : '#6B7780' }}>{avatarInitials(participant)}</Avatar></Badge></Tooltip>)}
        </Stack>}
        <Button size={compact ? 'small' : 'medium'} color="inherit" onClick={undo} disabled={undoCount === 0} sx={{ flex: '0 0 auto', minWidth: compact ? 42 : 64, px: compact ? 0.75 : 1, textTransform: 'none', '&.Mui-disabled': { color: 'rgba(255,255,255,0.35)' } }}>Undo</Button>
        <Button size={compact ? 'small' : 'medium'} color="inherit" onClick={redo} disabled={redoCount === 0} sx={{ flex: '0 0 auto', minWidth: compact ? 42 : 64, px: compact ? 0.75 : 1, textTransform: 'none', '&.Mui-disabled': { color: 'rgba(255,255,255,0.35)' } }}>Redo</Button>
        <Button size={compact ? 'small' : 'medium'} color="inherit" onClick={() => void save()} disabled={saveState === 'idle' || saveState === 'saving'} sx={{ flex: '0 0 auto', textTransform: 'none' }}>{saveState === 'saving' ? 'Saving' : 'Save'}</Button>
        {(saveState === 'conflict' || saveState === 'error') && <Button size="small" color="inherit" onClick={() => void reloadProject()} sx={{ flex: '0 0 auto', textTransform: 'none' }}>Reload</Button>}
        {!compact && <Button size="medium" color="inherit" onClick={() => void applyAutoLayout()} sx={{ flex: '0 0 auto', minWidth: 112, whiteSpace: 'nowrap', textTransform: 'none' }}>Auto Layout</Button>}
        {compact && <Button size="small" color="inherit" onClick={toggleInspector} sx={{ flex: '0 0 auto', minWidth: 54, px: 0.75, textTransform: 'none' }}>Props</Button>}
      </Toolbar>
    </AppBar>
  );
}
