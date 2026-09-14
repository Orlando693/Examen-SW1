'use client';

import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { CollaborationConnectionState } from '../../lib/collaboration/contracts';
import { useEditorStore } from '../../stores/editor-store';

export function EditorStatusBar({ compact }: { compact: boolean }) {
  const document = useEditorStore((state) => state.currentDocument);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const selection = useEditorStore((state) => state.selection);
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'ERROR').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'WARNING').length;
  const selectionLabel = selectionLabelFor(document, selection);
  const collaborationState = useEditorStore((state) => state.collaborationState);
  const collaborationRequired = useEditorStore((state) => state.collaborationRequired);
  const realtimeCommandPending = useEditorStore((state) => state.realtimeCommandPending);
  const status = collaborationStatus(collaborationState, collaborationRequired, realtimeCommandPending);

  return (
    <Box data-testid="editor-status-bar" sx={{ display: 'flex', gap: { xs: 0.75, sm: 1.25 }, alignItems: 'center', flexWrap: 'nowrap', minWidth: 0, overflow: 'hidden', px: { xs: 1, sm: 1.5 }, py: 0.35, borderTop: 1, borderColor: '#C8D3DA', bgcolor: '#F8FAFB', color: '#647580', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}>
      {!compact && <StatusItem>REV {document.revision}</StatusItem>}
      <StatusItem>{status.label}</StatusItem>
      <Typography role="status" aria-live="polite" data-testid="collaboration-status" variant="caption" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{status.message}</Typography>
      <StatusItem tone={errors > 0 ? 'error' : 'default'}>{errors} {compact ? 'ERR' : 'ERRORS'}</StatusItem>
      <StatusItem tone={warnings > 0 ? 'warning' : 'default'}>{warnings} {compact ? 'WARN' : 'WARNING'}</StatusItem>
      <Typography data-testid="status-selection" variant="caption" sx={{ ml: 'auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'inherit', fontWeight: 800, color: '#0B1F33' }}>{selectionLabel.toUpperCase()}</Typography>
    </Box>
  );
}

function collaborationStatus(state: CollaborationConnectionState, required: boolean, pending: boolean): { label: string; message: string } {
  if (!required) return { label: 'LOCAL', message: 'Local save mode.' };
  if (pending) return { label: 'SAVING', message: 'Saving shared change.' };
  if (state === 'connected') return { label: 'SAVED', message: 'Shared changes are saved.' };
  if (state === 'resyncing') return { label: 'RESYNCING', message: 'Resynchronizing authoritative project state.' };
  if (state === 'disconnected') return { label: 'DISCONNECTED', message: 'Disconnected. Shared mutations are blocked.' };
  if (state === 'auth-required') return { label: 'AUTH REQUIRED', message: 'Authentication is required to continue editing.' };
  if (state === 'error') return { label: 'ERROR', message: 'Collaboration connection failed. Shared mutations are blocked.' };
  return { label: state === 'joining' ? 'JOINING' : 'CONNECTING', message: 'Connecting to shared editing.' };
}

function StatusItem({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warning' | 'error' }) {
  const color = tone === 'error' ? '#C2413A' : tone === 'warning' ? '#D97706' : '#647580';
  return <Typography variant="caption" sx={{ flex: '0 0 auto', color, fontFamily: 'inherit', fontWeight: 800 }}>{children}</Typography>;
}

function selectionLabelFor(document: ReturnType<typeof useEditorStore.getState>['currentDocument'], selection: ReturnType<typeof useEditorStore.getState>['selection']): string {
  if (!selection) {
    return 'ninguna';
  }
  if (selection.type === 'class') {
    return document.model.classes.find((umlClass) => umlClass.id === selection.id)?.name ?? 'clase';
  }
  if (selection.type === 'enumeration') {
    return document.model.enumerations.find((enumeration) => enumeration.id === selection.id)?.name ?? 'enum';
  }
  return document.model.relationships.find((relationship) => relationship.id === selection.id)?.name ?? selection.type;
}
