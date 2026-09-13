'use client';

import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useEditorStore } from '../../stores/editor-store';

export function EditorStatusBar({ compact, collaborationState }: { compact: boolean; collaborationState?: string }) {
  const document = useEditorStore((state) => state.currentDocument);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const selection = useEditorStore((state) => state.selection);
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'ERROR').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'WARNING').length;
  const selectionLabel = selectionLabelFor(document, selection);

  return (
    <Box data-testid="editor-status-bar" sx={{ display: 'flex', gap: { xs: 0.75, sm: 1.25 }, alignItems: 'center', flexWrap: 'nowrap', minWidth: 0, overflow: 'hidden', px: { xs: 1, sm: 1.5 }, py: 0.35, borderTop: 1, borderColor: '#C8D3DA', bgcolor: '#F8FAFB', color: '#647580', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}>
      {!compact && <StatusItem>REV {document.revision}</StatusItem>}
      <StatusItem>{collaborationState === 'connected' ? 'REALTIME' : 'LOCAL'}</StatusItem>
      <StatusItem tone={errors > 0 ? 'error' : 'default'}>{errors} {compact ? 'ERR' : 'ERRORS'}</StatusItem>
      <StatusItem tone={warnings > 0 ? 'warning' : 'default'}>{warnings} {compact ? 'WARN' : 'WARNING'}</StatusItem>
      <Typography data-testid="status-selection" variant="caption" sx={{ ml: 'auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'inherit', fontWeight: 800, color: '#0B1F33' }}>{selectionLabel.toUpperCase()}</Typography>
    </Box>
  );
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
