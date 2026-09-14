'use client';

import { AppBar, Avatar, AvatarGroup, Badge, Box, Button, Toolbar, Tooltip, Typography } from '@mui/material';
import type { CollaborationParticipant } from '../../lib/collaboration/contracts';
import { avatarInitials } from '../../lib/collaboration/presence-roster';
import { useEffect } from 'react';
import { useEditorStore } from '../../stores/editor-store';

export function EditorAppBar({ compact, participants = [], currentUserId = null }: { compact: boolean; participants?: CollaborationParticipant[]; currentUserId?: string | null }) {
  const document = useEditorStore((state) => state.currentDocument);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const undoCount = useEditorStore((state) => state.undoCount);
  const redoCount = useEditorStore((state) => state.redoCount);
  const realtimeCommandGate = useEditorStore((state) => state.realtimeCommandGate);
  const applyAutoLayout = useEditorStore((state) => state.applyAutoLayout);
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar);
  const toggleInspector = useEditorStore((state) => state.toggleInspector);
  const save = useEditorStore((state) => state.save);
  const reloadProject = useEditorStore((state) => state.reloadProject);
  const saveState = useEditorStore((state) => state.saveState);
  const collaborationState = useEditorStore((state) => state.collaborationState);
  const collaborationRequired = useEditorStore((state) => state.collaborationRequired);
  const realtimeCommandPending = useEditorStore((state) => state.realtimeCommandPending);
  const historyUnavailable = collaborationRequired || realtimeCommandGate !== null;
  const mutationsBlocked = collaborationRequired && (collaborationState !== 'connected' || realtimeCommandPending);
  const persistenceStatus = collaborationState === 'resyncing' ? 'Resynchronizing'
    : collaborationState === 'disconnected' ? 'Disconnected'
      : collaborationState === 'auth-required' ? 'Sign in required'
        : collaborationState === 'error' ? 'Error'
          : realtimeCommandPending ? 'Saving'
            : collaborationState === 'connected' ? 'Saved' : 'Connecting';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      event.preventDefault();
      if (historyUnavailable) return;
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [historyUnavailable, redo, undo]);

  return (
    <AppBar position="static" elevation={0} sx={{ bgcolor: '#0B1F33', borderBottom: '1px solid rgba(216,226,232,0.16)' }}>
      <Toolbar variant="dense" sx={{ gap: { xs: 0.5, sm: 1 }, flexWrap: 'nowrap', minWidth: 0, overflow: 'hidden', minHeight: { xs: 38, sm: 42 } }}>
        {compact && <Button size="small" color="inherit" aria-label="Menu" onClick={toggleSidebar} sx={{ flex: '0 0 auto', minWidth: 44, px: 0.75, textTransform: 'none' }}>Menu</Button>}
        <Box sx={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
          {!compact && <Typography variant="caption" sx={{ opacity: 0.74, letterSpacing: 0.5, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}>CASE / UML / WORKBENCH</Typography>}
          <Typography variant={compact ? 'body2' : 'subtitle1'} fontWeight={700} noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{document.metadata.name}</Typography>
        </Box>
        {participants.length > 0 && <AvatarGroup max={compact ? 3 : 6} aria-label="Collaborators" sx={{ flex: '0 0 auto', '& .MuiAvatar-root': { width: compact ? 22 : 26, height: compact ? 22 : 26, fontSize: compact ? 9 : 11, border: '2px solid #0B1F33' } }}>
          {participants.map((participant) => <Tooltip key={participant.userId} title={`${participant.email}${participant.userId === currentUserId ? ' (You)' : ''}: ${participant.online ? (participant.activity ?? 'active') : 'offline'}${participant.lastActivityAt ? `, activity ${participant.lastActivityAt}` : ''}`}><Badge overlap="circular" variant="dot" color={participant.online ? 'success' : 'default'} aria-label={`${participant.email} is ${participant.online ? (participant.activity ?? 'active') : 'offline'}${participant.lastActivityAt ? `; activity ${participant.lastActivityAt}` : ''}`}><Avatar sx={{ bgcolor: participant.online ? '#2F6B8A' : '#6B7780' }}>{avatarInitials(participant)}</Avatar></Badge></Tooltip>)}
        </AvatarGroup>}
        <Button size={compact ? 'small' : 'medium'} color="inherit" onClick={undo} disabled={historyUnavailable || undoCount === 0} aria-label={historyUnavailable ? 'Undo unavailable during realtime collaboration' : 'Undo'} sx={{ flex: '0 0 auto', minWidth: compact ? 42 : 64, px: compact ? 0.75 : 1, textTransform: 'none', '&.Mui-disabled': { color: 'rgba(255,255,255,0.35)' } }}>Undo</Button>
        <Button size={compact ? 'small' : 'medium'} color="inherit" onClick={redo} disabled={historyUnavailable || redoCount === 0} aria-label={historyUnavailable ? 'Redo unavailable during realtime collaboration' : 'Redo'} sx={{ flex: '0 0 auto', minWidth: compact ? 42 : 64, px: compact ? 0.75 : 1, textTransform: 'none', '&.Mui-disabled': { color: 'rgba(255,255,255,0.35)' } }}>Redo</Button>
        {collaborationRequired ? <Tooltip title="Shared changes are persisted by authoritative realtime commands."><span><Button size={compact ? 'small' : 'medium'} color="inherit" disabled aria-label={`Collaboration persistence: ${persistenceStatus}`} sx={{ flex: '0 0 auto', textTransform: 'none', '&.Mui-disabled': { color: 'rgba(255,255,255,0.6)' } }}>{persistenceStatus}</Button></span></Tooltip> : <Button size={compact ? 'small' : 'medium'} color="inherit" onClick={() => void save()} disabled={saveState === 'idle' || saveState === 'saving'} sx={{ flex: '0 0 auto', textTransform: 'none' }}>{saveState === 'saving' ? 'Saving' : 'Save'}</Button>}
        {(saveState === 'conflict' || saveState === 'error') && <Button size="small" color="inherit" onClick={() => void reloadProject()} sx={{ flex: '0 0 auto', textTransform: 'none' }}>Reload</Button>}
        {!compact && <Button size="medium" color="inherit" onClick={() => void applyAutoLayout()} disabled={mutationsBlocked} aria-describedby={mutationsBlocked ? 'collaboration-mutation-help' : undefined} sx={{ flex: '0 0 auto', minWidth: 112, whiteSpace: 'nowrap', textTransform: 'none' }}>Auto Layout</Button>}
        {compact && <Button size="small" color="inherit" onClick={toggleInspector} sx={{ flex: '0 0 auto', minWidth: 54, px: 0.75, textTransform: 'none' }}>Props</Button>}
      </Toolbar>
      {historyUnavailable && <Typography id="collaboration-mutation-help" role="status" aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Undo and redo are unavailable during collaborative editing. Shared mutations wait for an authoritative realtime connection.</Typography>}
    </AppBar>
  );
}
